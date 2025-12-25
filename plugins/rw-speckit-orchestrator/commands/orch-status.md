---
name: orch-status
description: Show current orchestration status
---

# Orchestration Status

Read and display the current orchestration status from the state file.

## Process

1. Read `.claude/orchestrator.state.json`
2. Display formatted status

## Output Format

```
Speckit Orchestrator Status
===========================

Session: {session_id}
Status: {running|stopped|complete}
Started: {started_at}
Duration: {elapsed time}

Progress
--------
Total Features: {total}
Completed: {completed} ({percentage}%)
In Progress: {in_progress}
Pending: {pending}
Failed: {failed}

Progress Bar: [{bar}] {percent}%

Workers
-------
W1: {feature_id} - {current_step} ({status})
W2: {feature_id} - {current_step} ({status})
W3: {feature_id} - {current_step} ({status})
W4: {feature_id} - {current_step} ({status})

Features In Progress
--------------------
- {feature_id}: {name} - Step: {current_step}

Recently Completed
------------------
- {feature_id}: {name} - {summary}

Failed Features
---------------
- {feature_id}: {name} - Error: {error}

Commands
--------
  tmux attach -t speckit-orch  # View live dashboard
  /orch-stop                   # Stop orchestration
  /orchestrate --resume        # Resume if stopped
```

## If State File Not Found

```
Orchestration not running.

To start:
  /orchestrate [--guide ./speckit-guide.md] [--workers 4]
```
