# Speckit Orchestrator v2.0

Automated workflow orchestrator for Spec-Kit driven development. Run a single command to implement ALL features from your speckit-guide.md.

## Features

- **Task Tool Based**: Uses Claude's native Task tool for parallel execution
- **Phase-based Workflow**: Sequential phases (specify→clarify→plan→analyze) then parallel implementation
- **Auto-Answer**: Automatically selects recommended options
- **Resume Support**: Stop and resume from saved state
- **No External Dependencies**: No tmux or watchdog scripts needed

## Installation

```bash
# Add to your Claude Code plugins
claude plugins add rawinlab-plugins/speckit-orchestrator
```

## Prerequisites

### Install Spec-Kit CLI

```bash
# Option 1: Using uv (recommended)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Option 2: Using pip
pip install specify-cli

# Verify installation
specify --version
```

### Other Requirements

- Claude Code CLI
- jq (for state file parsing)
- gh CLI (for PR creation)

## Quick Start

### Option 1: New Project (Full Setup)

```bash
# 1. Navigate to your project
cd /path/to/your/project

# 2. Run setup wizard to create speckit-guide.md
/setup-speckit

# 3. Initialize Spec-Kit
specify init . --ai claude --force

# 4. Create constitution (project principles)
/speckit.constitution

# 5. Start orchestration to implement all features
/orchestrate
```

### Option 2: Existing Project

```bash
# Navigate to your project with speckit-guide.md
cd /path/to/your/project

# Start orchestration with 3 parallel workers
/orchestrate --parallel 3
```

### Option 3: Resume

```bash
# Resume from saved state
/orchestrate --resume true
```

## Commands

### `/orchestrate`

Start the orchestration workflow.

**Arguments:**
| Argument | Default | Description |
|----------|---------|-------------|
| `--guide` | `./speckit-guide.md` | Path to speckit guide file |
| `--parallel` | `3` | Number of parallel workers for implement phase |
| `--resume` | `false` | Resume from existing state |

**Examples:**

```bash
# Basic usage
/orchestrate

# Custom parallelism
/orchestrate --parallel 5

# Resume
/orchestrate --resume true
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
┌──────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                              │
│  /orchestrate command - runs all phases                      │
└──────────────────────────────────────────────────────────────┘
                              │
    ╔═════════════════════════╪═══════════════════════════════╗
    ║  Phase 1-4: SEQUENTIAL (specify, clarify, plan, analyze) ║
    ╠═════════════════════════╪═══════════════════════════════╣
    ║  Feature A → Feature B → Feature C → ...                 ║
    ╚═════════════════════════╪═══════════════════════════════╝
                              │
    ╔═════════════════════════╪═══════════════════════════════╗
    ║  Phase 5: PARALLEL (implement via Task tool)             ║
    ╠═════════════════════════╪═══════════════════════════════╣
    ║  ┌─────────┐  ┌─────────┐  ┌─────────┐                  ║
    ║  │Worker A │  │Worker B │  │Worker C │  ... (parallel)   ║
    ║  └─────────┘  └─────────┘  └─────────┘                  ║
    ╚═════════════════════════════════════════════════════════╝
```

## Workflow

1. **Parse Guide**: Read speckit-guide.md, extract all features
2. **Create State**: Initialize `.claude/orchestrator.state.json`
3. **Sequential Phases** (for each feature):
   - `/speckit.specify` - Define the feature
   - `/speckit.clarify` - Answer questions (auto-select recommended)
   - `/speckit.plan` - Create implementation plan
   - `/speckit.analyze` - Analyze codebase
4. **Parallel Implementation**:
   - Spawn multiple Task agents
   - Each runs `/speckit.implement` for one feature
   - Create PR and merge
5. **Complete**: All features implemented and merged

## State File

All coordination happens through `.claude/orchestrator.state.json`:

```json
{
  "version": "2.0.0",
  "status": "running",
  "current_phase": "implement",
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
      "phase_status": {
        "specify": "completed",
        "clarify": "completed",
        "plan": "completed",
        "analyze": "completed",
        "implement": "completed"
      }
    }
  }
}
```

## Key Design Principles

1. **Native Task Tool**: Uses Claude's built-in Task tool, no external scripts
2. **Sequential then Parallel**: Prep work sequential, implementation parallel
3. **State File is Truth**: Single source of coordination
4. **Auto-Answer**: Select recommended options automatically
5. **Verify Before Complete**: Workers verify their work is done

## Troubleshooting

### State file issues

Reset state:
```bash
rm .claude/orchestrator.state.json
/orchestrate
```

### Check feature status

```bash
cat .claude/orchestrator.state.json | jq '.features["003"]'
```

### Manual retry

```bash
# Update state to mark as pending
jq '.features["003"].phase_status.implement = "pending"' .claude/orchestrator.state.json > tmp && mv tmp .claude/orchestrator.state.json
```

## License

MIT

## Author

RawinLab
