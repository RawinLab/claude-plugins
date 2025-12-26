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
Current Phase: {current_phase}

Progress
--------
Total Features: {total}
Completed: {completed} ({percentage}%)
In Progress: {in_progress}
Pending: {pending}
Failed: {failed}

Progress Bar: [{bar}] {percent}%

Phase Status
------------
- specify:   {X/total} complete
- clarify:   {X/total} complete
- plan:      {X/total} complete
- analyze:   {X/total} complete
- implement: {X/total} complete

Features In Progress
--------------------
- {feature_id}: {name} - Phase: {current_phase}

Recently Completed
------------------
- {feature_id}: {name} - {summary}

Failed Features
---------------
- {feature_id}: {name} - Error: {error}

Commands
--------
  /orch-stop              # Stop orchestration
  /orchestrate --resume   # Resume if stopped
```

## If State File Not Found

```
Orchestration not running.

To start:
  /orchestrate [--guide ./speckit-guide.md] [--parallel 3]
```
