# Auto-Answer Guide

> **Reference**: This document explains the auto-answer strategy for fully autonomous pipeline execution.

## Overview

During autonomous execution (`--auto-answer true`, the default), the system auto-answers confirmations to avoid blocking the pipeline. This enables the execute and implement commands to run end-to-end without manual intervention at confirmation prompts.

## Hook: `auto-answer.json`

- **Event**: `Notification`
- **Handles**: Yes/no confirmations, option selections with `(Recommended)` labels
- **Location**: `.claude/hooks/auto-answer.json`

## Auto-Answer Rules

| Prompt Type | Auto-Answer Behavior |
|-------------|---------------------|
| Options with `(Recommended)` | Select the recommended option |
| Yes/No confirmations | Select "Yes" |
| Numbered options with recommendation | Select the recommended number |
| Free-form questions | **SKIP** - cannot auto-answer |

### Rule Priority

1. If an option contains `(Recommended)` → select it
2. If the prompt is a yes/no question → select "Yes"
3. If the prompt has numbered options with a recommendation → select the recommended number
4. If the prompt requires free-form text input → do not auto-answer (pipeline pauses)

## When NOT to Auto-Answer

The following operations are **never auto-answered** regardless of mode:

| Operation | Reason |
|-----------|--------|
| `git push --force` | Destructive - can overwrite remote history |
| `git reset --hard` | Destructive - can lose uncommitted work |
| `rm -rf` on project directories | Destructive - irreversible file deletion |
| Database `DROP` operations | Destructive - data loss |
| External service API calls | Side effects outside local environment |
| Deployment triggers | Production impact |

## Auto-Answer in Pipeline Phases

| Phase | Auto-Answer Active | Notes |
|-------|-------------------|-------|
| Pre-flight | Yes | Environment checks proceed automatically |
| Implementation | Yes | Agent confirmations auto-approved |
| Testing | Yes | Test runs proceed without pause |
| Fix loops | Yes | Fix agents launched automatically |
| UAT | Yes | Automated UAT runs without pause |
| QA Review | Yes | Code review agents launched automatically |
| Final commit | Yes | Commit proceeds (non-force, local only) |

## Manual Override

To disable auto-answer for a specific execution:

```bash
/rw-kit:execute plans/01-1-feature-todolist.md --auto-answer false
/rw-kit:implement feature-name feature --auto-answer false
```

When auto-answer is disabled:
- Every confirmation prompt pauses for user input
- User must manually approve each agent action
- Useful for debugging or reviewing each step

## Integration with Pipeline

The auto-answer hook works with the pipeline's retry and escalation system:

- **Task retries**: Auto-answer allows fix agents to launch without confirmation
- **Phase fix loops**: Auto-answer allows test re-runs without confirmation
- **QA cycles**: Auto-answer allows QA fix agents without confirmation
- **BLOCKED/DEGRADED**: These states are logged and reported, not prompted - auto-answer is not involved
