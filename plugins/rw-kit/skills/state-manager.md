---
name: state-manager
description: Manage rw-kit execution state file - read, update, resume, and track progress
---

# State Manager Skill

Manage the rw-kit execution state file for tracking progress and enabling resume.

## State File Location

Always: `.claude/rw-kit.state.json`

## State File Structure

```json
{
  "version": "1.0.0",
  "session_id": "exec-20251230-143022",
  "started_at": "2025-12-30T14:30:22Z",
  "updated_at": "2025-12-30T15:15:45Z",
  "status": "running",

  "config": {
    "todolist_path": "plans/1-1-user-auth-todolist.md",
    "plan_path": "plans/1-1-user-auth-plan.md",
    "project_name": "my-project",
    "project_path": "/home/dev/projects/my-project",
    "auto_answer": true
  },

  "progress": {
    "total_tasks": 15,
    "completed": 8,
    "in_progress": 2,
    "pending": 5,
    "failed": 0
  },

  "tasks": {
    "task-001": {
      "description": "Create Prisma schema for users",
      "status": "completed",
      "agent": "backend-development:backend-architect",
      "batch_id": 0,
      "dependencies": [],
      "started_at": "2025-12-30T14:30:30Z",
      "completed_at": "2025-12-30T14:35:12Z",
      "files_modified": ["packages/database/schema.prisma"],
      "error": null
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
# Create new state file from template
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
# Full state
cat .claude/rw-kit.state.json | jq '.'

# Progress only
jq '.progress' .claude/rw-kit.state.json

# Current batch
jq '.current_batch' .claude/rw-kit.state.json

# Resume point
jq '.resume_point' .claude/rw-kit.state.json
```

### Add Tasks from TodoList

```bash
# Parse todolist and add tasks to state
# Each task gets: task-NNN id, description, agent, dependencies
jq --arg tid "task-001" --arg desc "Create Prisma schema" --arg agent "backend-architect" '
  .tasks[$tid] = {
    "description": $desc,
    "status": "pending",
    "agent": $agent,
    "batch_id": null,
    "dependencies": [],
    "started_at": null,
    "completed_at": null,
    "files_modified": [],
    "error": null
  } |
  .progress.total_tasks += 1 |
  .progress.pending += 1 |
  .updated_at = (now | todate)
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Create Batch

```bash
# Create new batch with task IDs
jq --argjson bid 0 --argjson tasks '["task-001", "task-002", "task-003"]' --arg ts "$(date -Iseconds)" '
  .batches += [{
    "batch_id": $bid,
    "task_ids": $tasks,
    "status": "pending",
    "started_at": null,
    "completed_at": null,
    "compacted": false
  }] |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Start Batch

```bash
# Mark batch as in_progress
jq --argjson bid 0 --arg ts "$(date -Iseconds)" '
  .batches[$bid].status = "in_progress" |
  .batches[$bid].started_at = $ts |
  .current_batch = $bid |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Claim Task for Execution

```bash
# Mark task as in_progress
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" '
  .tasks[$tid].status = "in_progress" |
  .tasks[$tid].started_at = $ts |
  .progress.in_progress += 1 |
  .progress.pending -= 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Mark Task Complete

```bash
# Update task status and progress
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" --argjson files '["src/auth/auth.service.ts"]' '
  .tasks[$tid].status = "completed" |
  .tasks[$tid].completed_at = $ts |
  .tasks[$tid].files_modified = $files |
  .progress.completed += 1 |
  .progress.in_progress -= 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Mark Task Failed

```bash
# Update task status with error
jq --arg tid "task-001" --arg ts "$(date -Iseconds)" --arg error "Build failed: missing dependency" '
  .tasks[$tid].status = "failed" |
  .tasks[$tid].error = $error |
  .progress.failed += 1 |
  .progress.in_progress -= 1 |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Complete Batch

```bash
# Mark batch as completed and set compacted flag
jq --argjson bid 0 --arg ts "$(date -Iseconds)" '
  .batches[$bid].status = "completed" |
  .batches[$bid].completed_at = $ts |
  .batches[$bid].compacted = true |
  .current_batch = null |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Set Resume Point

```bash
# Save resume point for later continuation
jq --argjson bid 1 --arg tid "task-005" --arg phase "implementation" --arg ts "$(date -Iseconds)" '
  .resume_point.batch_id = $bid |
  .resume_point.task_id = $tid |
  .resume_point.phase = $phase |
  .updated_at = $ts
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Check Resume Point

```bash
# Get resume information
resume_batch=$(jq -r '.resume_point.batch_id // empty' .claude/rw-kit.state.json)
resume_task=$(jq -r '.resume_point.task_id // empty' .claude/rw-kit.state.json)

if [ -n "$resume_batch" ]; then
  echo "Resume from batch $resume_batch, task $resume_task"
fi
```

### Find Next Pending Task

```bash
# Get first pending task
jq -r '
  .tasks | to_entries
  | map(select(.value.status == "pending"))
  | first
  | .key // empty
' .claude/rw-kit.state.json
```

### Complete Execution

```bash
# Mark execution as completed
jq --arg ts "$(date -Iseconds)" '
  .status = "completed" |
  .updated_at = $ts |
  .resume_point = { "batch_id": null, "task_id": null, "phase": null }
' .claude/rw-kit.state.json > .claude/rw-kit.state.json.tmp && \
mv .claude/rw-kit.state.json.tmp .claude/rw-kit.state.json
```

### Add Log Entry

```bash
# Append log message
jq --arg ts "$(date -Iseconds)" --arg level "info" --arg msg "Batch 0 completed" '
  .logs += [{
    "timestamp": $ts,
    "level": $level,
    "message": $msg
  }] |
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
- `failed` - Failed with error

### Batch Status
- `pending` - Not started
- `in_progress` - Tasks running
- `completed` - All tasks done

---

## Tips

1. **Always use atomic write** - Write to .tmp file, then mv
2. **Update timestamps** - Always update `updated_at` on changes
3. **Maintain consistency** - Keep progress counters in sync with task statuses
4. **Log important events** - Add logs for debugging and auditing
5. **Check before resume** - Validate state file exists and is valid before resuming
