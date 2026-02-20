---
name: execute
description: Execute todolist(s) by orchestrating specialized agents
argument-hint: <todolist-file|master-todolist> [--resume]
model: opus
arguments:
  - name: resume
    description: Resume from previous execution state (true/false)
    required: false
    default: "false"
---

You are a highly skilled **Team Lead** with expertise in assigning tasks to the right specialists.

## Your Mission

Execute todolist(s) by orchestrating specialized Claude Code subagents with **context-aware batch execution**, **integrated testing phases**, and **fully autonomous UAT + QA pipeline**. This command drives the entire lifecycle from implementation through production-grade completion.

## Input Types

This command handles TWO input types:

### Type 1: Master TodoList (`00-master-todolist.md`)
When given `plans/00-master-todolist.md`:
- Read the master todolist
- Find all pending todolists in order
- Execute each todolist sequentially
- Update master progress after each

### Type 2: Individual TodoList (`X-X-module-todolist.md`)
When given a specific todolist file:
- Execute only that todolist
- Update its progress
- Update master todolist if exists

---

## Master TodoList Mode

### Step 0: Detect Input Type

```javascript
Read({ file_path: "$ARGUMENTS" })

// Check if this is the master todolist
if (filename.includes("00-master-todolist")) {
  // MASTER MODE: Execute all pending todolists
} else {
  // SINGLE MODE: Execute one todolist
}
```

### Master Mode Process

```javascript
// 1. Parse master todolist to find pending entries
// Look for rows with status "pending" or "in_progress"

// 2. For each pending todolist:
for (todolist of pendingTodolists) {
  console.log(`\n📋 Executing: ${todolist.file}\n`)

  // Execute the individual todolist
  // (use the same Phase 0-7 process below)

  // After completion, update master:
  Edit({
    file_path: "plans/00-master-todolist.md",
    old_string: `| X | ${todolist.plan} | ${todolist.file} | pending |`,
    new_string: `| X | ${todolist.plan} | ${todolist.file} | completed |`
  })

  // Compact before next todolist
  console.log("/compact")
}
```

### Master TodoList Format Expected

```markdown
## Plans & Todolists

| # | Plan File | TodoList File | Status | Progress |
|---|-----------|---------------|--------|----------|
| 1 | 1-1-bird-physics-plan.md | 1-1-bird-physics-todolist.md | pending | 0% |
| 2 | 1-2-pipes-plan.md | 1-2-pipes-todolist.md | pending | 0% |

## Execution Order

1. [ ] 1-1-bird-physics-todolist.md
2. [ ] 1-2-pipes-todolist.md
```

---

## Individual TodoList Execution

## State Management

This command supports **state tracking** and **resume** capability.

### State File
- Location: `.claude/rw-kit.state.json`
- Version: 3.0.0 (with retry, quality gates, UAT/QA tracking)
- Tracks: tasks, batches, progress, retry counts, quality gates, blocked tasks, degraded phases, resume point
- Reference: `.claude/skills/state-manager.md`

### Resume Mode
If `--resume` is passed or state file exists with `status: "running"`:
1. Load existing state from `.claude/rw-kit.state.json`
2. Find resume point (last incomplete batch/task/phase)
3. Skip completed tasks and phases
4. Continue from where it stopped

### Auto-Answer
Hooks in `.claude/hooks/` will automatically:
- Answer confirmations with "yes"
- Select "(Recommended)" options
- Track progress in state file
- Reference: `.claude/kbs/auto-answer-guide.md`

---

## Context Management (CRITICAL)

> **PROBLEM**: Running many parallel agents causes main context to fill up quickly.
> **SOLUTION**: Use batch-based execution with compaction between batches.
>
> **Reference**: See `.claude/kbs/scheduling-pattern.md` for full details.

### Context Rules
1. **Maximum 5-7 agents per batch** - prevents context overflow
2. **Compact after each batch** - use `/compact` to free context
3. **Minimize agent output** - tell agents to reply "DONE" only (see Minimal Output Template below)
4. **Use subagents** - each agent has isolated context
5. **Verify via files** - check created files instead of parsing agent output

### Minimal Output Template (MUST USE)

**CRITICAL**: Always append this to EVERY subagent prompt to prevent context bloat:

```
---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list of files created/modified]

Do NOT include:
- Code snippets
- Full file contents
- Detailed explanations
- Logs or debug output
---
```

**Why?** Without this, a single agent can return 500+ lines of output, filling main context quickly.
With this template, each agent returns ~50 tokens instead of ~5,000-20,000 tokens.

## Core Principles

### 1. You Are the Orchestrator
- You assign tasks to specialized agents
- You monitor progress and handle blockers
- You ensure quality and completeness
- Use subagents to do the implementation

### 2. Use the Right Agent for Each Task

| Task Type | Agent | Example |
|-----------|-------|---------|
| Database/Prisma | `backend-development:backend-architect` | "Update Prisma schema..." |
| API/NestJS | `backend-development:backend-architect` | "Create REST endpoint..." |
| UI/React/Next.js | `multi-platform-apps:frontend-developer` | "Build React component..." |
| Security Review | `full-stack-orchestration:security-auditor` | "Review auth security..." |
| Unit Tests | `full-stack-orchestration:test-automator` | "Write Jest tests..." |
| E2E Tests | `full-stack-orchestration:test-automator` | "Write Playwright tests..." |
| Performance | `full-stack-orchestration:performance-engineer` | "Optimize queries..." |
| TypeScript | `javascript-typescript:typescript-pro` | "Fix type errors..." |
| Debugging | `unit-testing:debugger` | "Debug failing test..." |
| Code Search | `Explore` | "Find auth implementations..." |

### 3. Always Read Existing Code First
Before implementing ANY task:
1. **Use Explore agent**: Search for existing implementations
2. **Check for duplicates**: Look for similar functionality
3. **Follow patterns**: Maintain consistency with existing code

---

## 3-Layer Task Completion Detection

> **PROBLEM**: Agent says "DONE" but files may not exist or be incomplete.
> **SOLUTION**: 3-layer verification ensures task is truly complete.

### Layer 1: Agent Output Pattern (Automatic via Hook)
- Hook: `.claude/hooks/progress-tracker.json`
- Detects: "DONE:", "Files:", "completed", task IDs
- Updates: `state.json` with `verification.agent_done = true`

### Layer 2: File Existence Verification (Automatic via Hook)
- Hook: `.claude/hooks/file-verification.json`
- Checks: Expected files from task `[files: ...]` metadata
- Uses: Glob to verify files exist
- Updates: `state.json` with `verification.files_exist = true`

### Layer 3: State Cross-Check (Manual in Orchestrator)
- Verify: TodoList checkboxes match state.json status
- Verify: All 3 verification flags are true
- Update: Final confirmation of completion

### Verification Status in State

```json
{
  "tasks": {
    "T001": {
      "status": "completed",
      "verification": {
        "agent_done": true,
        "files_exist": true,
        "state_synced": true
      }
    }
  }
}
```

### Task Completion Flow

```
Agent returns "DONE: Created auth service"
    |
    v Layer 1 (Hook)
progress-tracker.json detects pattern
    -> Sets verification.agent_done = true
    |
    v Layer 2 (Hook)
file-verification.json runs on next Glob
    -> Checks expected files exist
    -> Sets verification.files_exist = true
    |
    v Layer 3 (Orchestrator)
execute.md verifies state consistency
    -> Updates todolist checkbox
    -> Sets verification.state_synced = true
    |
    v
Task TRULY complete (all 3 layers passed)
```

### Handling Incomplete Tasks

If Layer 2 fails (files not found):
1. Log warning: "Agent reported DONE but files not created"
2. Keep task as "in_progress" (don't mark complete)
3. Launch fix agent to investigate

If Layer 3 fails (state mismatch):
1. Reconcile state.json with todolist
2. Re-verify with Glob check
3. Update both if discrepancy found

---

## Execution Process (10 Phases)

### Phase 0: State Initialization

#### Step 0.1: Check Resume Mode
```bash
# Check if resuming from existing state
if [ "$RESUME" = "true" ] && [ -f ".claude/rw-kit.state.json" ]; then
  status=$(jq -r '.status' .claude/rw-kit.state.json)
  if [ "$status" = "running" ] || [ "$status" = "paused" ]; then
    echo "Resuming from existing state..."
    # Load resume point
    resume_batch=$(jq -r '.resume_point.batch_id // empty' .claude/rw-kit.state.json)
    resume_task=$(jq -r '.resume_point.task_id // empty' .claude/rw-kit.state.json)
    resume_phase=$(jq -r '.resume_point.phase // empty' .claude/rw-kit.state.json)
    echo "Resume from: Phase $resume_phase, Batch $resume_batch, Task $resume_task"
  fi
else
  echo "Starting fresh execution..."
fi
```

#### Step 0.2: Initialize State File
```bash
# Create new state if not resuming
session_id="exec-$(date +%Y%m%d-%H%M%S)"
ts=$(date -Iseconds)
todolist_path="$ARGUMENTS"

jq --arg sid "$session_id" --arg ts "$ts" --arg todolist "$todolist_path" --arg path "$(pwd)" '
  .session_id = $sid |
  .started_at = $ts |
  .updated_at = $ts |
  .status = "running" |
  .config.todolist_path = $todolist |
  .config.project_path = $path
' .claude/templates/state-template.json > .claude/rw-kit.state.json

echo "State file created: .claude/rw-kit.state.json"
```

---

### Phase 0.5: Pre-flight Environment Check (NEW)

> **Purpose**: Verify the environment is ready before starting implementation.
> Catches missing dependencies, broken toolchains, and missing config early.

#### Step 0.5.1: Verify Core Toolchain

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

#### Step 0.5.2: Check Database Connectivity

```bash
# Only if project uses Prisma
if [ -f "prisma/schema.prisma" ]; then
  npx prisma db push --accept-data-loss 2>/dev/null || echo "WARNING: Database not ready (may not be needed in early phases)"
fi
```

If `DB_NOT_READY`: warn but continue (may not need DB until testing phases).

#### Step 0.5.3: Check Environment Files

```bash
test -f .env || echo "WARNING: Missing .env file"
test -f .env.test || echo "WARNING: Missing .env.test file (needed for integration tests)"
```

#### Step 0.5.4: Update State

```bash
jq --arg ts "$(date -Iseconds)" '
  .resume_point.phase = "preflight" |
  .updated_at = $ts |
  .logs += [{"timestamp": $ts, "level": "info", "message": "Pre-flight checks completed"}]
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

---

### Phase 1: Parse & Plan

#### Step 1.1: Read TodoList
```javascript
Read("$ARGUMENTS")
```

#### Step 1.2: Parse Tasks and Check Status
For each task in the todolist:
1. Check if task is already marked as `[x]` or completed → **SKIP**
2. Check if task is marked as `[ ]` or pending → **PENDING** (will execute)
3. Check if task is in `blocked_tasks[]` in state → **SKIP** (already blocked)

#### Step 1.3: Verify Implementation (Batch - Max 3 agents)
Before executing pending tasks, verify if code already exists:
```javascript
Task(subagent_type: "Explore",
  prompt: "Check if these features are already implemented: [list pending tasks]. Return which tasks already have working code.",
  run_in_background: true)
```

#### Step 1.4: Validate Task Sizes (150k Token Budget)

> **Reference**: See `.claude/kbs/task-sizing-guide.md` for full details.

For each pending task, check the `[size: S|M]` tag:
- **S or M**: OK — proceed
- **L**: Warning — consider splitting before execution
- **XL or no size tag**: Split the task into smaller ones before proceeding

**Quick validation**: Count `[files: ...]` for each task. If a task lists more than 5 output files, it's likely too large.

If tasks need splitting:
1. Break Large task into 2-3 Medium tasks
2. Update the todolist file with new tasks
3. Re-assign dependencies

#### Step 1.5: Group Pending Tasks into Batches (Parallel-Optimized)

Group **only pending tasks** by dependency level:
- **Batch 0**: Tasks with no dependencies (root tasks — schema, shared types)
- **Batch 1**: Tasks depending only on Batch 0 (independent implementations — MAX PARALLEL)
- **Batch 2**: Tasks depending only on Batch 0 or 1
- Continue until all tasks are assigned

**Parallel optimization rules**:
- Max **5-7 tasks** per batch
- If a batch has only 1 task, consider if its dependency can be relaxed
- Backend and frontend tasks with shared-type-only dependency can run in the same batch
- **Parallelism ratio** target: total_tasks / total_batches ≥ 3

#### Step 1.6: Compact After Planning
```
Planning Summary:
- Total tasks: X
- Already completed: Y (skipped)
- Pending tasks: Z
- Batches created: N
- Parallelism ratio: {tasks/batches}
- Tasks needing split: [list or "none"]

/compact
```

### Phase 2: Batch Implementation

> **Reference**: See `.claude/kbs/scheduling-pattern.md` for retry policy details.

For EACH batch:

#### Step 2.1: Launch Batch (Max 5-7 agents)

> **Token budget**: Each agent has ~150k usable tokens. Control file-reading by specifying exactly which files to read.

```javascript
// Launch ALL tasks in current batch with MINIMAL OUTPUT template
// IMPORTANT: List specific files to read — don't let agent explore freely
Task(subagent_type: "backend-development:backend-architect", prompt: `
  Task 1: Create auth endpoints

  Read these files first (for context/patterns):
  - apps/api/src/app.module.ts (module structure)
  - packages/database/schema.prisma (current schema)

  Requirements:
  - POST /auth/register
  - POST /auth/login

  Output files (max 5):
  - apps/api/src/auth/auth.controller.ts
  - apps/api/src/auth/auth.service.ts
  - apps/api/src/auth/auth.module.ts

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]

  Do NOT include code snippets or detailed explanations.
  ---
`, run_in_background: true)
```

#### Step 2.2: Poll Until Batch Complete (with Retry Limits)
```javascript
while (batchTasksRunning) {
  for (agent of batchAgents) {
    result = TaskOutput(agent.id, block: false)
    if (result.completed) {
      // Record: Task X completed
      // DON'T parse full output - verify via files instead:
      Glob({ pattern: "apps/api/src/auth/*.ts" })
    }
    if (result.failed) {
      retryCount = state.retry_counts[task.id] || 0
      retryCount++

      if (retryCount === 1) {
        // Attempt 1: Launch debugger agent
        Task(subagent_type: "unit-testing:debugger",
          prompt: "Fix: [error details]...",
          run_in_background: true)
      } else if (retryCount === 2) {
        // Attempt 2: Launch different specialist agent
        Task(subagent_type: getSpecialistAgent(task),
          prompt: "Fix: [error details with more context]...",
          run_in_background: true)
      } else if (retryCount === 3) {
        // Attempt 3: Launch with broader context
        Task(subagent_type: getSpecialistAgent(task),
          prompt: "Fix with full context: [error + surrounding code + dependencies]...",
          run_in_background: true)
      } else {
        // BLOCKED: Skip task and all dependents
        state.blocked_tasks.push(task.id)
        state.progress.blocked++
        skipDependentTasks(task.id)
        log(`BLOCKED: Task ${task.id} failed after 3 retries`)
      }

      state.retry_counts[task.id] = retryCount
    }
  }
}
```

#### Step 2.2.1: Post-Batch Auto-Install (NEW)
```bash
# Auto-install if new packages were added
npm install 2>/dev/null

# Auto-generate Prisma client if schema changed
git diff --name-only | grep -q "schema.prisma" && npx prisma generate 2>/dev/null
```

#### Step 2.3: Update TodoList File (CRITICAL)
After each task completes, **immediately update the todolist file**:
```javascript
Edit({
  file_path: "$ARGUMENTS",
  old_string: "- [ ] Task X description",
  new_string: "- [x] Task X description"
})
```

#### Step 2.4: Update State & Compact Before Next Batch

**Update state file after batch completes:**
```bash
# Mark batch as completed
jq --argjson bid $BATCH_ID --arg ts "$(date -Iseconds)" '
  .batches[$bid].status = "completed" |
  .batches[$bid].completed_at = $ts |
  .batches[$bid].compacted = true |
  .current_batch = null |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json

# Set resume point for next batch
jq --argjson next_bid $((BATCH_ID + 1)) --arg ts "$(date -Iseconds)" '
  .resume_point.batch_id = $next_bid |
  .resume_point.phase = "implementation" |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

**Report blocked tasks if any:**
```
Batch N Summary:
- Completed: X tasks
- Blocked: Y tasks (exhausted 3 retries)
- Blocked tasks: [T003, T007]

State Updated: .claude/rw-kit.state.json
TodoList Updated: $ARGUMENTS

Use /compact to compress context before next batch
```

---

### Phase 2.5: Seed Data Setup

> **CRITICAL**: Seed data must be ready before running integration or E2E tests.

#### Step 2.5.1: Verify Seed Data Exists

```javascript
// Check if seed-test.ts exists
Read({ file_path: "prisma/seed-test.ts" })
```

**If missing**: Launch agent to create seed data file:
```javascript
Task({
  subagent_type: "backend-development:backend-architect",
  prompt: `Create test seed data file at prisma/seed-test.ts.

  Requirements:
  - Export TEST_USERS constant with standard, admin, and empty users
  - Export seedTestDatabase(prisma) function using upsert for idempotency
  - Export cleanupTestDatabase(prisma) function
  - Follow patterns in .claude/kbs/test-writing-guide.md -> Seed Data Guide

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]
  ---`,
  run_in_background: true
})
```

#### Step 2.5.2: Reset and Seed Test Database

```bash
# Reset test database
npx prisma migrate reset --force --skip-seed

# Seed with known test data
npm run db:seed:test

echo "Test database seeded with known data"
```

#### Step 2.5.3: Verify Seed Data

```bash
# Quick verification - check seed ran without errors
echo "Seed data ready for integration and E2E tests"
```

---

### Phase 3: Unit & Integration Testing (with Enforcing Gate)

> **Reference**: See `.claude/kbs/scheduling-pattern.md` -> Retry Policy for fix attempt limits.

After ALL implementation batches complete:

#### Step 3.1: Run Unit Tests
```bash
npm test -- --coverage --passWithNoTests
```

- If **ALL PASS**: Update quality gate and continue to integration tests
- If **FAILURES**: Enter fix loop (max 3 attempts)

#### Step 3.2: Unit Test Fix Loop (Enforcing Gate)

```javascript
fixAttempts = 0
maxFixAttempts = 3

while (unitTestsFailing && fixAttempts < maxFixAttempts) {
  fixAttempts++

  if (fixAttempts === 1) {
    // Attempt 1: Debugger agent
    Task(subagent_type: "unit-testing:debugger",
      prompt: "Fix failing unit tests: [failure details]...",
      run_in_background: true)
  } else if (fixAttempts === 2) {
    // Attempt 2: Specialist agent
    Task(subagent_type: "backend-development:backend-architect",
      prompt: "Fix failing unit tests with broader context: [failure details + test files + source files]...",
      run_in_background: true)
  } else {
    // Attempt 3: Agent with full context
    Task(subagent_type: "javascript-typescript:typescript-pro",
      prompt: "Fix failing unit tests - full analysis needed: [all failure details + related code]...",
      run_in_background: true)
  }

  // Re-run tests
  // npm test -- --coverage --passWithNoTests
}

if (unitTestsFailing) {
  // Mark phase as DEGRADED - continue pipeline
  state.degraded_phases.push("unit_tests")
  state.quality_gates.unit_tests = "degraded"
  log("DEGRADED: Unit tests still failing after 3 fix attempts - continuing pipeline")
} else {
  state.quality_gates.unit_tests = "passed"
}
```

#### Step 3.3: Run Integration Tests

```bash
npm run db:seed:test && npm test -- --testPathPattern="integration.spec" --passWithNoTests
```

- If **integration tests don't exist**: Launch agent to create them:
```javascript
Task({
  subagent_type: "full-stack-orchestration:test-automator",
  prompt: `Create integration tests for the implemented features.

  Requirements:
  - Use real database (not mocked PrismaService)
  - Import seed data from prisma/seed-test.ts (TEST_USERS, etc.)
  - File naming: *.integration.spec.ts (co-located with source)
  - Follow patterns in .claude/kbs/test-writing-guide.md -> Integration Testing

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]
  ---`,
  run_in_background: true
})
```

- If **FAILURES**: Apply same fix loop as unit tests (max 3 attempts)
- Update quality gate: `state.quality_gates.integration_tests = "passed" | "degraded"`

---

### Phase 4: E2E Testing with Seed Data (with Enforcing Gate)

> **IMPORTANT**: E2E tests must use seed data and trace to user stories.

#### Step 4.1: Ensure Database is Seeded
```bash
npm run db:seed:test
```

#### Step 4.2: Run E2E Tests
```bash
npx playwright test --project=chromium
```

#### Step 4.3: Verify User Story Coverage
```javascript
// Check that E2E tests exist for all user stories
Glob({ pattern: "e2e/**/*.spec.ts" })
Glob({ pattern: "requirements/*.md" })

// Compare: each user story should have a corresponding E2E test
```

- If **E2E tests don't exist or miss user stories**: Launch agent to create them:
```javascript
Task({
  subagent_type: "full-stack-orchestration:test-automator",
  prompt: `Create E2E tests for missing user stories.

  Requirements:
  - Map each user story to e2e/{feature}/{story}.spec.ts
  - Import TEST_USERS from prisma/seed-test.ts
  - Use Page Object Model pattern
  - NEVER hardcode credentials
  - Follow patterns in .claude/kbs/test-writing-guide.md -> User Story to E2E Mapping

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]
  ---`,
  run_in_background: true
})
```

#### Step 4.4: E2E Fix Loop (Enforcing Gate)

Same pattern as Phase 3: max 3 fix attempts, then DEGRADED.

- Update quality gate: `state.quality_gates.e2e_tests = "passed" | "degraded"`

---

### Phase 5: Quality Check (with Auto-Fix Protocols)

#### Step 5.1: Smoke Test (MANDATORY)

> **CRITICAL**: Build passing does not mean application works! Must verify runtime startup.

```bash
npm run dev &
sleep 15

# Verify API starts without DI errors
curl -f http://localhost:{API_PORT}/api/health || echo "API FAILED"

# Verify Frontend responds
curl -f -o /dev/null http://localhost:{WEB_PORT} || echo "FRONTEND FAILED"

echo "Smoke test passed!"
```

#### Step 5.2: Auto-Fix Protocols (NEW)

When smoke test fails, check error type and auto-fix:

| Error Pattern | Auto-Fix Action |
|---------------|----------------|
| `Nest can't resolve dependencies` | Launch `backend-development:backend-architect`: "Fix DI error: add missing module import" |
| `Cannot find module` | Run `npm install` |
| `ECONNREFUSED :5432` | **STOP**: "Database not running - cannot auto-fix" |
| `Module not found` | Launch `backend-development:backend-architect`: "Fix import path" |
| Build type errors | Launch `javascript-typescript:typescript-pro`: "Fix TypeScript errors" |
| Lint errors | Run `npx eslint --fix src/` |

```javascript
smokeRetries = 0
maxSmokeRetries = 2

while (smokeTestFailing && smokeRetries < maxSmokeRetries) {
  smokeRetries++
  // Match error pattern and apply auto-fix
  applyAutoFix(errorPattern)
  // Re-run smoke test
}

if (smokeTestFailing) {
  state.degraded_phases.push("smoke_test")
  state.quality_gates.smoke_test = "degraded"
  log("DEGRADED: Smoke test failing after auto-fix attempts")
} else {
  state.quality_gates.smoke_test = "passed"
}
```

#### Step 5.3: Run All Static Checks
```bash
npm run build        # Build check
npm run typecheck    # TypeScript check (if available)
npm run lint         # ESLint check
```

#### Step 5.4: Compact Before UAT
```
Quality Check Summary:
- Smoke test: PASSED / DEGRADED
- Build: PASSED
- TypeScript: PASSED
- Lint: PASSED

/compact
```

---

### Phase 6: UAT Testing (NEW)

> **Purpose**: Automated User Acceptance Testing validates that implemented features meet user stories and requirements.

#### Step 6.1: Run Full Automated Test Suite as UAT

```bash
# Unit tests with coverage
npm test -- --coverage --passWithNoTests

# Integration tests with seed data
npm run db:seed:test && npm test -- --testPathPattern="integration.spec" --passWithNoTests

# E2E tests with seed data
npm run db:seed:test && npx playwright test --project=chromium
```

#### Step 6.2: User Story to E2E Traceability Check

```javascript
// Extract user stories from requirement/plan files
Glob({ pattern: "requirements/*.md" })
Glob({ pattern: "plans/*-plan.md" })

// List E2E test files
Glob({ pattern: "e2e/**/*.spec.ts" })

// Create traceability report:
// | User Story | E2E Test File | Status |
// |------------|---------------|--------|
// | US-001: User can register | e2e/auth/register.spec.ts | COVERED |
// | US-002: User can login | e2e/auth/login.spec.ts | COVERED |
// | US-003: User can reset password | - | MISSING |

// If gaps found: Launch test-automator to create missing tests (max 1 attempt)
if (missingCoverage) {
  Task({
    subagent_type: "full-stack-orchestration:test-automator",
    prompt: `Create E2E tests for uncovered user stories: [list missing stories]

    ---
    RESPONSE FORMAT (CRITICAL):
    When complete, respond with ONLY:
    DONE: [1-2 sentence summary]
    Files: [comma-separated list]
    ---`,
    run_in_background: true
  })
}
```

#### Step 6.3: Anti-Mock Check

```javascript
// Grep for suspicious patterns (mocking the module under test)
Grep({ pattern: "jest.mock.*module-under-test", glob: "**/*.spec.ts" })
Grep({ pattern: "jest.mock\\(.*\\).*// mocking itself", glob: "**/*.spec.ts" })

// If found: Launch agent to create proper integration tests
if (suspiciousMocks) {
  Task({
    subagent_type: "full-stack-orchestration:test-automator",
    prompt: `Replace suspicious test mocks with proper integration tests.
    Found mocking patterns that mock the module under test instead of external deps.

    ---
    RESPONSE FORMAT (CRITICAL):
    When complete, respond with ONLY:
    DONE: [1-2 sentence summary]
    Files: [comma-separated list]
    ---`,
    run_in_background: true
  })
}
```

#### Step 6.4: Create UAT Report

```javascript
Write({
  file_path: "docs/reports/{yyyyMMddHHmm}-{module}-uat-report.md",
  content: `# UAT Report: {Module Name}

## Test Results Summary
| Test Level | Total | Passed | Failed | Coverage |
|-----------|-------|--------|--------|----------|
| Unit Tests | X | X | 0 | 85% |
| Integration Tests | X | X | 0 | Key services |
| E2E Tests | X | X | 0 | 100% stories |

## User Story Traceability
| User Story | E2E Test | Status |
|------------|----------|--------|
{traceability matrix}

## Anti-Mock Check
- Suspicious mocks found: {count}
- Fixed: {yes/no}

## UAT Decision
- [ ] PASSED - All criteria met
- [ ] NEEDS ATTENTION - See degraded items
`
})
```

#### Step 6.5: Update State & Compact

```bash
jq --arg ts "$(date -Iseconds)" '
  .quality_gates.uat = "passed" |
  .resume_point.phase = "uat" |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

```
/compact
```

---

### Phase 7: QA Review & Approval (NEW)

> **Purpose**: Automated code quality and security review with fix cycles.

#### Step 7.1: Code Quality Review (Batch - max 3 agents, background)

```javascript
Task({
  subagent_type: "backend-development:backend-architect",
  prompt: `Review backend code quality for {module}:
  - Error handling patterns
  - API design consistency
  - Database query efficiency
  - Input validation

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  FINDINGS: [categorized list: CRITICAL/MAJOR/MINOR]
  Files: [files with issues]
  ---`,
  run_in_background: true
})

Task({
  subagent_type: "multi-platform-apps:frontend-developer",
  prompt: `Review frontend code quality for {module}:
  - Component patterns
  - Accessibility (a11y)
  - State management
  - Performance patterns

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  FINDINGS: [categorized list: CRITICAL/MAJOR/MINOR]
  Files: [files with issues]
  ---`,
  run_in_background: true
})

Task({
  subagent_type: "javascript-typescript:typescript-pro",
  prompt: `Review TypeScript usage for {module}:
  - Type safety
  - Proper use of generics
  - No 'any' types without justification
  - Interface/type consistency

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  FINDINGS: [categorized list: CRITICAL/MAJOR/MINOR]
  Files: [files with issues]
  ---`,
  run_in_background: true
})
```

Compact after batch completes.

#### Step 7.2: Security Review (Batch - max 2 agents, background)

```javascript
Task({
  subagent_type: "full-stack-orchestration:security-auditor",
  prompt: `Review authentication and authorization for {module}:
  - Auth flow correctness
  - Token handling
  - Permission checks
  - Session management

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  FINDINGS: [categorized list: CRITICAL/MAJOR/MINOR]
  Files: [files with issues]
  ---`,
  run_in_background: true
})

Task({
  subagent_type: "full-stack-orchestration:security-auditor",
  prompt: `OWASP Top 10 review for {module}:
  - SQL Injection
  - XSS
  - CSRF
  - Insecure Direct Object References
  - Security Misconfiguration

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  FINDINGS: [categorized list: CRITICAL/MAJOR/MINOR]
  Files: [files with issues]
  ---`,
  run_in_background: true
})
```

Compact after batch completes.

#### Step 7.3: Compile Findings

Categorize all findings from review agents:
- **CRITICAL**: Must fix before approval (security vulnerabilities, data loss risks)
- **MAJOR**: Should fix (poor patterns, missing validation, accessibility issues)
- **MINOR**: Nice to fix (code style, minor improvements)

#### Step 7.4: Decision Gate

```javascript
if (noCriticalOrMajorIssues) {
  // APPROVED
  state.quality_gates.qa_review = "approved"
} else {
  // NEEDS FIXES - enter QA fix cycle
  qaCycle = 0
  maxQACycles = 2

  while (hasCriticalOrMajorIssues && qaCycle < maxQACycles) {
    qaCycle++
    state.qa_cycles = qaCycle

    // Launch fix agents for each critical/major issue (background)
    for (issue of criticalAndMajorIssues) {
      Task({
        subagent_type: getFixAgent(issue),
        prompt: `Fix QA issue: ${issue.description}

        ---
        RESPONSE FORMAT (CRITICAL):
        When complete, respond with ONLY:
        DONE: [1-2 sentence summary]
        Files: [comma-separated list]
        ---`,
        run_in_background: true
      })
    }

    // Re-run affected tests
    // npm test -- --coverage --passWithNoTests

    // Re-evaluate
    // Re-launch review agents for the specific areas that had issues
  }

  if (stillHasCriticalOrMajorIssues) {
    state.quality_gates.qa_review = "degraded"
    state.degraded_phases.push("qa_review")
    log("DEGRADED: QA review still has issues after 2 cycles")
  } else {
    state.quality_gates.qa_review = "approved"
  }
}
```

#### Step 7.5: Create QA Report

```javascript
Write({
  file_path: "docs/reports/{yyyyMMddHHmm}-{module}-qa-report.md",
  content: `# QA Report: {Module Name}

## Decision: APPROVED / DEGRADED

## Code Quality Findings
| Severity | Count | Fixed |
|----------|-------|-------|
| CRITICAL | X | X |
| MAJOR | X | X |
| MINOR | X | - |

## Security Review
| Check | Status |
|-------|--------|
| Auth/AuthZ | PASS/FAIL |
| OWASP Top 10 | PASS/FAIL |

## Quality Gates Summary
| Gate | Status |
|------|--------|
| Unit Tests | ${state.quality_gates.unit_tests} |
| Integration Tests | ${state.quality_gates.integration_tests} |
| E2E Tests | ${state.quality_gates.e2e_tests} |
| Smoke Test | ${state.quality_gates.smoke_test} |
| UAT | ${state.quality_gates.uat} |
| QA Review | ${state.quality_gates.qa_review} |

## Blocked Tasks
${state.blocked_tasks.length > 0 ? state.blocked_tasks.join(', ') : 'None'}

## Degraded Phases
${state.degraded_phases.length > 0 ? state.degraded_phases.join(', ') : 'None'}

## QA Cycles: ${state.qa_cycles}
`
})
```

#### Step 7.6: Final Commit

```bash
git add .
git commit -m "feat({module}): implement with UAT+QA approval"
```

#### Step 7.7: Mark Execution Complete

```bash
# Update state to completed
jq --arg ts "$(date -Iseconds)" '
  .status = "completed" |
  .updated_at = $ts |
  .resume_point = { "batch_id": null, "task_id": null, "phase": null } |
  .logs += [{"timestamp": $ts, "level": "info", "message": "Full pipeline completed (dev + UAT + QA)"}]
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json

echo "Execution complete - full pipeline finished"
```

---

## Quick Reference: Context Management

```
Phase 0:   State Init
Phase 0.5: Pre-flight (node, npm, prisma, env) → /compact
Phase 1:   Parse -> Check Status -> Verify -> Group -> /compact
Phase 2:   Batch 0 (5-7 agents + MINIMAL OUTPUT + retry limits) -> Poll -> Update -> /compact
           Batch N (5-7 agents + MINIMAL OUTPUT + retry limits) -> Poll -> Update -> /compact
Phase 2.5: Seed Data Setup -> db:seed:test
Phase 3:   Unit Tests -> Integration Tests -> Fix Loop (max 3) -> /compact
Phase 4:   E2E Tests (seed data + user story coverage) -> Fix Loop (max 3) -> /compact
Phase 5:   Smoke Test -> Auto-Fix Protocols (max 2) -> Static Checks -> /compact
Phase 6:   UAT (full test suite + traceability + anti-mock) -> Report -> /compact
Phase 7:   QA Review (code quality + security) -> Fix Cycles (max 2) -> Report -> Commit
```

### Retry Limits Summary

| Scope | Max Retries | Escalation |
|-------|-------------|------------|
| Task implementation | 3 per task | debugger -> specialist -> broad context -> BLOCKED |
| Test phase fix loop | 3 per phase | debugger -> specialist -> full analysis -> DEGRADED |
| Smoke test auto-fix | 2 | pattern-match fix -> DEGRADED |
| QA review cycles | 2 | fix + re-test -> DEGRADED |

### Common Runtime Errors (Smoke Test Auto-Fix)

| Error | Auto-Fix |
|-------|----------|
| `Nest can't resolve dependencies` | backend-architect: fix DI imports |
| `Cannot find module` | `npm install` |
| `ECONNREFUSED :5432` | **STOP** - DB not running |
| `Module not found` | backend-architect: fix import path |
| Build type errors | typescript-pro: fix TS errors |
| Lint errors | `npx eslint --fix src/` |

> **Reference**: See `.claude/kbs/qa-checklist.md` for comprehensive checklist
> **Reference**: See `.claude/kbs/auto-answer-guide.md` for auto-answer behavior

---

## After Completion

1. Pre-flight environment verified
2. All implementation tasks completed (blocked tasks reported)
3. TodoList file updated (all tasks marked)
4. Seed data created and verified (`prisma/seed-test.ts`)
5. Unit tests passing (>80% coverage)
6. Integration tests passing (real DB + seed data)
7. E2E tests passing (user story-driven + seed data)
8. All user stories have corresponding E2E tests
9. Smoke test passed (with auto-fix if needed)
10. Build and lint passing
11. UAT testing complete with traceability report
12. QA review complete (code quality + security)
13. QA report: APPROVED / DEGRADED
14. All changes committed
15. Production-grade pipeline complete
