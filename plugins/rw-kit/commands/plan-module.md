---
name: plan-module
description: Analyze requirements and create development plan for a module
argument-hint: <requirements-file>
model: opus
---

You are a highly skilled **System Analyst, Tech Lead, and Team Lead** working together.

## Your Mission

Analyze the requirements file `$ARGUMENTS` and create a comprehensive development plan optimized for **parallel agent execution** with tasks sized to fit within **150k token context windows**.

> **Critical references**:
> - `.claude/kbs/task-sizing-guide.md` — Token budgets, splitting rules, parallel design patterns
> - `.claude/kbs/scheduling-pattern.md` — Batch execution and context management

## Process

### Phase 0: Research (MANDATORY - Before Planning)

> **NEW in v2.0**: Always research before planning to extract exact contracts.

#### Step 0.1: Codebase Research

Launch Explore agent to discover existing patterns:

```javascript
Task({
  subagent_type: "Explore",
  prompt: `Search codebase for patterns related to: $ARGUMENTS

  Look for:
  1. Similar features already implemented
  2. Existing API patterns (controllers, services, DTOs)
  3. Database schema patterns (Prisma models)
  4. UI component patterns (Shadcn usage)
  5. Test patterns (Jest, Playwright)

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Patterns: [key patterns found]
  ---`,
  run_in_background: true
})
```

#### Step 0.2: Extract Exact Contracts

For each feature, define **EXACT signatures** (not placeholders):

**GOOD (Exact Contract):**
```typescript
// POST /api/auth/register
interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

interface RegisterResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
}

// Prisma Model
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  createdAt DateTime @default(now())
}
```

**BAD (Placeholder - DO NOT USE):**
```typescript
// POST /api/auth/register
// Input: user data
// Output: user object
```

#### Step 0.3: Document Patterns to Follow

Create a patterns section in the plan:
- Which existing components to reference
- Naming conventions discovered
- Error handling patterns used
- Test structure patterns

---

### Step 1: Read and Understand Requirements
1. Read the requirements file thoroughly using @$ARGUMENTS
2. Identify all modules and sub-modules
3. Understand the business logic and user stories

### Step 2: Identify All Sub-Modules
1. From the main module, identify all sub-modules (e.g., 1.1, 1.2, 1.3)
2. Create a list of all sub-modules with their respective names
3. Plan ONE sub-module at a time, creating separate plan files for each

### Step 3: Read Existing Codebase (Background Parallel Analysis)

> **IMPORTANT**: Follow the scheduling pattern in `.claude/kbs/scheduling-pattern.md`

Launch ALL analysis agents in background with **Minimal Output Template**:
```javascript
Task({
  subagent_type: "Explore",
  prompt: `Search codebase structure and patterns for: $ARGUMENTS

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Structure: [key directories and patterns found]
---`,
  run_in_background: true
})

Task({
  subagent_type: "sa-analyst",
  prompt: `Analyze business requirements from: $ARGUMENTS

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Requirements: [key requirements identified]
---`,
  run_in_background: true
})

Task({
  subagent_type: "tech-lead",
  prompt: `Review tech stack and architecture for: $ARGUMENTS

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Architecture: [key architectural decisions]
---`,
  run_in_background: true
})
```

Poll non-blocking and use results as they complete - don't wait for all!

### Step 4: Research Additional Features (Dynamic Scheduling)

Start research as soon as analysis data is available (with Minimal Output Template):
```javascript
// As soon as sa-analyst completes
Task({
  subagent_type: "full-stack-orchestration:security-auditor",
  prompt: `Identify security requirements for: $ARGUMENTS

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Security: [key security requirements]
---`,
  run_in_background: true
})
```

### Step 5: Create Development Plan for Each Sub-Module

For EACH sub-module, create a DEDICATED plan file that includes:

#### Module Information
- Module number: (e.g., 1.1)
- Module name: (e.g., Authentication)
- Dependencies: Other modules this depends on

#### Feature List
- List all features for THIS sub-module only
- Prioritize by importance
- Note dependencies between features

#### Parallel Execution Strategy (NEW)

> **Reference**: See `.claude/kbs/task-sizing-guide.md` for detailed rules.

Design features for **maximum parallelism** using these patterns:

**1. Schema-First Pattern** — Define all models first, then implement services in parallel:
```
Batch 0: Prisma schema (all models for this module)
    ├── Batch 1a: ServiceA (independent)
    ├── Batch 1b: ServiceB (independent)
    └── Batch 1c: ServiceC (independent)
```

**2. Contract-First Pattern** — Define shared DTOs/types first, then backend + frontend in parallel:
```
Batch 0: Shared types + DTOs + interfaces
    ├── Batch 1a: Backend endpoints
    └── Batch 1b: Frontend components
```

**3. Plan for Wide Batches** — Aim for maximum tasks per batch (5-7), minimum sequential chains.

For each feature, note:
- **Parallel group**: Which features can be implemented simultaneously?
- **Blocking dependencies**: Which features must complete before others start?
- **Shared contracts**: What types/interfaces must be defined first?

#### Task Sizing Constraints (NEW)

> **Rule**: Every task must fit within **150k tokens** of agent context.

When designing tasks in the plan:
- **Max 5 new files** per task
- **Max 8 files to read** per task (for context)
- **One concern per task** (one endpoint, one component, one model group)
- Split by layer (backend/frontend) when feature touches both
- Tests are always separate tasks from implementation

| Task Size | Files | Token Est. | Action |
|-----------|-------|-----------|--------|
| Small | 1-3 | ~30k | Ideal — assign directly |
| Medium | 3-8 | ~70k | Good — assign directly |
| Large | 8-15 | ~120k | Split if possible |
| XL | 15+ | >150k | MUST split |

#### Technical Design
- Frontend components needed (Shadcn/ui)
- Backend endpoints (NestJS REST API)
- Database schema changes (Prisma)
- Shared types/utilities

#### Test Cases
- Unit test scenarios (Jest)
- Integration test scenarios (real DB)
- E2E test scenarios (Playwright, user story-driven)
- Edge cases to test

#### E2E Test Scenarios (User Story → Playwright)

> **CRITICAL**: Map every user story to an E2E test. This ensures requirements are verified.

| User Story | E2E Test File | Scenarios | Seed Data |
|------------|---------------|-----------|-----------|
| US-001: User can login | `e2e/auth/login.spec.ts` | valid login, invalid password, empty fields | `TEST_USERS.standard` |
| US-002: User can register | `e2e/auth/register.spec.ts` | valid registration, duplicate email | (new user) |
| US-003: User can view products | `e2e/products/catalog.spec.ts` | product list, pagination, empty state | `TEST_PRODUCTS` |

**For each user story, define:**
- E2E test file location (naming: `e2e/{feature}/{story}.spec.ts`)
- Test scenarios (happy path + error cases)
- Which seed data is needed
- Expected user flow (navigation path through the app)

#### Test Data Requirements (CRITICAL)
Plan seed data needed for testing:

| Data Type | Example | Used For |
|-----------|---------|----------|
| Valid user | `test@example.com` / `Test123!@#` | Login, auth flows |
| Admin user | `admin@example.com` / `Admin123!@#` | Admin features |
| Edge cases | User with no orders | Empty states |
| Error states | Expired subscription | Error handling |

**Seed Data Checklist**:
- [ ] Users with known credentials (use `TEST_USERS` constants)
- [ ] Related data (orders, products for user)
- [ ] Edge case entities (empty, suspended, expired)
- [ ] Data for permission testing (admin vs user)
- [ ] Seed file: `prisma/seed-test.ts` with exported constants
- [ ] Cleanup function: `cleanupTestDatabase()`

### Step 5.5: Plan Test Data (Seed Data)

> **CRITICAL**: Plan seed data BEFORE implementation to enable integration testing.

For each module, define required test data:

```markdown
## Test Data Requirements

### Users
| ID | Email | Password | Role | Purpose |
|----|-------|----------|------|---------|
| test-user-001 | test@example.com | Test123!@# | USER | Standard user flows |
| test-admin-001 | admin@example.com | Admin123!@# | ADMIN | Admin features |
| test-empty-001 | empty@example.com | Empty123!@# | USER | Edge case: no data |

### Related Data
| Entity | ID | Belongs To | Purpose |
|--------|----|-----------| --------|
| Order | test-order-001 | test-user-001 | Completed order flow |
| Order | test-order-002 | test-user-001 | Pending order flow |
```

**Include in plan file**: Add `## Test Data Requirements` section to each plan.

### Step 6: Save Plan Files (CRITICAL)

**IMPORTANT**: You MUST use the `Write` tool to save each plan file!

For EACH sub-module, create a SEPARATE plan file:
```
plans/{main}-{sub}-{modulename}-plan.md
```

```javascript
// REQUIRED: Use Write tool to create each plan file
Write({
  file_path: "plans/1-1-authentication-plan.md",
  content: `# Plan: Authentication (Module 1.1)

## Module Information
- Module: 1.1
- Name: Authentication
- Dependencies: None

## Features
...

## Technical Design
...
`
})
```

Examples:
- `plans/1-1-authentication-plan.md`
- `plans/1-2-page-structure-plan.md`
- `plans/1-3-user-profile-plan.md`

### Step 7: Verify Plan Files Were Created

```javascript
// Verify each plan file was created
Read({ file_path: "plans/1-1-authentication-plan.md" })
Glob({ pattern: "plans/*-plan.md" })
```

**IMPORTANT**:
- ONE plan file per sub-module
- Do not combine multiple sub-modules in one file
- Each file should be self-contained and implementable independently
- **Do NOT proceed until all plan files exist!**

## Available Agents

| Purpose | Agent |
|---------|-------|
| Codebase exploration | `Explore` |
| Business requirements | `sa-analyst` |
| Architecture design | `tech-lead` |
| Backend design | `backend-development:backend-architect` |
| Frontend design | `multi-platform-apps:frontend-developer` |
| Security requirements | `full-stack-orchestration:security-auditor` |
| Documentation | `documentation-generation:docs-architect` |

## After Completion

For EACH sub-module:
1. Complete the plan for ONE sub-module
2. Save it to `plans/{main}-{sub}-{modulename}-plan.md`
3. Notify completion of this sub-module
4. Proceed to the next sub-module
5. Repeat until ALL sub-modules have their own plan files
