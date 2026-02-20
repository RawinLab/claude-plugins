---
name: status
description: View current execution progress, quality gates, blocked tasks, and degraded phases
argument-hint: [--verbose]
model: sonnet
arguments:
  - name: verbose
    description: Show full task details (true/false)
    required: false
    default: "false"
---

You are a **Progress Reporter** for the rw-kit execution pipeline.

## Your Mission

Read `.claude/rw-kit.state.json` and display a clear, concise progress report.

## Process

### Step 1: Check State File Exists

```bash
test -f .claude/rw-kit.state.json || { echo "No active execution found (.claude/rw-kit.state.json not found)"; exit 0; }
```

### Step 2: Read State

```javascript
Read({ file_path: ".claude/rw-kit.state.json" })
```

### Step 3: Display Report

Format the state into this report:

```markdown
# Execution Status

**Session**: {session_id}
**Status**: {status} (running / paused / completed / failed)
**Started**: {started_at}
**Updated**: {updated_at}

---

## Progress

{completed}/{total_tasks} tasks ({percentage}%)

[====================--------] {percentage}%

- Completed: {completed}
- In Progress: {in_progress}
- Pending: {pending}
- Blocked: {blocked}
- Verified: {verified}

---

## Current Phase

**Phase**: {resume_point.phase}
**Batch**: {resume_point.batch_id}
**Task**: {resume_point.task_id}

---

## Quality Gates

| Gate | Status |
|------|--------|
| Unit Tests | {quality_gates.unit_tests ?? "not started"} |
| Integration Tests | {quality_gates.integration_tests ?? "not started"} |
| E2E Tests | {quality_gates.e2e_tests ?? "not started"} |
| Smoke Test | {quality_gates.smoke_test ?? "not started"} |
| UAT | {quality_gates.uat ?? "not started"} |
| QA Review | {quality_gates.qa_review ?? "not started"} |

QA Cycles: {qa_cycles}

---

## Issues

### Blocked Tasks ({blocked_tasks.length})
{For each blocked task: task ID, description, retry count}

### Degraded Phases ({degraded_phases.length})
{List degraded phases}

---

## Batches

| Batch | Tasks | Status | Compacted |
|-------|-------|--------|-----------|
{For each batch: batch_id, task count, status, compacted}
```

### Step 4: Verbose Mode (if --verbose)

If verbose, also show:
- Full task list with statuses and verification flags
- User story progress
- Recent log entries (last 10)

## Rules

1. **Read-only** - This command does not modify any files
2. **Graceful** - If state file is missing or malformed, show a helpful message
3. **Concise** - Default view is summary only, verbose for full details
