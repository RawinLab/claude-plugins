# RW-Kit Plugin

**Multi-Agent Orchestration Framework for Claude Code**

Version: 2.2.0

## Overview

RW-Kit is a comprehensive multi-agent orchestration framework that enables autonomous AI collaboration from requirements analysis to production-ready code.

## Features

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
- 12 Slash Commands for full development lifecycle
- Auto-answer hooks for unattended operation
- State management with resume capability
- 99% context savings with minimal output template

## Commands

| Command | Description |
|---------|-------------|
| `/rw-kit:clarify` | Detect ambiguities before planning |
| `/rw-kit:analyze` | Cross-artifact validation |
| `/rw-kit:plan-module` | Create development plan with E2E spec mapping |
| `/rw-kit:plan-to-todolist` | Convert plan to todolist |
| `/rw-kit:execute` | Execute with batch scheduling + seed data + integration tests |
| `/rw-kit:implement` | Full workflow automation with seed data pipeline |
| `/rw-kit:create-tests` | Generate unit tests |
| `/rw-kit:create-integration-tests` | Generate integration tests with real DB |
| `/rw-kit:create-e2e` | Generate E2E tests with seed data + user story mapping |
| `/rw-kit:test-coverage` | Analyze test coverage |
| `/rw-kit:uat-test` | User acceptance testing with traceability check |
| `/rw-kit:qa-review` | Final quality review |

## Workflow (6 Phases)

```
1. CLARIFY  → Detect ambiguities (max 5 questions)
2. PLAN     → Phase 0 Research + Exact Contracts + E2E Spec Mapping
3. TODOLIST → Tasks by User Story + Dependencies
4. ANALYZE  → Cross-artifact validation (READ-ONLY)
5. EXECUTE  → Parallel batches + Seed data + 3-layer verification
6. TEST/QA  → Unit + Integration + E2E (user story) + Smoke test
```

## Testing Pipeline

```
Seed Data Setup (prisma/seed-test.ts)
    │
    ▼
Unit Tests (Jest, 80%+ coverage)
    │
    ▼
Integration Tests (real DB + seed data, *.integration.spec.ts)
    │
    ▼
E2E Tests (Playwright + seed data + user story mapping)
    │
    ▼
Smoke Test (npm run dev + health checks)
    │
    ▼
Traceability Check (all user stories → E2E tests)
```

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

# Plan the module (includes E2E spec mapping)
/rw-kit:plan-module requirements/01-user-auth-clarified.md

# Convert to todolist
/rw-kit:plan-to-todolist plans/1-1-auth-plan.md

# Validate before execution
/rw-kit:analyze plans/1-1-auth-todolist.md

# Execute with parallel batches (seeds data automatically)
/rw-kit:execute plans/1-1-auth-todolist.md

# Or run full workflow
/rw-kit:implement user-authentication feature
```

## Configuration

### State File
- Location: `.claude/rw-kit.state.json`
- Tracks: Tasks, batches, progress, resume point

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
