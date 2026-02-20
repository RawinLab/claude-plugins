---
name: state-manager
description: Manage rw-kit execution state file - read, update, resume, and track progress with retry limits, quality gates, and 3-layer verification
---

# State Manager Skill

Manage the rw-kit execution state file for tracking progress, retries, quality gates, and enabling resume.

## State File Location

Always: `.claude/rw-kit.state.json`

## State File Structure (v3.0.0)

```json
{
  "version": "3.0.0",
  "session_id": "exec-20251230-143022",
  "started_at": "2025-12-30T14:30:22Z",
  "updated_at": "2025-12-30T15:15:45Z",
  "status": "running",

  "config": {
    "todolist_path": "plans/1-1-user-auth-todolist.md",
    "plan_path": "plans/1-1-user-auth-plan.md",
    "clarified_requirements_path": "",
    "analysis_report_path": "",
    "project_name": "my-project",
    "project_path": "/home/dev/projects/my-project",
    "auto_answer": true
  },

  "user_stories": {
    "US-001": {
      "title": "User can login",
      "total_tasks": 3,
      "completed_tasks": 2,
      "status": "in_progress"
    }
  },

  "progress": {
    "total_tasks": 15,
    "completed": 8,
    "in_progress": 2,
    "pending": 3,
    "failed": 0,
    "verified": 7,
    "blocked": 2
  },

  "tasks": {
    "task-001": {
      "description": "Create Prisma schema for users",
      "status": "completed",
      "agent": "backend-development:backend-architect",
      "batch_id": 0,
      "story_id": "US-001",
      "dependencies": [],
      "started_at": "2025-12-30T14:30:30Z",
      "completed_at": "2025-12-30T14:35:12Z",
      "files_modified": ["packages/database/schema.prisma"],
      "files_mentioned": ["packages/database/schema.prisma"],
      "error": null,
      "verification": {
        "agent_done": true,
        "files_exist": true,
        "state_synced": true
      }
    }
  },

  "batches": [
    {
      "batch_id": 0,
      "task_ids": ["task-001", "task-002"],
      "status": "completed",
      "started_at": "2025-12-30T14:30:30Z",
      "completed_at": "2025-12-30T14:40:00Z",
      "compacted": true
    }
  ],

  "current_batch": null,

  "retry_counts": {
    "task-003": 2
  },

  "quality_gates": {
    "unit_tests": "passed",
    "integration_tests": "passed",
    "e2e_tests": "degraded",
    "smoke_test": "passed",
    "uat": "passed",
    "qa_review": "approved"
  },

  "qa_cycles": 1,

  "blocked_tasks": ["task-007"],

  "degraded_phases": ["e2e_tests"],

  "resume_point": {
    "batch_id": 1,
    "task_id": "task-005",
    "phase": "implementation"
  },

  "logs": [
    {
      "timestamp": "2025-12-30T14:30:22Z",
      "level": "info",
      "message": "Execution started"
    }
  ]
}
```

---

## Common Operations

### Initialize State

```bash
session_id="exec-$(date +%Y%m%d-%H%M%S)"
ts=$(date -Iseconds)

jq --arg sid "$session_id" --arg ts "$ts" --arg todolist "$TODOLIST_PATH" --arg project "$PROJECT_NAME" --arg path "$(pwd)" '
  .session_id = $sid |
  .started_at = $ts |
  .updated_at = $ts |
  .status = "running" |
  .config.todolist_path = $todolist |
  .config.project_name = $project |
  .config.project_path = $path
' .claude/templates/state-template.json > .claude/rw-kit.state.json
```

### Read Current State

```bash
jq '.' .claude/rw-kit.state.json
jq '.progress' .claude/rw-kit.state.json
jq '.quality_gates' .claude/rw-kit.state.json
jq '.blocked_tasks' .claude/rw-kit.state.json
jq '.degraded_phases' .claude/rw-kit.state.json
jq '.resume_point' .claude/rw-kit.state.json
```

### Add Task (with verification and story tracking)

```bash
jq --arg tid "task-001" --arg desc "Create Prisma schema" --arg agent "backend-architect" --arg sid "US-001" '
  .tasks[$tid] = {
    "description": $desc,
    "status": "pending",
    "agent": $agent,
    "batch_id": null,
    "story_id": $sid,
    "dependencies": [],
    "started_at": null,
    "completed_at": null,
    "files_modified": [],
    "files_mentioned": [],
    "error": null,
    "verification": {
      "agent_done": false,
      "files_exist": false,
      "state_synced": false
    }
  } |
  .progress.total_tasks += 1 |
  .progress.pending += 1 |
  .updated_at = (now | todate)
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Claim Task for Execution

```bash
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" '
  .tasks[$tid].status = "in_progress" |
  .tasks[$tid].started_at = $ts |
  .progress.in_progress += 1 |
  .progress.pending -= 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Mark Task Complete (Layer 1: Agent Done)

```bash
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" --argjson files '["src/auth/auth.service.ts"]' '
  .tasks[$tid].status = "completed" |
  .tasks[$tid].completed_at = $ts |
  .tasks[$tid].files_modified = $files |
  .tasks[$tid].files_mentioned = $files |
  .tasks[$tid].verification.agent_done = true |
  .progress.completed += 1 |
  .progress.in_progress -= 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Verify Task Files (Layer 2: Files Exist)

```bash
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" '
  .tasks[$tid].verification.files_exist = true |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Sync Task State (Layer 3: State Synced)

```bash
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" '
  .tasks[$tid].verification.state_synced = true |
  .progress.verified += 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Mark Task Failed (with retry tracking)

```bash
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" --arg error "Build failed: missing dependency" '
  .tasks[$tid].status = "failed" |
  .tasks[$tid].error = $error |
  .retry_counts[$tid] = ((.retry_counts[$tid] // 0) + 1) |
  .progress.failed += 1 |
  .progress.in_progress -= 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Mark Task Blocked (after 3 retries)

```bash
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" '
  .tasks[$tid].status = "blocked" |
  .blocked_tasks += [$tid] |
  .progress.blocked += 1 |
  .progress.failed -= 1 |
  .updated_at = $ts |
  .logs += [{"timestamp": $ts, "level": "error", "message": ("Task " + $tid + " BLOCKED after 3 retries")}]
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Update Quality Gate

```bash
jq --arg gate "unit_tests" --arg status "passed" --arg ts "$(date -Iseconds)" '
  .quality_gates[$gate] = $status |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Mark Phase Degraded

```bash
jq --arg phase "e2e_tests" --arg ts "$(date -Iseconds)" '
  .degraded_phases += [$phase] |
  .quality_gates[$phase] = "degraded" |
  .updated_at = $ts |
  .logs += [{"timestamp": $ts, "level": "warning", "message": ("Phase " + $phase + " DEGRADED after max fix attempts")}]
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Increment QA Cycle

```bash
jq --arg ts "$(date -Iseconds)" '
  .qa_cycles += 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Create/Complete Batch

```bash
# Create batch
jq --argjson bid 0 --argjson tasks '["task-001", "task-002"]' --arg ts "$(date -Iseconds)" '
  .batches += [{"batch_id": $bid, "task_ids": $tasks, "status": "pending", "started_at": null, "completed_at": null, "compacted": false}] |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json

# Start batch
jq --argjson bid 0 --arg ts "$(date -Iseconds)" '
  .batches[$bid].status = "in_progress" |
  .batches[$bid].started_at = $ts |
  .current_batch = $bid |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json

# Complete batch
jq --argjson bid 0 --arg ts "$(date -Iseconds)" '
  .batches[$bid].status = "completed" |
  .batches[$bid].completed_at = $ts |
  .batches[$bid].compacted = true |
  .current_batch = null |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Set/Check Resume Point

```bash
# Set resume point
jq --argjson bid 1 --arg tid "task-005" --arg phase "implementation" --arg ts "$(date -Iseconds)" '
  .resume_point = {"batch_id": $bid, "task_id": $tid, "phase": $phase} |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json

# Check resume point
resume_phase=$(jq -r '.resume_point.phase // empty' .claude/rw-kit.state.json)
resume_batch=$(jq -r '.resume_point.batch_id // empty' .claude/rw-kit.state.json)
if [ -n "$resume_phase" ]; then
  echo "Resume from: Phase $resume_phase, Batch $resume_batch"
fi
```

### Complete Execution

```bash
jq --arg ts "$(date -Iseconds)" '
  .status = "completed" |
  .updated_at = $ts |
  .resume_point = {"batch_id": null, "task_id": null, "phase": null} |
  .logs += [{"timestamp": $ts, "level": "info", "message": "Full pipeline completed"}]
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Add Log Entry

```bash
jq --arg ts "$(date -Iseconds)" --arg level "info" --arg msg "Batch 0 completed" '
  .logs += [{"timestamp": $ts, "level": $level, "message": $msg}] |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

---

## Status Values

### Execution Status
- `initializing` - Just created, not started
- `running` - In progress
- `paused` - Stopped, can resume
- `completed` - All done
- `failed` - Failed with errors

### Task Status
- `pending` - Not started
- `in_progress` - Currently executing
- `completed` - Done successfully
- `failed` - Failed with error (may retry)
- `blocked` - Failed after 3 retries, skipped

### Batch Status
- `pending` - Not started
- `in_progress` - Tasks running
- `completed` - All tasks done

### Quality Gate Values
- `null` - Not yet evaluated
- `"passed"` - Gate passed
- `"degraded"` - Gate failed after max fix attempts, pipeline continued
- `"approved"` - QA review approved (qa_review gate only)

### Retry & Escalation

| Retry Count | Action |
|-------------|--------|
| 1 | Launch debugger agent |
| 2 | Launch specialist agent |
| 3 | Launch agent with broader context |
| >3 | Mark task BLOCKED, skip dependents |

---

## Tips

1. **Always use atomic write** - Write to .tmp file, then mv
2. **Update timestamps** - Always update `updated_at` on changes
3. **Maintain consistency** - Keep progress counters in sync with task statuses
4. **Log important events** - Add logs for debugging and auditing
5. **Check before resume** - Validate state file exists and is valid before resuming
6. **Track retries** - Always increment `retry_counts` on failure before retrying
7. **3-layer verification** - Task is truly complete only when all 3 verification flags are true
