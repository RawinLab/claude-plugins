# Speckit Orchestrator

Automated workflow orchestrator for Spec-Kit driven development. Run a single command to implement ALL features from your speckit-guide.md.

## Features

- **Parallel Workers**: Run multiple Claude Code agents simultaneously
- **Real-time Dashboard**: Monitor progress via tmux
- **Auto-Answer**: Automatically answer clarify/analyze questions
- **Guaranteed Completion**: Watchdog ensures all features are implemented
- **Resume Support**: Stop and resume from saved state
- **Import Progress**: Start from existing manually-completed features

## Installation

```bash
# Add to your Claude Code plugins
claude plugins add rawinlab-plugins/speckit-orchestrator
```

Or clone manually:

```bash
cd ~/.claude/plugins
git clone https://github.com/RawinLab/claude-plugins
```

## Quick Start

### Option 1: New Project (Create speckit-guide.md first)

```bash
# Navigate to your project
cd /path/to/your/project

# Run setup wizard to create speckit-guide.md
/setup-speckit

# Then start orchestration
/orchestrate
```

### Option 2: Existing Project (Already has speckit-guide.md)

```bash
# Navigate to your project with speckit-guide.md
cd /path/to/your/project

# Start orchestration
/orchestrate

# Or with options
/orchestrate --guide ./speckit-guide.md --workers 4
```

## Commands

### `/setup-speckit`

Interactive wizard to create speckit-guide.md for your project.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `--reference_guide` | No | Path to reference speckit-guide from another project |

**What it does:**
1. Analyzes your project's requirements documents
2. Creates comprehensive speckit-guide.md
3. Sets up Spec-Kit configuration
4. Optionally creates constitution

**Example:**

```bash
# Start setup wizard
/setup-speckit

# Use another project's guide as reference
/setup-speckit --reference_guide ../other-project/speckit-guide.md
```

---

### `/orchestrate`

Start the orchestration workflow.

**Arguments:**
| Argument | Default | Description |
|----------|---------|-------------|
| `--guide` | `./speckit-guide.md` | Path to speckit guide file |
| `--workers` | `4` | Number of parallel workers (1-8) |
| `--set-completed` | - | Mark features as already done (e.g., "001,002,003") |
| `--start-from` | - | Start from specific feature |
| `--dry-run` | `false` | Show plan without executing |

**Examples:**

```bash
# Basic usage
/orchestrate

# Custom worker count
/orchestrate --workers 6

# Import manual progress
/orchestrate --set-completed "001,002,003,004,005"

# Start from feature 006
/orchestrate --start-from 006

# Preview what will happen
/orchestrate --dry-run
```

### `/orch-status`

Check current orchestration status.

```bash
/orch-status
```

### `/orch-stop`

Stop orchestration gracefully (state is saved for resume).

```bash
/orch-stop
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    /orchestrate command                      │
│                    (Coordinator Agent)                       │
│  - Parse speckit-guide.md                                   │
│  - Create state file                                        │
│  - Setup tmux session                                       │
│  - Start watchdog                                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    watchdog.sh                               │
│                    (Dumb Monitor)                            │
│  - Check if workers are idle                                │
│  - Wake up idle workers                                     │
│  - Check if all complete                                    │
│  - NO complex logic - just monitor                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Worker Agents                             │
│                    (Smart Brain)                             │
│  - Read state file, find next feature                       │
│  - Execute speckit workflow                                 │
│  - Verify implementation complete                           │
│  - Update state file                                        │
│  - ALL logic is here                                        │
└─────────────────────────────────────────────────────────────┘
```

## State File

All coordination happens through `.claude/orchestrator.state.json`:

```json
{
  "progress": {
    "total_features": 20,
    "completed": 12,
    "in_progress": 3,
    "pending": 5
  },
  "features": {
    "001": {
      "name": "channel-management",
      "status": "completed",
      "steps_completed": ["specify", "clarify", "plan", "tasks", "analyze", "implement"]
    }
  },
  "workers": {
    "W1": { "status": "busy", "current_feature": "013" }
  }
}
```

## Dashboard

View live progress:

```bash
tmux attach -t speckit-orch
```

```
================================================================================
                    SPECKIT ORCHESTRATOR - Vidiwo
================================================================================

  Progress: [################--------] 65%

  Features: 13/20 complete | 3 in progress | 0 failed

--------------------------------------------------------------------------------
  WORKERS
--------------------------------------------------------------------------------
  W1: 014 (busy) - implement
  W2: 015 (busy) - plan
  W3: 016 (busy) - clarify
  W4: - (idle)

--------------------------------------------------------------------------------
  Last Update: 2025-12-26 15:30:45
================================================================================
```

## Key Design Principles

1. **Shell Script is Dumb**: The watchdog only monitors and restarts - no logic
2. **Agents are Smart**: All parsing, decision-making, and verification in Claude agents
3. **State File is Truth**: Single source of coordination between workers
4. **Verify Before Complete**: Workers verify their own work is truly done
5. **Continue, Don't Restart**: Resume incomplete work from where it stopped

## Requirements

- Claude Code CLI
- tmux
- jq (for state file parsing)
- Spec-Kit CLI installed and configured

## Troubleshooting

### Workers not starting

Check tmux session exists:
```bash
tmux list-sessions | grep speckit-orch
```

### State file issues

Reset state:
```bash
rm .claude/orchestrator.state.json
/orchestrate
```

### Stuck on a feature

Check feature status:
```bash
cat .claude/orchestrator.state.json | jq '.features["003"]'
```

Manual retry:
```bash
# Update state to mark as pending
jq '.features["003"].status = "pending"' .claude/orchestrator.state.json > tmp && mv tmp .claude/orchestrator.state.json
```

## License

MIT

## Author

RawinLab
