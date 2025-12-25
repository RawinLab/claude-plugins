---
name: orch-stop
description: Stop orchestration gracefully
arguments:
  - name: save-state
    description: Save state for later resume (default true)
    required: false
    default: "true"
  - name: kill-session
    description: Kill tmux session (default true)
    required: false
    default: "true"
---

# Stop Orchestration

Gracefully stop the orchestration process.

## Arguments

- **save-state**: ${save-state} (keep state file for resume)
- **kill-session**: ${kill-session} (kill tmux session)

## Process

### 1. Update State File

Set status to "stopped":

```json
{
  "status": "stopped",
  "stopped_at": "{ISO timestamp}",
  "updated_at": "{ISO timestamp}"
}
```

### 2. Kill Watchdog Process

```bash
# Find and kill watchdog
pkill -f "watchdog.sh" || true
```

### 3. Kill tmux Session (if requested)

```bash
if [ "${kill-session}" = "true" ]; then
    tmux kill-session -t speckit-orch 2>/dev/null || true
fi
```

### 4. Output Summary

```
Orchestration Stopped
=====================

State saved: ${save-state}
State file: .claude/orchestrator.state.json

Progress at stop:
- Completed: {completed}/{total}
- In Progress: {in_progress}
- Pending: {pending}

To resume later:
  /orchestrate

The orchestrator will continue from saved state.
```

## If Not Running

```
Orchestration not currently running.
```
