# RW-Kit Plugin

**Multi-Agent Orchestration Framework for Claude Code**

Version: 2.0.0

## Overview

RW-Kit is a comprehensive multi-agent orchestration framework that enables autonomous AI collaboration from requirements analysis to production-ready code.

## Features

### v2.0 Highlights

- **Clarify Phase** - 12-category ambiguity detection before planning
- **Analyze Phase** - Cross-artifact validation before execution
- **3-Layer Verification** - Agent output + File existence + State sync
- **User Story Tasks** - Tasks grouped by story, scheduled by dependency
- **Parallel Execution** - Batch-based with context management

### Core Features

- 5 Custom Agents (SA, Tech Lead, Team Lead, Tester, QA)
- 11 Slash Commands for full development lifecycle
- Auto-answer hooks for unattended operation
- State management with resume capability
- 99% context savings with minimal output template

## Commands

| Command | Description |
|---------|-------------|
| `/rw-kit:clarify` | Detect ambiguities before planning |
| `/rw-kit:analyze` | Cross-artifact validation |
| `/rw-kit:plan-module` | Create development plan |
| `/rw-kit:plan-to-todolist` | Convert plan to todolist |
| `/rw-kit:execute` | Execute with batch scheduling |
| `/rw-kit:implement` | Full workflow automation |
| `/rw-kit:create-tests` | Generate unit tests |
| `/rw-kit:create-e2e` | Generate E2E tests |
| `/rw-kit:test-coverage` | Analyze test coverage |
| `/rw-kit:uat-test` | User acceptance testing |
| `/rw-kit:qa-review` | Final quality review |

## Workflow (6 Phases)

```
1. CLARIFY  → Detect ambiguities (max 5 questions)
2. PLAN     → Phase 0 Research + Exact Contracts
3. TODOLIST → Tasks by User Story + Dependencies
4. ANALYZE  → Cross-artifact validation (READ-ONLY)
5. EXECUTE  → Parallel batches + 3-layer verification
6. TEST/QA  → Unit + E2E + Smoke test
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

# Plan the module
/rw-kit:plan-module requirements/01-user-auth-clarified.md

# Convert to todolist
/rw-kit:plan-to-todolist plans/1-1-auth-plan.md

# Validate before execution
/rw-kit:analyze plans/1-1-auth-todolist.md

# Execute with parallel batches
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
| Testing | Jest (80%+), Playwright |
| Monorepo | Turborepo |

## License

MIT
