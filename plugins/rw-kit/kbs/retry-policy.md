# Retry Policy & Escalation

> **Single source of truth** for retry limits and escalation paths. All commands and agents should reference this file.

## Overview

The retry policy prevents infinite loops and ensures pipeline progress by defining clear limits and escalation paths at every level.

---

## Task-Level Retries

Each task gets a maximum of **3 retry attempts** before being marked BLOCKED:

| Attempt | Strategy | Agent Type |
|---------|----------|-----------|
| 1st failure | Launch debugger agent | `unit-testing:debugger` |
| 2nd failure | Launch specialist agent (different type) | Task-appropriate specialist |
| 3rd failure | Launch agent with broader context | Senior specialist with full context |
| After 3rd | **BLOCKED** | Skip task + all dependents |

### BLOCKED Task Handling

When a task is marked BLOCKED:
1. Log error details and all 3 fix attempts
2. Mark the task status as `"blocked"` in state file
3. Find all tasks that depend on this task (direct + transitive)
4. Mark dependent tasks as `"skipped"`
5. Continue execution with non-dependent tasks
6. Report all blocked tasks in the final summary

---

## Phase-Level Fix Loops

Test phases (unit, integration, E2E) get a maximum of **3 fix attempts** per phase:

| Attempt | Strategy |
|---------|----------|
| 1st fix | Launch debugger agent |
| 2nd fix | Launch specialist agent (backend or frontend) |
| 3rd fix | Launch agent with broader context |
| After 3rd | **DEGRADED** → continue pipeline with warning |

---

## Smoke Test Auto-Fix

| Attempt | Strategy |
|---------|----------|
| 1st fix | Pattern-match error and apply auto-fix |
| 2nd fix | Pattern-match with broader context |
| After 2nd | **DEGRADED** → continue with warning |

See `.claude/kbs/smoke-test-guide.md` for error pattern → fix mapping.

---

## QA Review Cycles

| Cycle | Action |
|-------|--------|
| 1st QA | Review → fix critical/major issues → re-test |
| 2nd QA | Re-review → if still failing → DEGRADED |

---

## DEGRADED vs BLOCKED

| State | Meaning | Pipeline Continues? | Action Required |
|-------|---------|--------------------|--------------------|
| BLOCKED | Task cannot be completed | Yes (skips dependents) | User must manually fix |
| DEGRADED | Phase partially passed | Yes (with warnings) | User should review |

---

## Summary

```
Task fails 3x     → BLOCKED  → skip task + dependents → report in summary
Phase fails 3x    → DEGRADED → continue pipeline      → flag in QA report
Smoke fails 2x    → DEGRADED → continue pipeline      → flag in QA report
QA fails 2 cycles → DEGRADED → complete with warnings  → user must resolve
```

All BLOCKED tasks and DEGRADED phases are tracked in:
- State file: `blocked_tasks[]` and `degraded_phases[]`
- Execution completion report
- QA report (if QA phase runs)
