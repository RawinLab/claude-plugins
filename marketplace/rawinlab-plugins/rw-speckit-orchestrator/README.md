# Speckit Orchestrator v3.1

Automated workflow orchestrator for Spec-Kit driven development using Task Tool.

## Features

- **Task Tool Based**: Spawns worker agents via Task Tool for each feature
- **Auto-Answer**: Workers auto-answer ALL prompts, no user intervention
- **Context Management**: Automatic /context + /compact at every level
- **Full Testing Pipeline**: Verify → Write Tests → Run Tests → Smoke Test
- **Retry Support**: Failed workers can be resumed/retried (max 3 times)
- **One Feature at a Time**: Complete each feature before moving to next

## Installation

```bash
claude plugins add rawinlab-plugins/rw-speckit-orchestrator
```

## Prerequisites

```bash
# Install Spec-Kit CLI
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Verify
specify --version
```

Other requirements:
- jq (for state file parsing)
- gh CLI (for PR creation)

## Quick Start

```bash
# New project
/setup-speckit
/orchestrate

# Skip to feature 009
/orchestrate --start-from "009"

# Resume
/orchestrate --resume true
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  MAIN ORCHESTRATOR                          │
│  - Parse guide, manage state                                │
│  - Spawn Task workers for each feature                      │
│  - Handle retries, update progress                          │
│  - MANAGE CONTEXT: /context + /compact                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Task Tool
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker Agent (per feature)                                 │
│  specify → clarify → plan → analyze → implement → PR        │
│  - AUTO-ANSWER all prompts                                  │
│  - MANAGE CONTEXT: /context + /compact                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Task Tool (parallel possible)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Subagents (during implement)                               │
│  frontend-developer, backend-architect, etc.                │
│  - MANAGE CONTEXT: /context + /compact                      │
└─────────────────────────────────────────────────────────────┘
```

## Workflow

**One feature at a time, all phases complete before next:**

```
Feature 009:
  ┌─ SPECKIT PHASES ─────────────────────────┐
  │ 1. /speckit.specify                      │
  │ 2. /speckit.clarify  ← auto-answer       │
  │ 3. /speckit.plan                         │
  │ 4. /speckit.analyze  ← auto-answer YES   │
  │ 5. /speckit.implement ← spawn subagents  │
  └──────────────────────────────────────────┘
                    │
                    ▼
  ┌─ TESTING PIPELINE ───────────────────────┐
  │ 6. Verify (build, tsc, no TODO)          │
  │ 7. Write Tests (use test-automator)      │
  │ 8. Run Tests (max 3 retries if fail)     │
  │ 9. Smoke Test (optional - run app)       │
  └──────────────────────────────────────────┘
                    │
                    ▼
  ┌─ FINALIZE ───────────────────────────────┐
  │ 10. Create PR → Merge                    │
  └──────────────────────────────────────────┘
  ✓ Done

Feature 010:
  ... (repeat)
```

## Auto-Answer Behavior

Workers **never wait for user input**:

| Prompt | Response |
|--------|----------|
| "Would you like to...?" | YES |
| "Proceed?" | YES |
| Multiple choice | Select **recommended** |
| "Approve changes?" | YES |

## Context Management

**Every level manages its own context:**

```
Orchestrator:
├── /context → check usage
├── /compact → after each feature
│
└── Worker:
    ├── /context → check after each phase
    ├── /compact → if > 50%, always before implement
    │
    └── Subagents:
        ├── /context → check regularly
        └── /compact → if > 70%
```

## Commands

### `/orchestrate`

| Argument | Default | Description |
|----------|---------|-------------|
| `--guide` | `./speckit-guide.md` | Path to guide file |
| `--resume` | `false` | Resume from state |
| `--start-from` | - | Start from feature ID |
| `--set-completed` | - | Mark features as done |

### `/orch-status`

Check current progress.

### `/orch-stop`

Stop gracefully (state saved).

## Retry Mechanism

```
Worker fails
    │
    ▼
retry_count < 3?
    │
    ├── YES → Resume worker with context
    │
    └── NO → Mark failed, continue to next feature
```

## State File

`.claude/orchestrator.state.json`:

```json
{
  "version": "3.0.0",
  "status": "running",
  "current_feature": "009",
  "progress": {
    "total": 15,
    "completed": 8,
    "failed": 0,
    "pending": 7
  },
  "features": {
    "009": {
      "name": "ai-image-generation",
      "status": "in_progress",
      "retry_count": 0
    }
  }
}
```

## Key Principles

1. **Task Tool** - Spawn workers via Task, not direct execution
2. **Auto-Answer** - Never wait for user, answer YES/recommended
3. **Context Management** - /context + /compact at every level
4. **Testing Pipeline** - Verify → Write Tests → Run Tests → Smoke Test
5. **Tests Must Pass** - Max 3 retries, then mark failed
6. **Retry on Failure** - Resume failed workers up to 3 times
7. **One at a Time** - Complete feature before next
8. **No Mocks** - Real work only, no fake data

## Troubleshooting

### Reset

```bash
rm .claude/orchestrator.state.json
/orchestrate
```

### Check status

```bash
cat .claude/orchestrator.state.json | jq '.features["009"]'
```

### Retry feature

```bash
jq '.features["009"].status = "pending" | .features["009"].retry_count = 0' \
  .claude/orchestrator.state.json > tmp && mv tmp .claude/orchestrator.state.json
```

## License

MIT

## Author

RawinLab
