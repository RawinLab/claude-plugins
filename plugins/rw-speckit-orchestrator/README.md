# Speckit Orchestrator v2.1

Automated workflow orchestrator for Spec-Kit driven development. Run a single command to implement ALL features from your speckit-guide.md.

## Features

- **One Feature at a Time**: Complete each feature entirely before moving to next
- **Full Automation**: Auto-answers all prompts, no user intervention needed
- **Resume Support**: Stop and resume from saved state
- **Skip Completed**: Start from any feature, skip already-done work
- **No External Dependencies**: No tmux or watchdog scripts needed

## Installation

```bash
# Add to your Claude Code plugins
claude plugins add rawinlab-plugins/rw-speckit-orchestrator
```

## Prerequisites

### Install Spec-Kit CLI

```bash
# Using uv (recommended)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Verify installation
specify --version
```

### Other Requirements

- Claude Code CLI
- jq (for state file parsing)
- gh CLI (for PR creation)

## Quick Start

### New Project

```bash
cd /path/to/your/project

# 1. Create speckit-guide.md
/setup-speckit

# 2. Initialize Spec-Kit
specify init . --ai claude --force

# 3. Create constitution
/speckit.constitution

# 4. Start orchestration
/orchestrate
```

### Existing Project (Skip Completed Features)

```bash
# Start from feature 009 (skip 001-008)
/orchestrate --start-from "009"

# Or specify which are done
/orchestrate --set-completed "001,002,003,004,005,006,007,008"
```

### Resume

```bash
/orchestrate --resume true
```

## Commands

### `/orchestrate`

Start the orchestration workflow.

| Argument | Default | Description |
|----------|---------|-------------|
| `--guide` | `./speckit-guide.md` | Path to speckit guide file |
| `--resume` | `false` | Resume from existing state |
| `--start-from` | - | Start from specific feature ID (e.g., "009") |
| `--set-completed` | - | Mark features as done (e.g., "001,002,003") |

**Examples:**

```bash
# Basic - start from beginning
/orchestrate

# Start from feature 009
/orchestrate --start-from "009"

# Resume interrupted work
/orchestrate --resume true
```

### `/orch-status`

Check current orchestration status.

### `/orch-stop`

Stop orchestration gracefully (state is saved for resume).

## Workflow

**One feature at a time, all phases complete before next:**

```
Feature 001: specify → clarify → plan → analyze → implement → PR → merge ✓
Feature 002: specify → clarify → plan → analyze → implement → PR → merge ✓
Feature 003: specify → clarify → plan → analyze → implement → PR → merge ✓
...
```

### Phases

| Phase | Command | Auto-behavior |
|-------|---------|---------------|
| 1. Specify | `/speckit.specify` | Define feature spec |
| 2. Clarify | `/speckit.clarify` | Auto-select recommended options |
| 3. Plan | `/speckit.plan` | Create implementation plan |
| 4. Analyze | `/speckit.analyze` | Auto-approve all suggested edits |
| 5. Implement | `/speckit.implement` | Auto-confirm all prompts |

### Auto-Answer Behavior

The orchestrator **never waits for user input**:
- Answers "yes" to all confirmations
- Selects "recommended" options always
- Accepts suggested edits/remediation automatically
- Approves all changes without asking

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                           │
│  /orchestrate --start-from "009"                          │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  Feature 009                                               │
│  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌───────────┐  │
│  │specify │→│clarify │→│ plan │→│analyze │→│ implement │  │
│  └────────┘ └────────┘ └──────┘ └────────┘ └───────────┘  │
│                                                    ↓       │
│                                              PR → Merge    │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  Feature 010                                               │
│  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌───────────┐  │
│  │specify │→│clarify │→│ plan │→│analyze │→│ implement │  │
│  └────────┘ └────────┘ └──────┘ └────────┘ └───────────┘  │
│                                                    ↓       │
│                                              PR → Merge    │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
                         ...
```

## State File

`.claude/orchestrator.state.json`:

```json
{
  "version": "2.0.0",
  "status": "running",
  "current_feature": "009",
  "progress": {
    "total_features": 15,
    "completed": 8,
    "in_progress": 1,
    "pending": 6
  },
  "features": {
    "009": {
      "name": "ai-image-generation",
      "status": "in_progress",
      "current_phase": "implement",
      "phases_completed": ["specify", "clarify", "plan", "analyze"]
    }
  }
}
```

## Key Design Principles

1. **One Feature at a Time**: Complete ALL phases before moving to next feature
2. **Sequential Phases**: specify → clarify → plan → analyze → implement
3. **Auto-Answer Everything**: Never wait for user input
4. **Merge Before Next**: PR must be merged before starting next feature
5. **State is Truth**: State file tracks all progress
6. **No Mocks**: All implementation must be real, working code

## Troubleshooting

### Reset and start over

```bash
rm .claude/orchestrator.state.json
/orchestrate
```

### Check feature status

```bash
cat .claude/orchestrator.state.json | jq '.features["009"]'
```

### Retry a feature

```bash
jq '.features["009"].status = "pending" | .features["009"].phases_completed = []' \
  .claude/orchestrator.state.json > tmp && mv tmp .claude/orchestrator.state.json
```

## License

MIT

## Author

RawinLab
