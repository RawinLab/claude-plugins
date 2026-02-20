# Task Sizing Guide — Fit Within 150k Tokens

> **Goal**: Every task assigned to a subagent must complete within **150k tokens** of context to minimize hallucination and ensure reliable output.
>
> **Why 150k?** Subagents have ~200k token limit. Reserve 50k for system prompt, tools, and safety margin. Usable budget = **150k tokens**.

---

## Token Budget Model

A subagent's 150k token budget is consumed by:

```
┌─────────────────────────────────────────────────────┐
│  150k Token Budget                                   │
├─────────────────────────────────────────────────────┤
│  ~25k  System prompt + tool definitions              │
│  ~15k  Task prompt (instructions, context, specs)    │
│  ~50k  Files read by agent (source code, schemas)    │
│  ~50k  Agent's own reasoning + code generation       │
│  ~10k  Safety buffer                                 │
├─────────────────────────────────────────────────────┤
│  = 150k total                                        │
└─────────────────────────────────────────────────────┘
```

### File Reading Budget: ~50k tokens (~100-150 files of ~400 tokens each)

| File Type | Avg Tokens | Example |
|-----------|------------|---------|
| Small service (50-100 lines) | ~300-500 | auth.service.ts |
| Medium service (100-300 lines) | ~500-1,500 | products.service.ts |
| Large service (300-600 lines) | ~1,500-3,000 | orders.service.ts |
| Schema file | ~500-2,000 | schema.prisma |
| Config file | ~200-500 | tsconfig.json |
| React component (small) | ~300-600 | Button.tsx |
| React component (complex) | ~1,000-2,500 | DataTable.tsx |
| Test file | ~500-2,000 | auth.spec.ts |

---

## Task Size Categories

### Small Task (fits easily — ~30k tokens used)

**Characteristics:**
- Touches 1-3 files
- Single concern (one endpoint, one component, one model)
- Clear input/output contract
- No complex business logic

**Examples:**
- Create a single Prisma model
- Create one REST endpoint (controller + service method)
- Create one React component with props
- Write unit tests for one service method

### Medium Task (fits — ~70k tokens used)

**Characteristics:**
- Touches 3-8 files
- One feature with multiple parts (e.g., CRUD for one entity)
- Needs to read existing patterns for consistency
- Moderate business logic

**Examples:**
- Full CRUD for one entity (model + service + controller + DTOs)
- One page with form + validation + API call
- Authentication flow (login endpoint + JWT + guard)
- Integration tests for one service

### Large Task (at risk — ~120k tokens used) ⚠️

**Characteristics:**
- Touches 8-15 files
- Multiple features or cross-cutting concerns
- Needs to read many existing files for context
- Complex business logic with edge cases

**Examples:**
- Full module with multiple entities + relationships
- Permission system across multiple endpoints
- Complex multi-step form with state management

> **Rule**: If a task looks Large, **split it into 2-3 Medium tasks**.

### Too Large (will NOT fit — >150k tokens) 🚫

**Characteristics:**
- Touches 15+ files
- Multiple modules or cross-module changes
- Requires understanding the entire codebase
- Multi-day human effort equivalent

> **Rule**: MUST split into 3+ smaller tasks. Never assign as single task.

---

## Task Splitting Rules

### Rule 1: One Concern Per Task

```
BAD:  "Create auth module with login, register, forgot password, 2FA, and admin panel"
GOOD: Task 1: "Create User model + RegisterDto + register endpoint"
      Task 2: "Create LoginDto + login endpoint + JWT"
      Task 3: "Create forgot password flow"
      Task 4: "Create 2FA flow"
```

### Rule 2: Split by Layer When Large

```
BAD:  "Create product catalog with API and UI"
GOOD: Task 1: "Create Product model + CRUD service + controller" [backend]
      Task 2: "Create ProductList + ProductCard components" [frontend]
      Task 3: "Create product page with API integration" [frontend]
```

### Rule 3: Split by Entity When Multiple

```
BAD:  "Create database schema for users, products, orders, and reviews"
GOOD: Task 1: "Create User + Role models" [deps: none]
      Task 2: "Create Product + Category models" [deps: none]
      Task 3: "Create Order + OrderItem models" [deps: Task 1, Task 2]
      Task 4: "Create Review model" [deps: Task 1, Task 2]
```

### Rule 4: Tests as Separate Tasks

```
BAD:  "Create auth service with full test coverage"
GOOD: Task 1: "Create AuthService with register + login" [backend]
      Task 2: "Create unit tests for AuthService" [deps: Task 1]
      Task 3: "Create integration tests for AuthService" [deps: Task 1]
```

### Rule 5: Max 5 Files Created Per Task

If a task would create more than 5 files, split it. This naturally keeps the token budget manageable.

---

## Parallel Execution Design

### Independence Principle

Tasks should be designed for **maximum parallel execution**. Two tasks can run in parallel if:
1. They don't write to the same files
2. They don't depend on each other's output
3. They can be understood independently (self-contained context)

### Dependency Minimization Patterns

**Pattern 1: Interface-First (Contract-Based)**

Define shared contracts first, then implement independently:

```
Batch 0: Task: "Define shared types (DTOs, interfaces) in packages/shared"
    │
    ├─── Batch 1a: "Implement backend AuthService using shared DTOs"
    ├─── Batch 1b: "Implement frontend LoginForm using shared DTOs"
    └─── Batch 1c: "Implement frontend RegisterForm using shared DTOs"
```

**Pattern 2: Schema-First**

Database schema first, then independent service implementations:

```
Batch 0: "Create Prisma schema (all models)"
    │
    ├─── Batch 1a: "Create UserService + controller"
    ├─── Batch 1b: "Create ProductService + controller"
    └─── Batch 1c: "Create CategoryService + controller"
```

**Pattern 3: Layer-Split for Wide Features**

Split by architectural layer to enable parallelism:

```
Batch 0: "Schema + shared types"
    │
    ├─── Batch 1a: "All backend services (independent modules)"
    ├─── Batch 1b: "All frontend components (independent pages)"
    │
    └─── Batch 2: "Integration wiring + E2E tests"
```

### Anti-Patterns (Reduce Parallelism)

```
BAD: Sequential chain where each task depends on the previous
  Task 1 → Task 2 → Task 3 → Task 4 → Task 5
  (5 batches, no parallelism)

GOOD: Wide dependency graph with shared root
  Task 1 (schema) → Task 2a, 2b, 2c, 2d (parallel)
  (2 batches, 4x parallelism)
```

---

## Task Prompt Template (Token-Efficient)

When assigning tasks to subagents, keep the prompt concise:

```
## Task: [Clear one-line description]

### Context
- Module: [module name]
- Tech: [NestJS/Next.js/Prisma]

### Files to Read First
- [file1.ts] — [why: existing pattern to follow]
- [file2.ts] — [why: related code]

### Requirements
1. [Specific requirement]
2. [Specific requirement]

### Contracts (Exact Signatures)
[Input/output types if defined in plan]

### Output Files
- [file-to-create.ts]
- [file-to-modify.ts]

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list]
---
```

**Key**: List specific files to read (don't let agent explore the whole codebase). This controls the file-reading budget.

---

## Estimating Task Size

Before creating a task, mentally estimate:

| Question | Tokens |
|----------|--------|
| How many files will agent read? | count × ~500 |
| How many files will agent create? | count × ~800 |
| How complex is the business logic? | simple=5k, medium=15k, complex=30k |
| How many existing patterns to follow? | count × ~500 |

**Total estimate** = files_read + files_create + logic + patterns + 25k (system) + 10k (buffer)

If total > 120k → **split the task**.

---

## Quick Reference

```
150k = agent's usable budget
 25k = system prompt overhead
 50k = max files to read
 50k = max generation
 10k = safety buffer

Task sizes:
  Small  (~30k) = 1-3 files, single concern          ✅ Ideal
  Medium (~70k) = 3-8 files, one feature              ✅ Good
  Large (~120k) = 8-15 files, complex feature          ⚠️ Split if possible
  XL    (>150k) = 15+ files, multi-feature             🚫 MUST split

Split rules:
  1. One concern per task
  2. Split by layer (backend/frontend) when large
  3. Split by entity when multiple
  4. Tests as separate tasks
  5. Max 5 new files per task

Parallel design:
  - Interface/schema first → independent implementations
  - Minimize sequential chains
  - Maximize batch width (more parallel tasks per batch)
```
