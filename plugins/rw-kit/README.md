# RW-Kit Plugin

**Multi-Agent Orchestration Framework for Claude Code**

Version: 3.1.0

## Overview

RW-Kit is a comprehensive multi-agent orchestration framework that enables fully autonomous AI collaboration from requirements analysis through UAT testing and QA review to production-grade code.

## Features

### v3.1 Highlights - Parallel-First & Token-Budgeted

- **150k Token Budget per Task** - Every task sized to fit within agent context (prevents hallucination)
- **Parallel-First Task Design** - Schema-first, contract-first, layer-split patterns for maximum parallelism
- **Task Size Tags** - `[size: S|M]` on every task; L/XL tasks auto-split before execution
- **Parallelism Score** - Measures tasks/batches ratio (target ≥ 3) to ensure wide batches
- **Task Splitting Rules** - One concern per task, max 5 new files, split by layer/entity
- **Controlled File Reading** - Agent prompts specify exact files to read (controls token budget)
- **Status Command** - `/rw-kit:status` to view progress, quality gates, blocked/degraded status
- **Improved Hook Guards** - Pre-check state file exists, suppress errors silently
- **Dedicated Knowledge Bases** - `smoke-test-guide.md`, `retry-policy.md`, `task-sizing-guide.md`

### v3.0 Highlights - Fully Agentic Pipeline

- **End-to-End Autonomous Pipeline** - Execute drives dev → UAT → QA → production-grade in one command
- **Pre-flight Environment Checks** - Validates node, npm, prisma, env files before starting
- **Retry Limits & Escalation** - 3 retries per task (debugger → specialist → broad context → BLOCKED)
- **Enforcing Quality Gates** - Max 3 fix attempts per test phase, then DEGRADED (no infinite loops)
- **Auto-Fix Protocols** - Pattern-matched fixes for common smoke test errors (DI, imports, types)
- **Inline UAT Testing** - Full test suite + user story traceability + anti-mock checks
- **Inline QA Review** - Code quality (3 agents) + security review (2 agents) + fix cycles
- **BLOCKED/DEGRADED States** - Clear escalation: blocked tasks skipped, degraded phases reported
- **Auto-Answer Guide** - Documented strategy for fully autonomous execution
- **State v3.0** - Tracks retry counts, quality gates, blocked tasks, degraded phases, QA cycles

### v2.2 Highlights

- **Seed Data Pipeline** - Automatic test database seeding before integration/E2E tests
- **User Story → E2E Mapping** - Every Playwright test traces back to a user story
- **Integration Testing** - Real database tests with seed data (no mocking)
- **Full-Stack Verification** - Unit → Integration → E2E → Smoke test pipeline
- **Traceability Checks** - Verify all user stories have corresponding E2E tests

### v2.0 Highlights

- **Clarify Phase** - 12-category ambiguity detection before planning
- **Analyze Phase** - Cross-artifact validation before execution
- **3-Layer Verification** - Agent output + File existence + State sync
- **User Story Tasks** - Tasks grouped by story, scheduled by dependency
- **Parallel Execution** - Batch-based with context management

### Core Features

- 5 Custom Agents (SA, Tech Lead, Team Lead, Tester, QA)
- 13 Slash Commands for full development lifecycle
- Auto-answer hooks for unattended operation
- State management with resume capability
- 99% context savings with minimal output template

## Commands

| Command | Description |
|---------|-------------|
| `/rw-kit:clarify` | Detect ambiguities before planning |
| `/rw-kit:analyze` | Cross-artifact validation |
| `/rw-kit:plan-module` | Create development plan (parallel-aware + task sizing) |
| `/rw-kit:plan-to-todolist` | Convert plan to todolist (token-budgeted + parallelism score) |
| `/rw-kit:execute` | Execute with full agentic pipeline (dev → UAT → QA) |
| `/rw-kit:implement` | Full workflow automation (requirements → production-grade) |
| `/rw-kit:create-tests` | Generate unit tests |
| `/rw-kit:create-integration-tests` | Generate integration tests with real DB |
| `/rw-kit:create-e2e` | Generate E2E tests with seed data + user story mapping |
| `/rw-kit:test-coverage` | Analyze test coverage |
| `/rw-kit:uat-test` | User acceptance testing with traceability check |
| `/rw-kit:qa-review` | Final quality review |
| `/rw-kit:status` | View execution progress and quality gates |

## Workflow (10 Phases)

```
1. CLARIFY    → Detect ambiguities (max 5 questions)
2. PLAN       → Phase 0 Research + Exact Contracts + Parallel Strategy + Task Sizing
3. TODOLIST   → Tasks by User Story + [size: S|M] + Parallelism Score
4. ANALYZE    → Cross-artifact validation (READ-ONLY)
5. PRE-FLIGHT → Verify environment (node, npm, prisma, env)
6. EXECUTE    → Validate task sizes + parallel batches + retry limits + 3-layer verification
7. TEST       → Unit + Integration + E2E (enforcing gates, max 3 fixes)
8. QUALITY    → Smoke test + auto-fix protocols
9. UAT        → Full test suite + traceability + anti-mock check
10. QA REVIEW → Code quality + security review + fix cycles → APPROVED/DEGRADED
```

## Task Sizing (150k Token Budget)

Every task assigned to a subagent must fit within **150k tokens**:

```
150k Token Budget:
  25k  System prompt + tools
  50k  Files read by agent
  50k  Agent reasoning + code generation
  10k  Safety buffer (prevents hallucination)
  15k  Task prompt
```

| Size | New Files | Read Files | Token Est. | Status |
|------|----------|-----------|-----------|--------|
| **S** (Small) | 1-3 | 1-5 | ~30k | Ideal |
| **M** (Medium) | 3-5 | 3-8 | ~70k | Good |
| **L** (Large) | 5-10 | 8-15 | ~120k | **Split required** |
| **XL** | 10+ | 15+ | >150k | **MUST split** |

### Splitting Rules

1. **One concern per task** — one endpoint, one component, one model
2. **Split by layer** — backend and frontend as separate tasks
3. **Split by entity** — one model group per task
4. **Tests separate** — implementation and tests in different tasks
5. **Max 5 new files** per task

## Parallel Execution Design

### Parallel Patterns

```
Schema-First:
  Batch 0: Prisma schema (all models)
      ├── Batch 1a: ServiceA
      ├── Batch 1b: ServiceB
      └── Batch 1c: ServiceC

Contract-First:
  Batch 0: Shared types + DTOs
      ├── Batch 1a: Backend endpoints
      └── Batch 1b: Frontend components

Layer-Split:
  Batch 0: Schema + shared types
      ├── Batch 1a: All backend services
      └── Batch 1b: All frontend components
```

### Parallelism Score

```
Parallelism Ratio = total_tasks / total_batches

BAD:  T1 → T2 → T3 → T4 → T5  (ratio: 1.0)
GOOD: T1,T2,T3 → T4,T5,T6,T7   (ratio: 3.5)
Target: ratio ≥ 3
```

## Testing Pipeline

```
Pre-flight Check (node, npm, prisma, env)
    │
    ▼
Seed Data Setup (prisma/seed-test.ts)
    │
    ▼
Unit Tests (Jest, 80%+ coverage) ─── Fix Loop (max 3) → DEGRADED
    │
    ▼
Integration Tests (real DB + seed data) ─── Fix Loop (max 3) → DEGRADED
    │
    ▼
E2E Tests (Playwright + user story mapping) ─── Fix Loop (max 3) → DEGRADED
    │
    ▼
Smoke Test + Auto-Fix Protocols (max 2 retries)
    │
    ▼
UAT (traceability check + anti-mock check)
    │
    ▼
QA Review (code quality + security) ─── Fix Cycles (max 2) → APPROVED/DEGRADED
```

### Retry Limits

| Scope | Max Retries | Escalation |
|-------|-------------|------------|
| Task implementation | 3 per task | debugger → specialist → broad context → BLOCKED |
| Test phase fix loop | 3 per phase | debugger → specialist → full analysis → DEGRADED |
| Smoke test auto-fix | 2 | pattern-match fix → DEGRADED |
| QA review cycles | 2 | fix + re-test → DEGRADED |

### Seed Data

Tests use shared seed data constants from `prisma/seed-test.ts`:

| User | Email | Role | Purpose |
|------|-------|------|---------|
| `TEST_USERS.standard` | test@example.com | USER | Normal user flows |
| `TEST_USERS.admin` | admin@example.com | ADMIN | Admin features |
| `TEST_USERS.empty` | empty@example.com | USER | Empty state testing |

### User Story → E2E Mapping

Every E2E test file maps to a user story for traceability:

```
US-001: User can login  → e2e/auth/login.spec.ts
US-002: User can register → e2e/auth/register.spec.ts
US-003: User can view products → e2e/products/catalog.spec.ts
```

## Agents

| Agent | Role |
|-------|------|
| `sa-analyst` | Requirements analysis |
| `tech-lead` | Technical architecture |
| `team-lead` | Task orchestration |
| `lead-tester` | UAT testing |
| `qa-lead` | Quality review |

## Knowledge Bases

| File | Purpose |
|------|---------|
| `kbs/task-sizing-guide.md` | 150k token budget, splitting rules, parallel patterns |
| `kbs/scheduling-pattern.md` | Batch execution, context management, minimal output |
| `kbs/retry-policy.md` | Retry limits and escalation paths |
| `kbs/smoke-test-guide.md` | Smoke test procedures and auto-fix patterns |
| `kbs/qa-checklist.md` | Comprehensive QA checklist |
| `kbs/test-writing-guide.md` | Test conventions, seed data guide |
| `kbs/auto-answer-guide.md` | Auto-answer strategy for autonomous execution |
| `kbs/context-management-guide.md` | Context optimization strategies |

## 3-Layer Verification

```
Agent "DONE" → Layer 1 (Hook) → Layer 2 (Hook) → Layer 3 (Manual) → TRULY COMPLETE
```

| Layer | Hook | What it Checks |
|-------|------|----------------|
| 1 | progress-tracker.json | Agent output patterns |
| 2 | file-verification.json | Expected files exist |
| 3 | Orchestrator | State.json matches todolist |

## Installation

This plugin is part of the rawinlab-claude-plugins collection.

```bash
# Clone the plugins repository
git clone https://github.com/rawinlab/claude-plugins

# The plugin will be auto-discovered by Claude Code
```

## Usage

```bash
# Start with requirements
/rw-kit:clarify requirements/01-user-auth.md

# Plan the module (parallel-aware + task sizing)
/rw-kit:plan-module requirements/01-user-auth-clarified.md

# Convert to todolist (token-budgeted + parallelism score)
/rw-kit:plan-to-todolist plans/1-1-auth-plan.md

# Validate before execution
/rw-kit:analyze plans/1-1-auth-todolist.md

# Execute with parallel batches (seeds data automatically)
/rw-kit:execute plans/1-1-auth-todolist.md

# Check progress anytime
/rw-kit:status

# Or run full workflow
/rw-kit:implement user-authentication feature
```

## Configuration

### State File (v3.1)
- Location: `.claude/rw-kit.state.json`
- Tracks: Tasks, batches, progress, retry counts, quality gates, blocked tasks, degraded phases, user stories, verification flags, resume point

### Quality Gates

| Gate | Tracked In State |
|------|-----------------|
| Unit Tests | `quality_gates.unit_tests` |
| Integration Tests | `quality_gates.integration_tests` |
| E2E Tests | `quality_gates.e2e_tests` |
| Smoke Test | `quality_gates.smoke_test` |
| UAT | `quality_gates.uat` |
| QA Review | `quality_gates.qa_review` |

### Resume Execution
```bash
/rw-kit:execute plans/1-1-auth-todolist.md --resume
```

## Tech Stack (Default)

| Component | Technology |
|-----------|------------|
| Frontend | Next.js, Shadcn/ui, Zustand |
| Backend | NestJS, REST |
| Database | PostgreSQL/MySQL, Prisma |
| Unit Testing | Jest (80%+ coverage) |
| Integration Testing | Jest + Real DB + Seed Data |
| E2E Testing | Playwright (user story-driven) |
| Monorepo | Turborepo |

## License

MIT
