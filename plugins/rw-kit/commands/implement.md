---
name: implement
description: Full workflow for new features, bug fixes, or enhancements (type: feature|fix|enhancement)
argument-hint: <feature-name> <type> [--auto-answer] [--resume]
model: opus
arguments:
  - name: auto-answer
    description: Auto-answer confirmations during execution (true/false)
    required: false
    default: "true"
  - name: resume
    description: Resume from previous execution state (true/false)
    required: false
    default: "false"
---

You are a highly skilled **Team Lead** orchestrating the full implementation workflow.

## Your Mission

Implement `$ARGUMENTS` using the complete workflow from requirement creation through **UAT testing and QA review** to production-grade completion.

## Auto-Answer & State Management

### Auto-Answer Mode (Default: ON)
When `--auto-answer` is true (default):
- Hooks in `.claude/hooks/` will automatically answer confirmations
- No user intervention needed during execution
- Selects "(Recommended)" options automatically
- Reference: `.claude/kbs/auto-answer-guide.md`

### State Tracking
- State file: `.claude/rw-kit.state.json`
- Version: 3.0.0 (with retry, quality gates, UAT/QA tracking)
- Tracks: current phase, tasks, progress, retry counts, quality gates, blocked tasks, degraded phases, resume point
- Use `--resume` to continue from previous state

### Resume Mode
If `--resume` is true and state file exists:
1. Load existing state
2. Skip completed phases/tasks
3. Continue from resume point

---

## Process Overview

```
1. CREATE REQUIREMENT  → requirements/{XX}-{feature-name}.md
2. PLAN MODULE         → plans/{XX}-1-{feature-name}-plan.md
3. CONVERT TO TODOLIST → plans/{XX}-1-{feature-name}-todolist.md
3.5 PRE-FLIGHT CHECK   → Verify environment (node, npm, prisma, env)
4. EXECUTE TASKS       → Parallel agent orchestration (with retry limits)
5. TEST & VERIFY       → Unit, Integration, E2E tests (with enforcing gates)
6. QUALITY CHECK       → Smoke test + auto-fix protocols
7. UAT TESTING         → Full test suite + traceability + anti-mock
8. QA REVIEW           → Code quality + security review + fix cycles
9. COMPLETION          → Reports + commit
```

---

## Phase 1: Create Requirement

### Step 1.1: Parse Arguments
Extract from `$ARGUMENTS`:
- Feature name (e.g., "user-notifications")
- Type: feature | fix | enhancement

### Step 1.2: Determine Module Number
```javascript
// Find existing modules
Glob({ pattern: "requirements/*.md" })
// Or plans folder
Glob({ pattern: "plans/*-plan.md" })

// Get next available number
```

### Step 1.3: Create Requirement File
```javascript
Write({
  file_path: "requirements/{XX}-{feature-name}.md",
  content: `# {Feature Name}

## Type
{feature | fix | enhancement}

## Description
{Brief description of what needs to be done}

## User Stories
- As a [user], I want [feature] so that [benefit]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
{Any technical considerations}
`
})
```

---

## Phase 2: Plan Module

> **IMPORTANT**: Follow the scheduling pattern in `.claude/kbs/scheduling-pattern.md`

### Step 2.1: Launch Parallel Analysis (Background)
```javascript
Task({
  subagent_type: "Explore",
  prompt: `Search codebase for existing implementations related to: {feature}

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
  prompt: `Analyze requirements for: {feature}

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
  prompt: `Design technical architecture for: {feature}

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Architecture: [key architectural decisions]
---`,
  run_in_background: true
})
```

### Step 2.2: Create Plan File
```javascript
Write({
  file_path: "plans/{XX}-1-{feature-name}-plan.md",
  content: `# Plan: {Feature Name}

## Overview
{Description}

## Features
1. {Feature 1}
2. {Feature 2}

## Technical Design
### API Endpoints
{endpoints}

### Database Changes
{schema}

### UI Components
{components}

## Test Cases
- {test case 1}
- {test case 2}
`
})
```

---

## Phase 3: Convert to TodoList

### Step 3.1: Create TodoList with Dependencies
```javascript
Write({
  file_path: "plans/{XX}-1-{feature-name}-todolist.md",
  content: `# TodoList: {Feature Name}

## Tasks with Dependencies

### Root Tasks (No Dependencies)
- [ ] Task 1: {description} [agent: backend-development:backend-architect] [deps: none]
- [ ] Task 2: {description} [agent: multi-platform-apps:frontend-developer] [deps: none]

### Dependent Tasks
- [ ] Task 3: {description} [agent: backend-development:backend-architect] [deps: Task 1]
- [ ] Task 4: {description} [agent: multi-platform-apps:frontend-developer] [deps: Task 2]
- [ ] Task 5: {description} [agent: full-stack-orchestration:test-automator] [deps: Task 3, Task 4]
`
})
```

---

## Phase 3.5: Pre-flight Environment Check (NEW)

> **Purpose**: Verify the environment is ready before starting implementation.
> Catches missing dependencies, broken toolchains, and missing config early.

### Step 3.5.1: Verify Core Toolchain

```bash
# Check Node.js exists
node --version || { echo "CRITICAL: Node.js not found - STOP"; exit 1; }

# Ensure packages installed
npm install 2>/dev/null

# Ensure Prisma client up-to-date (if prisma exists in project)
test -f "prisma/schema.prisma" && npx prisma generate 2>/dev/null
```

**If critical failure** (no Node, no npm): **STOP with clear error message**.
**If non-critical** (no prisma): **WARN and continue**.

### Step 3.5.2: Check Database Connectivity

```bash
# Only if project uses Prisma
if [ -f "prisma/schema.prisma" ]; then
  npx prisma db push --accept-data-loss 2>/dev/null || echo "WARNING: Database not ready (may not be needed in early phases)"
fi
```

### Step 3.5.3: Check Environment Files

```bash
test -f .env || echo "WARNING: Missing .env file"
test -f .env.test || echo "WARNING: Missing .env.test file (needed for integration tests)"
```

---

## Phase 4: Execute Tasks (with Retry Limits)

> **Reference**: See `.claude/kbs/scheduling-pattern.md` for retry policy details.

### Step 4.1: Group Tasks by Dependency Level
```
Batch 0: Tasks with no dependencies
Batch 1: Tasks depending only on Batch 0
Batch 2: Tasks depending on Batch 0 or 1
...
```

### Step 4.2: Execute Batches (Max 5-7 agents per batch)

For each batch:
```javascript
// Launch batch with Minimal Output Template
for (task of batch.tasks.slice(0, 7)) {
  Task({
    subagent_type: task.agent,
    prompt: `${task.description}

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list]

Do NOT include code snippets or detailed explanations.
---`,
    run_in_background: true
  })
}

// Poll until complete with RETRY LIMITS:
// - 1st failure: debugger agent
// - 2nd failure: specialist agent (different type)
// - 3rd failure: broader context agent
// - After 3rd: BLOCKED → skip task + all dependents
// Update todolist file (mark completed tasks)
// /compact before next batch
```

### Step 4.2.1: Post-Batch Auto-Install (NEW)
```bash
# Auto-install if new packages were added
npm install 2>/dev/null

# Auto-generate Prisma client if schema changed
git diff --name-only | grep -q "schema.prisma" && npx prisma generate 2>/dev/null
```

### Step 4.3: Update TodoList File
```javascript
// Mark completed tasks in the todolist file
Edit({
  file_path: "plans/{XX}-1-{feature-name}-todolist.md",
  old_string: "- [ ] Task 1:",
  new_string: "- [x] Task 1:"
})
```

---

## Phase 5: Test & Verify (with Enforcing Gates)

> **Reference**: See `.claude/kbs/scheduling-pattern.md` -> Retry Policy for fix attempt limits.

### Step 5.0: Setup Test Database & Seed Data

> **CRITICAL**: Seed data must exist before running integration or E2E tests.

```javascript
// Check if seed-test.ts exists
Read({ file_path: "prisma/seed-test.ts" })
```

**If missing**: Create seed data file with test constants.
See `.claude/kbs/test-writing-guide.md` -> Seed Data Guide.

```bash
# Reset test database and seed with known data
npx prisma migrate reset --force --skip-seed
npm run db:seed:test
```

### Step 5.1: Create/Update Integration Tests

Launch agent to create integration tests for new code (uses real DB, seed data):

```javascript
Task({
  subagent_type: "full-stack-orchestration:test-automator",
  prompt: `Create integration tests for the new code in {feature}.

  Requirements:
  - Use real database (not mocked PrismaService)
  - Import seed data from prisma/seed-test.ts (TEST_USERS, etc.)
  - File naming: *.integration.spec.ts
  - Follow patterns in .claude/kbs/test-writing-guide.md -> Integration Testing section
  - Test CRUD operations, auth flows, and edge cases with seed data

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]
  ---`,
  run_in_background: true
})
```

### Step 5.2: Create E2E Tests from User Stories

Parse user stories from requirement file and create Playwright tests:

```javascript
// Read requirement to extract user stories
Read({ file_path: "requirements/{XX}-{feature-name}.md" })

// Launch E2E test creation agent
Task({
  subagent_type: "full-stack-orchestration:test-automator",
  prompt: `Create Playwright E2E tests for {feature} based on user stories.

  User Stories:
  {list extracted user stories}

  Requirements:
  - Map each user story to an E2E test file: e2e/{feature}/{story}.spec.ts
  - Import TEST_USERS from prisma/seed-test.ts for credentials
  - Use Page Object Model pattern
  - Create global-setup.ts that seeds database (if not exists)
  - Follow patterns in .claude/kbs/test-writing-guide.md -> User Story to E2E Mapping
  - NEVER hardcode credentials like test@example.com / password123

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]
  ---`,
  run_in_background: true
})
```

### Step 5.3: Run Unit Tests (Enforcing Gate)
```bash
npm test -- --coverage
```

Fix loop: max 3 attempts (debugger -> specialist -> full analysis -> DEGRADED)
Update quality gate: `state.quality_gates.unit_tests = "passed" | "degraded"`

### Step 5.4: Run Integration Tests (Enforcing Gate)
```bash
npm run db:seed:test && npm test -- --testPathPattern="integration.spec"
```

Fix loop: max 3 attempts -> DEGRADED
Update quality gate: `state.quality_gates.integration_tests = "passed" | "degraded"`

### Step 5.5: Run E2E Tests (Enforcing Gate)
```bash
npm run db:seed:test && npx playwright test --project=chromium
```

Fix loop: max 3 attempts -> DEGRADED
Update quality gate: `state.quality_gates.e2e_tests = "passed" | "degraded"`

### Step 5.6: Smoke Test (MANDATORY) with Auto-Fix Protocols

```bash
npm run dev &
sleep 15
curl -f http://localhost:{API_PORT}/api/health
curl -f http://localhost:{WEB_PORT}
```

**Auto-Fix Protocols** (when smoke test fails):

| Error Pattern | Auto-Fix Action |
|---------------|----------------|
| `Nest can't resolve dependencies` | Launch `backend-development:backend-architect`: "Fix DI error" |
| `Cannot find module` | Run `npm install` |
| `ECONNREFUSED :5432` | **STOP**: "Database not running" |
| `Module not found` | Launch `backend-development:backend-architect`: "Fix import path" |
| Build type errors | Launch `javascript-typescript:typescript-pro`: "Fix TS errors" |
| Lint errors | Run `npx eslint --fix src/` |

Max 2 smoke retries, then DEGRADED.
Update quality gate: `state.quality_gates.smoke_test = "passed" | "degraded"`

### Step 5.7: Full-Stack Verification

Verify all 3 test levels pass:
```bash
# Unit tests (mocked dependencies)
npm test -- --coverage

# Integration tests (real database + seed data)
npm run db:seed:test && npm test -- --testPathPattern="integration.spec"

# E2E tests (full browser + seed data)
npm run db:seed:test && npx playwright test --project=chromium
```

Coverage targets:
- Unit tests: 80%+ coverage
- Integration tests: Key services covered
- E2E tests: All user stories have corresponding test files

---

## Phase 6: UAT Testing (NEW)

> **Purpose**: Automated User Acceptance Testing validates that implemented features meet user stories and requirements.

### Step 6.1: Run Full Automated Test Suite as UAT

```bash
# Unit tests with coverage
npm test -- --coverage --passWithNoTests

# Integration tests with seed data
npm run db:seed:test && npm test -- --testPathPattern="integration.spec" --passWithNoTests

# E2E tests with seed data
npm run db:seed:test && npx playwright test --project=chromium
```

### Step 6.2: User Story to E2E Traceability Check

```javascript
// Extract user stories from requirement/plan files
Glob({ pattern: "requirements/*.md" })
Glob({ pattern: "plans/*-plan.md" })

// List E2E test files
Glob({ pattern: "e2e/**/*.spec.ts" })

// Create traceability report
// If gaps: Launch test-automator to create missing tests (max 1 attempt)
```

### Step 6.3: Anti-Mock Check

```javascript
// Grep for suspicious patterns (mocking the module under test)
Grep({ pattern: "jest.mock.*module-under-test", glob: "**/*.spec.ts" })

// If found: Launch agent to create proper integration tests
```

### Step 6.4: Create UAT Report

Location: `docs/reports/{yyyyMMddHHmm}-{module}-uat-report.md`
Contents: test results, traceability matrix, coverage stats, UAT decision

Update quality gate: `state.quality_gates.uat = "passed"`

### Step 6.5: Compact Before QA Phase

```
/compact
```

---

## Phase 7: QA Review & Approval (NEW)

> **Purpose**: Automated code quality and security review with fix cycles.

### Step 7.1: Code Quality Review (Batch - max 3 agents, background)

```javascript
// Launch review agents:
// - backend-architect: error handling, API design, DB queries, validation
// - frontend-developer: component patterns, a11y, state management
// - typescript-pro: type safety, generics, no 'any', interface consistency
```

Compact after batch completes.

### Step 7.2: Security Review (Batch - max 2 agents, background)

```javascript
// Launch security review agents:
// - security-auditor: Auth/AuthZ review
// - security-auditor: OWASP Top 10 check
```

Compact after batch completes.

### Step 7.3: Compile Findings

Categorize all findings:
- **CRITICAL**: Must fix before approval (security vulnerabilities, data loss risks)
- **MAJOR**: Should fix (poor patterns, missing validation, accessibility issues)
- **MINOR**: Nice to fix (code style, minor improvements)

### Step 7.4: Decision Gate

```javascript
if (noCriticalOrMajorIssues) {
  state.quality_gates.qa_review = "approved"
} else {
  // Enter QA fix cycle (max 2 cycles)
  // Launch fix agents for each critical/major issue
  // Re-run affected tests
  // Re-evaluate
  // After 2 cycles still failing: DEGRADED
}
```

### Step 7.5: Create QA Report

Location: `docs/reports/{yyyyMMddHHmm}-{module}-qa-report.md`
Contents: all findings, test results, security checklist, quality gates summary, blocked tasks, degraded phases, decision

---

## Phase 8: Completion

### Step 8.1: Create Completion Report
```javascript
Write({
  file_path: "docs/reports/{yyyyMMddHHmm}-{feature}-completion.md",
  content: `# Implementation Complete: {Feature Name}

## Summary
- Type: {feature | fix | enhancement}
- Module: {XX}-1-{feature-name}
- Status: COMPLETE
- QA Decision: APPROVED / DEGRADED

## Files Created/Modified
{list of files}

## Quality Gates
| Gate | Status |
|------|--------|
| Unit Tests | passed/degraded |
| Integration Tests | passed/degraded |
| E2E Tests | passed/degraded |
| Smoke Test | passed/degraded |
| UAT | passed |
| QA Review | approved/degraded |

## Tests
- Unit Tests: {X} passing
- Integration Tests: {X} passing (real DB + seed data)
- E2E Tests: {X} passing (user story-driven)
- Coverage: {X}%

## User Story -> E2E Coverage
- Total User Stories: {X}
- E2E Tests Created: {X}
- Coverage: {X}%

## Blocked Tasks
{list or None}

## Degraded Phases
{list or None}

## Smoke Test
- API Health: PASS
- Frontend: PASS
`
})
```

### Step 8.2: Final Commit
```bash
git add .
git commit -m "{type}({module}): implement {feature-name} with UAT+QA approval"
```

### Step 8.3: Mark State Complete
```bash
jq --arg ts "$(date -Iseconds)" '
  .status = "completed" |
  .updated_at = $ts |
  .resume_point = { "batch_id": null, "task_id": null, "phase": null } |
  .logs += [{"timestamp": $ts, "level": "info", "message": "Full pipeline completed (dev + UAT + QA)"}]
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

---

## Quick Reference

```
Phase 1:   Create Requirement
Phase 2:   Plan Module (parallel agents)
Phase 3:   Convert to TodoList
Phase 3.5: Pre-flight Check (node, npm, prisma, env)
Phase 4:   Execute (batch + minimal output + retry limits + compact)
Phase 5.0: Seed Data Setup
Phase 5.1: Integration Tests (real DB)
Phase 5.2: E2E Tests (user story -> Playwright)
Phase 5.3-5.5: Unit -> Integration -> E2E test runs (enforcing gates, max 3 fixes)
Phase 5.6: Smoke Test (MANDATORY) + Auto-Fix Protocols (max 2 retries)
Phase 5.7: Full-Stack Verification
Phase 6:   UAT (full test suite + traceability + anti-mock) -> Report -> /compact
Phase 7:   QA Review (code quality + security) -> Fix Cycles (max 2) -> Report
Phase 8:   Complete (report + commit)
```

### Retry Limits Summary

| Scope | Max Retries | Escalation |
|-------|-------------|------------|
| Task implementation | 3 per task | debugger -> specialist -> broad context -> BLOCKED |
| Test phase fix loop | 3 per phase | debugger -> specialist -> full analysis -> DEGRADED |
| Smoke test auto-fix | 2 | pattern-match fix -> DEGRADED |
| QA review cycles | 2 | fix + re-test -> DEGRADED |

## After Completion

1. Requirement file created
2. Plan file created
3. TodoList created and all tasks marked complete
4. Pre-flight environment verified
5. All tests passing (with enforcing gates)
6. Smoke test passed (with auto-fix if needed)
7. UAT testing complete with traceability report
8. QA review complete (code quality + security)
9. QA report: APPROVED / DEGRADED
10. Completion report created
11. All changes committed
12. Production-grade pipeline complete
