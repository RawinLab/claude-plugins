---
name: orchestrate
description: Start automated Spec-Kit workflow orchestration for all features
arguments:
  - name: guide
    description: Path to speckit-guide.md file
    required: false
    default: "./speckit-guide.md"
  - name: workers
    description: Number of parallel workers (1-8)
    required: false
    default: "4"
  - name: set-completed
    description: Comma-separated feature IDs to mark as already completed (e.g., "001,002,003")
    required: false
  - name: start-from
    description: Feature ID to start from (skip earlier features)
    required: false
  - name: dry-run
    description: Parse guide and show plan without executing
    required: false
    default: "false"
---

# Speckit Orchestrator - Start Command

You are the Speckit Orchestrator Coordinator. Your job is to set up and start the automated workflow.

## Your Mission

**CRITICAL: Ensure ALL features in speckit-guide.md are fully implemented.**

This is your PRIMARY and NON-NEGOTIABLE goal. You must:
1. Set up the orchestration infrastructure
2. Ensure workers are spawned to process ALL features
3. The watchdog will keep workers running until 100% complete

## Arguments Received

- **Guide Path**: ${guide}
- **Workers Count**: ${workers}
- **Set Completed**: ${set-completed}
- **Start From**: ${start-from}
- **Dry Run**: ${dry-run}

## Step 1: Parse speckit-guide.md

Read the guide file and extract:
1. Project name
2. List of all features with:
   - Feature ID (e.g., "001", "002")
   - Feature name
   - Priority (P0, P1, P2, etc.)
   - Dependencies (which features must complete first)
   - Phase (1, 2, 3, etc.)

Use the `guide-parser` skill to help with this.

## Step 2: Create Initial State File

Create `.claude/orchestrator.state.json` with:

```json
{
  "version": "1.0.0",
  "session_id": "speckit-orch-{timestamp}",
  "started_at": "{ISO timestamp}",
  "updated_at": "{ISO timestamp}",
  "status": "running",
  "config": {
    "guide_path": "{guide}",
    "workers_count": {workers},
    "project_name": "{from guide}",
    "project_path": "{current directory}"
  },
  "progress": {
    "total_features": {count},
    "completed": 0,
    "in_progress": 0,
    "pending": {count},
    "failed": 0
  },
  "features": {
    "001": {
      "name": "feature-name",
      "status": "pending",
      "priority": "P0",
      "dependencies": [],
      "steps_completed": [],
      "current_step": null,
      "worker_id": null,
      "retry_count": 0
    }
  },
  "workers": {}
}
```

If `--set-completed` is provided, mark those features as completed with all steps done.

## Step 3: Setup tmux Session

Create tmux session with layout:
- Pane 0: Dashboard (top)
- Panes 1-N: Workers (bottom, side by side)

```bash
# Create session
tmux new-session -d -s speckit-orch -x 200 -y 50

# Split for dashboard (top 40%)
tmux split-window -v -p 60 -t speckit-orch

# Split worker panes horizontally
# For 4 workers, split pane 1 into 4 equal parts
```

## Step 4: Start Watchdog Script

Start the watchdog.sh script in the background:

```bash
# The watchdog runs in the dashboard pane or separately
nohup ${CLAUDE_PLUGIN_ROOT}/scripts/watchdog.sh > .claude/watchdog.log 2>&1 &
```

The watchdog will:
- Monitor if workers are idle
- Wake up idle workers by running claude command
- Check if all features complete
- Exit only when 100% done

## Step 5: Spawn Initial Workers

For each worker pane, start a Claude Code session with the worker agent:

```bash
tmux send-keys -t speckit-orch:0.{pane} "claude --print '$(cat <<EOF
You are Worker {N}.
Read state file: .claude/orchestrator.state.json
Find next pending feature and execute the speckit workflow.
Update state file with progress.
When done, pick next feature or exit if none.
EOF
)'" Enter
```

## Step 6: Output Summary

After setup, output:

```
Speckit Orchestrator Started
============================
Project: {project_name}
Guide: {guide_path}
Features: {total} total, {pending} pending
Workers: {workers_count}

Session: speckit-orch
Dashboard: tmux attach -t speckit-orch

Watchdog PID: {pid}
State File: .claude/orchestrator.state.json

The orchestrator will run until ALL features are complete.
Press Ctrl+C in tmux to stop (state will be saved for resume).
```

## Dry Run Mode

If `--dry-run` is true:
1. Parse the guide
2. Show the feature list and execution plan
3. Do NOT create tmux session or start workers
4. Exit after showing plan

## Important Notes

1. **All Logic is in Claude Agents** - The watchdog.sh is dumb, it only monitors and wakes up workers
2. **Workers Decide What To Do** - Each worker reads state file and picks next pending feature
3. **State File is Truth** - All coordination happens through the state file
4. **Verification in Workers** - Workers verify their own implementation completeness
