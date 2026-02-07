---
name: plan-to-todolist
description: Convert a development plan into an actionable todolist and register in master
argument-hint: <plan-file>
model: sonnet
---

You are a highly skilled **System Analyst, Project Manager, and Tech Lead**.

## Your Mission

Convert ONE development plan into an actionable todolist file and register it in `00-master-todolist.md`.

## Input

Plan File: `$ARGUMENTS` (e.g., `plans/1-1-bird-physics-plan.md`)

## Key Rules

1. **One plan = One todolist file**
   - `1-1-bird-physics-plan.md` → `1-1-bird-physics-todolist.md`

2. **Always update master todolist**
   - Register the new todolist in `plans/00-master-todolist.md`

3. **Use `-todolist.md` suffix** (not `-todo.md`)

---

## Process

### Step 1: Read Plan File

```javascript
Read({ file_path: "$ARGUMENTS" })
```

### Step 2: Launch Analysis Agents (Background)

```javascript
Task({
  subagent_type: "sa-analyst",
  prompt: `Analyze business requirements from plan: $ARGUMENTS

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Requirements: [comma-separated list]
---`,
  run_in_background: true
})

Task({
  subagent_type: "tech-lead",
  prompt: `Identify technical tasks and dependencies from plan: $ARGUMENTS

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Tasks: [numbered list with dependencies]
---`,
  run_in_background: true
})

Task({
  subagent_type: "Explore",
  prompt: `Check existing implementations for: $ARGUMENTS

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Existing: [comma-separated list]
---`,
  run_in_background: true
})
```

### Step 3: Determine Output Filename

Extract the plan name and create todolist filename:
```
plans/1-1-bird-physics-plan.md
→ plans/1-1-bird-physics-todolist.md
```

**Naming Rule**: Replace `-plan.md` with `-todolist.md`

### Step 4: Create TodoList File

```javascript
Write({
  file_path: "plans/{module}-todolist.md",
  content: `# TodoList: {Module Name}

## Overview
- Source Plan: {plan-file}
- User Stories: {count}
- Total Tasks: {count}
- Generated: {timestamp}

---

## User Story: US-001 {Story Title}
> {Story description}

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Tasks
- [ ] T001 P1 US-001 {Task description} [agent: backend-architect] [deps: none] [files: file.ts]
- [ ] T002 P1 US-001 {Task description} [agent: frontend-developer] [deps: T001] [files: Component.tsx]

### Story Progress: 0/{count}

---

## Test Data & Testing Tasks

### Seed Data Setup
- [ ] T0S1 P1 ALL Create/update seed-test.ts with TEST_USERS and test entities [agent: backend-architect] [deps: DB tasks] [files: prisma/seed-test.ts]
- [ ] T0S2 P1 ALL Add db:seed:test script to package.json [agent: backend-architect] [deps: T0S1] [files: package.json]

### Integration Tests (per service)
- [ ] T0I1 P2 US-001 Create integration tests for {Service} [agent: test-automator] [deps: service tasks] [files: {service}.integration.spec.ts]

### E2E Tests (per user story)
| Task | User Story | E2E Test File | Seed Data | Deps |
|------|------------|---------------|-----------|------|
| T0E1 | US-001 | e2e/{feature}/{story}.spec.ts | TEST_USERS.standard | All US-001 tasks |
| T0E2 | US-002 | e2e/{feature}/{story}.spec.ts | TEST_USERS.standard | All US-002 tasks |

> **Rules**: E2E tests MUST use `TEST_USERS` from seed-test.ts (never hardcode credentials). Each user story MUST have a corresponding E2E test.

---

## Execution Batches

### Batch 0 - No Dependencies
| Task | Story | Agent | Files |
|------|-------|-------|-------|
| T001 | US-001 | backend-architect | file.ts |

### Batch 1 - Depends on Batch 0
| Task | Story | Agent | Deps | Files |
|------|-------|-------|------|-------|
| T002 | US-001 | frontend-developer | T001 | Component.tsx |

### Batch N-1 - Seed Data & Integration Tests
| Task | Story | Agent | Deps | Files |
|------|-------|-------|------|-------|
| T0S1 | ALL | backend-architect | DB tasks | prisma/seed-test.ts |
| T0I1 | US-001 | test-automator | service tasks | *.integration.spec.ts |

### Batch N - E2E Tests (Last Batch)
| Task | Story | Agent | Deps | Files |
|------|-------|-------|------|-------|
| T0E1 | US-001 | test-automator | All US-001 tasks | e2e/{feature}/{story}.spec.ts |
| T0E2 | US-002 | test-automator | All US-002 tasks | e2e/{feature}/{story}.spec.ts |

> **Testing batch order**: Seed data → Integration tests → E2E tests (always last)

---

## Progress Summary
- Total: {count}
- Completed: 0
- Pending: {count}

Last Updated: {timestamp}
`
})
```

### Step 5: Update Master TodoList (CRITICAL)

Check if `plans/00-master-todolist.md` exists:

```javascript
// Try to read existing master
Read({ file_path: "plans/00-master-todolist.md" })
```

**If exists**: Add/update the entry for this plan
**If not exists**: Create new master todolist

#### Master TodoList Format

```javascript
Write({
  file_path: "plans/00-master-todolist.md",
  content: `# Master TodoList

## Overview
- Total Plans: {count}
- Completed: 0
- In Progress: 0
- Pending: {count}

Last Updated: {timestamp}

---

## Plans & Todolists

| # | Plan File | TodoList File | Status | Progress |
|---|-----------|---------------|--------|----------|
| 1 | 1-1-bird-physics-plan.md | 1-1-bird-physics-todolist.md | pending | 0% |
| 2 | 1-2-pipes-plan.md | 1-2-pipes-todolist.md | pending | 0% |
| 3 | 1-3-scoring-plan.md | - | no todolist | - |

---

## Execution Order

Execute todolists in order:
1. [ ] 1-1-bird-physics-todolist.md
2. [ ] 1-2-pipes-todolist.md
3. [ ] (create todolist first)

---

## How to Execute

\`\`\`bash
# Execute all todolists in order
/rw-kit:execute plans/00-master-todolist.md

# Execute specific todolist
/rw-kit:execute plans/1-1-bird-physics-todolist.md
\`\`\`
`
})
```

### Step 6: Verify Files Created

```javascript
// Verify todolist was created
Read({ file_path: "plans/{module}-todolist.md" })

// Verify master was updated
Read({ file_path: "plans/00-master-todolist.md" })
```

---

## Task Format

```
- [ ] [TaskID] [Priority] [StoryRef] Description [agent: X] [deps: Y] [files: Z]
```

Where:
- `TaskID`: T001, T002, etc.
- `Priority`: P1 (critical), P2 (important), P3 (nice-to-have)
- `StoryRef`: US-001, US-002, etc.
- `agent`: Specialized agent to use
- `deps`: Task dependencies (none, or T001, T002)
- `files`: Expected output files (for verification)

## Available Agents

| Task Type | Agent |
|-----------|-------|
| Database/API | `backend-development:backend-architect` |
| UI/React | `multi-platform-apps:frontend-developer` |
| Unit/Integration Tests | `full-stack-orchestration:test-automator` |
| E2E Tests (Playwright) | `full-stack-orchestration:test-automator` |
| Seed Data | `backend-development:backend-architect` |
| Security | `full-stack-orchestration:security-auditor` |

---

## After Completion

1. ✅ Individual todolist file created
2. ✅ Master todolist updated
3. ✅ Seed data tasks included (prisma/seed-test.ts)
4. ✅ Integration test tasks included (per key service)
5. ✅ E2E test tasks mapped to user stories (per US-XXX)
6. 📋 Ready for `/rw-kit:analyze` then `/rw-kit:execute`
