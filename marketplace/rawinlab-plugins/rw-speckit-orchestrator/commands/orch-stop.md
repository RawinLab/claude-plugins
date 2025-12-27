---
name: orch-stop
description: Stop orchestration gracefully
arguments:
  - name: save-state
    description: Save state for later resume (default true)
    required: false
    default: "true"
---

# Stop Orchestration

Gracefully stop the orchestration process.

## Arguments

- **save-state**: ${save-state} (keep state file for resume)

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

### 2. Output Summary

```
Orchestration Stopped
=====================

State saved: ${save-state}
State file: .claude/orchestrator.state.json

Progress at stop:
- Current Phase: {phase}
- Completed: {completed}/{total}
- In Progress: {in_progress}
- Pending: {pending}

To resume later:
  /orchestrate --resume true

The orchestrator will continue from saved state.
```

## If Not Running

```
Orchestration not currently running.
```

## Note

Since we use Task tool for workers, there's no external process to kill.
The orchestrator and workers run within the Claude session.
