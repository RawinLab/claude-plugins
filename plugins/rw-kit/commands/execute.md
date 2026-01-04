---
name: execute
description: Execute todolist by orchestrating specialized agents
argument-hint: <todolist-file> [--resume]
model: opus
arguments:
  - name: resume
    description: Resume from previous execution state (true/false)
    required: false
    default: "false"
---
name: execute

You are a highly skilled **Team Lead** with expertise in assigning tasks to the right specialists.

## Your Mission

Execute the todolist `$ARGUMENTS` by orchestrating specialized Claude Code subagents with **context-aware batch execution** and **integrated testing phases**.

## State Management (NEW)

This command supports **state tracking** and **resume** capability.

### State File
- Location: `.claude/rw-kit.state.json`
- Tracks: tasks, batches, progress, resume point
- Reference: `.claude/skills/state-manager.md`

### Resume Mode
If `--resume` is passed or state file exists with `status: "running"`:
1. Load existing state from `.claude/rw-kit.state.json`
2. Find resume point (last incomplete batch/task)
3. Skip completed tasks
4. Continue from where it stopped

### Auto-Answer
Hooks in `.claude/hooks/` will automatically:
- Answer confirmations with "yes"
- Select "(Recommended)" options
- Track progress in state file

---
name: execute

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
name: execute
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
name: execute
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
name: execute

## 3-Layer Task Completion Detection (NEW in v2.0)

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
        "agent_done": true,      // Layer 1
        "files_exist": true,     // Layer 2
        "state_synced": true     // Layer 3
      }
    }
  }
}
```

### Task Completion Flow

```
Agent returns "DONE: Created auth service"
    │
    ▼ Layer 1 (Hook)
progress-tracker.json detects pattern
    → Sets verification.agent_done = true
    │
    ▼ Layer 2 (Hook)
file-verification.json runs on next Glob
    → Checks expected files exist
    → Sets verification.files_exist = true
    │
    ▼ Layer 3 (Orchestrator)
execute.md verifies state consistency
    → Updates todolist checkbox
    → Sets verification.state_synced = true
    │
    ▼
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
name: execute

## Execution Process (5 Phases)

### Phase 0: State Initialization

#### Step 0.1: Check Resume Mode
```bash
# Check if resuming from existing state
if [ "$RESUME" = "true" ] && [ -f ".claude/rw-kit.state.json" ]; then
  status=$(jq -r '.status' .claude/rw-kit.state.json)
  if [ "$status" = "running" ] || [ "$status" = "paused" ]; then
    echo "📂 Resuming from existing state..."
    # Load resume point
    resume_batch=$(jq -r '.resume_point.batch_id // empty' .claude/rw-kit.state.json)
    resume_task=$(jq -r '.resume_point.task_id // empty' .claude/rw-kit.state.json)
    echo "Resume from: Batch $resume_batch, Task $resume_task"
  fi
else
  echo "🆕 Starting fresh execution..."
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

echo "📊 State file created: .claude/rw-kit.state.json"
```

---
name: execute

### Phase 1: Parse & Plan

#### Step 1.1: Read TodoList
```javascript
Read("$ARGUMENTS")
```

#### Step 1.2: Parse Tasks and Check Status
For each task in the todolist:
1. Check if task is already marked as `[x]` or `✅` → **SKIP**
2. Check if task is marked as `[ ]` or `⬜` → **PENDING** (will execute)
3. Check if task is marked as `🔄` → **IN PROGRESS** (resume)

#### Step 1.3: Verify Implementation (Batch - Max 3 agents)
Before executing pending tasks, verify if code already exists:
```javascript
Task(subagent_type: "Explore",
  prompt: "Check if these features are already implemented: [list pending tasks]. Return which tasks already have working code.",
  run_in_background: true)
```

#### Step 1.4: Group Pending Tasks into Batches
Group **only pending tasks** by dependency level:
- **Batch 0**: Tasks with no dependencies (root tasks)
- **Batch 1**: Tasks depending only on Batch 0
- **Batch 2**: Tasks depending only on Batch 0 or 1
- Continue until all tasks are assigned

#### Step 1.5: Compact After Planning
```
📋 Planning Summary:
- Total tasks: X
- Already completed: Y (skipped)
- Pending tasks: Z
- Batches created: N

/compact
```

### Phase 2: Batch Implementation

For EACH batch:

#### Step 2.1: Launch Batch (Max 5-7 agents)
```javascript
// Launch ALL tasks in current batch with MINIMAL OUTPUT template
Task(subagent_type: "backend-development:backend-architect", prompt: `
  Task 1: Create auth endpoints

  Requirements:
  - POST /auth/register
  - POST /auth/login

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]

  Do NOT include code snippets or detailed explanations.
  ---
`, run_in_background: true)
```

#### Step 2.2: Poll Until Batch Complete
```javascript
while (batchTasksRunning) {
  for (agent of batchAgents) {
    result = TaskOutput(agent.id, block: false)
    if (result.completed) {
      // Record: ✅ Task X completed
      // DON'T parse full output - verify via files instead:
      Glob({ pattern: "apps/api/src/auth/*.ts" })
    }
    if (result.failed) {
      // Launch fix agent with MINIMAL OUTPUT template
      Task(subagent_type: "unit-testing:debugger", prompt: "Fix: [error details]...", run_in_background: true)
    }
  }
}
```

#### Step 2.3: Update TodoList File (CRITICAL)
After each task completes, **immediately update the todolist file**:
```javascript
Edit({
  file_path: "$ARGUMENTS",
  old_string: "- [ ] Task X description",
  new_string: "- [x] Task X description ✅"
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

**Display summary and compact:**
```
📊 Batch N Summary:
- ✅ Task 1: Completed (created 3 files)
- ✅ Task 2: Completed (updated API)

State Updated: .claude/rw-kit.state.json
TodoList Updated: $ARGUMENTS

Use /compact to compress context before next batch
```

---
name: execute

### Phase 3: Unit Testing (Jest)

After ALL implementation batches complete:

```bash
npm test -- --coverage --passWithNoTests
```

- If **ALL PASS**: Proceed to E2E testing
- If **FAILURES**: Launch fix agents, re-run tests

---
name: execute

### Phase 4: E2E Testing (Playwright)

```bash
npx playwright test --project=chromium
```

- If **ALL PASS**: Proceed to final checks
- If **FAILURES**: Launch fix agents, re-run tests

---
name: execute

### Phase 5: Final Quality Check

#### Step 5.1: Smoke Test (MANDATORY)

> **CRITICAL**: Build passing ≠ Application working! Must verify runtime startup.

```bash
npm run dev &
sleep 15

# Verify API starts without DI errors
curl -f http://localhost:{API_PORT}/api/health || echo "❌ API FAILED"

# Verify Frontend responds
curl -f -o /dev/null http://localhost:{WEB_PORT} || echo "❌ FRONTEND FAILED"

echo "✅ Smoke test passed!"
```

#### Step 5.2: Run All Static Checks
```bash
npm run build        # Build check
npm run typecheck    # TypeScript check
npm run lint         # ESLint check
```

#### Step 5.3: Commit Changes
```bash
git add .
git commit -m "feat(module): implement [module-name] with tests"
```

#### Step 5.4: Mark Execution Complete
```bash
# Update state to completed
jq --arg ts "$(date -Iseconds)" '
  .status = "completed" |
  .updated_at = $ts |
  .resume_point = { "batch_id": null, "task_id": null, "phase": null }
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json

# Add completion log
jq --arg ts "$(date -Iseconds)" '
  .logs += [{"timestamp": $ts, "level": "info", "message": "Execution completed successfully"}]
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json

echo "✅ Execution state marked as completed"
```

#### Step 5.5: Create Completion Report
Create summary in `docs/reports/` with format `yyyyMMddHHmm-{module}-execution-summary.md`

---
name: execute

## Quick Reference: Context Management

```
📋 Phase 1: Parse → Check Status → Verify → Group → /compact
📦 Batch 0 (5-7 agents + MINIMAL OUTPUT) → Poll → Update TodoList → /compact
📦 Batch 1 (5-7 agents + MINIMAL OUTPUT) → Poll → Update TodoList → /compact
📦 Batch N (5-7 agents + MINIMAL OUTPUT) → Poll → Update TodoList → /compact
🧪 Unit Tests → Fix → Rerun → /compact
🎭 E2E Tests → Fix → Rerun → /compact
🚀 Smoke Test (MANDATORY) → npm run dev → Health checks
✅ Final Static Checks → Commit → Report
```

### Common Runtime Errors (Smoke Test Failures)

| Error | Cause | Fix |
|-------|-------|-----|
| `Nest can't resolve dependencies` | Missing module import | Add module to `imports: []` |
| `Cannot find module` | Missing package | Run `npm install` |
| `ECONNREFUSED :5432` | Database not running | Start PostgreSQL |
| `Module not found` | Wrong import path | Fix import statement |

> **Reference**: See `.claude/kbs/qa-checklist.md` for comprehensive checklist

---
name: execute

## After Completion

1. ✅ All implementation tasks completed
2. ✅ TodoList file updated (all tasks marked as `[x]`)
3. ✅ Unit tests passing (>80% coverage)
4. ✅ E2E tests passing
5. ✅ **Smoke test passed** - `npm run dev` starts without errors
6. ✅ Build and lint passing
7. ✅ Changes committed
8. ✅ Completion report created
9. 📋 Ready for `/project:uat-test`
