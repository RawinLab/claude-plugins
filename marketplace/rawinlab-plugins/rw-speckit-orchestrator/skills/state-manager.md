---
name: state-manager
description: Manage orchestrator state file - read, update, and coordinate between workers
---

# State Manager Skill

This skill helps manage the orchestrator state file for coordination between workers.

## State File Location

Always: `.claude/orchestrator.state.json`

## State File Structure

```json
{
  "version": "1.0.0",
  "session_id": "speckit-orch-20251226-143022",
  "started_at": "2025-12-26T14:30:22Z",
  "updated_at": "2025-12-26T15:15:45Z",
  "status": "running",

  "config": {
    "guide_path": "./speckit-guide.md",
    "workers_count": 4,
    "project_name": "Vidiwo",
    "project_path": "/home/dev/projects/Vidiwo"
  },

  "progress": {
    "total_features": 20,
    "completed": 12,
    "in_progress": 3,
    "pending": 5,
    "failed": 0
  },

  "features": {
    "001": {
      "name": "channel-management",
      "status": "completed",
      "priority": "P0",
      "phase": 1,
      "dependencies": [],
      "steps_completed": ["specify", "clarify", "plan", "tasks", "analyze", "implement"],
      "current_step": null,
      "worker_id": null,
      "started_at": "2025-12-26T14:30:30Z",
      "completed_at": "2025-12-26T14:45:12Z",
      "retry_count": 0,
      "error": null,
      "summary": "Channel CRUD API implemented with validation"
    }
  },

  "workers": {
    "W1": {
      "status": "busy",
      "current_feature": "013"
    }
  },

  "logs": [
    {
      "timestamp": "2025-12-26T15:15:45Z",
      "level": "info",
      "message": "Worker W1 started Feature 013"
    }
  ]
}
```

## Common Operations

### Read State

```bash
cat .claude/orchestrator.state.json | jq '.'
```

### Find Next Pending Feature

```bash
# Get first pending feature with no unmet dependencies
jq -r '
  .features | to_entries
  | map(select(.value.status == "pending"))
  | map(select(
      (.value.dependencies | length == 0) or
      (all(.value.dependencies[]; . as $dep | $dep | IN(.features[$dep].status | select(. == "completed"))))
    ))
  | first
  | .key
' .claude/orchestrator.state.json
```

### Claim Feature for Worker

```bash
# Update feature and worker status atomically
jq --arg fid "003" --arg wid "W1" --arg ts "$(date -Iseconds)" '
  .features[$fid].status = "in_progress" |
  .features[$fid].worker_id = $wid |
  .features[$fid].started_at = $ts |
  .features[$fid].current_step = "specify" |
  .workers[$wid].status = "busy" |
  .workers[$wid].current_feature = $fid |
  .progress.in_progress += 1 |
  .progress.pending -= 1 |
  .updated_at = $ts
' .claude/orchestrator.state.json > .claude/orchestrator.state.json.tmp && \
mv .claude/orchestrator.state.json.tmp .claude/orchestrator.state.json
```

### Update Step Progress

```bash
# Mark step as complete, move to next
jq --arg fid "003" --arg step "clarify" --arg next "plan" --arg ts "$(date -Iseconds)" '
  .features[$fid].steps_completed += [$step] |
  .features[$fid].current_step = $next |
  .updated_at = $ts
' .claude/orchestrator.state.json > .claude/orchestrator.state.json.tmp && \
mv .claude/orchestrator.state.json.tmp .claude/orchestrator.state.json
```

### Mark Feature Complete

```bash
jq --arg fid "003" --arg wid "W1" --arg ts "$(date -Iseconds)" --arg summary "Implemented X and Y" '
  .features[$fid].status = "completed" |
  .features[$fid].completed_at = $ts |
  .features[$fid].current_step = null |
  .features[$fid].summary = $summary |
  .workers[$wid].status = "idle" |
  .workers[$wid].current_feature = null |
  .progress.completed += 1 |
  .progress.in_progress -= 1 |
  .updated_at = $ts
' .claude/orchestrator.state.json > .claude/orchestrator.state.json.tmp && \
mv .claude/orchestrator.state.json.tmp .claude/orchestrator.state.json
```

### Mark Feature Failed

```bash
jq --arg fid "003" --arg wid "W1" --arg ts "$(date -Iseconds)" --arg error "Error message" '
  .features[$fid].status = "failed" |
  .features[$fid].error = $error |
  .workers[$wid].status = "idle" |
  .workers[$wid].current_feature = null |
  .progress.failed += 1 |
  .progress.in_progress -= 1 |
  .updated_at = $ts
' .claude/orchestrator.state.json > .claude/orchestrator.state.json.tmp && \
mv .claude/orchestrator.state.json.tmp .claude/orchestrator.state.json
```

### Check if All Complete

```bash
completed=$(jq '.progress.completed' .claude/orchestrator.state.json)
total=$(jq '.progress.total_features' .claude/orchestrator.state.json)

if [ "$completed" -eq "$total" ]; then
  echo "All complete!"
fi
```

## Status Values

### Feature Status
- `pending` - Not started
- `in_progress` - Being worked on
- `completed` - Done and verified
- `failed` - Failed after max retries

### Worker Status
- `idle` - No current assignment
- `busy` - Working on a feature

### Step Names (in order)
1. `specify`
2. `clarify`
3. `plan`
4. `tasks`
5. `analyze`
6. `implement`

## Tips

1. Always use atomic write (write to tmp, then mv)
2. Update `updated_at` on every change
3. Maintain consistency between features and progress counts
4. Log important events to the logs array
5. Check dependencies before claiming a feature
