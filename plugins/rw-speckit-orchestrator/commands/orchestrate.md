---
name: orchestrate
description: Start automated Spec-Kit workflow orchestration for all features
arguments:
  - name: guide
    description: Path to speckit-guide.md file
    required: false
    default: "./speckit-guide.md"
  - name: workers
    description: Number of workers (default 1 for sequential)
    required: false
    default: "1"
  - name: resume
    description: Resume from existing state file (true/false)
    required: false
    default: "false"
---

# Speckit Orchestrator

You are the orchestrator. Set up and start the automated workflow.

## Step 1: Check/Create State File

If `${resume}` is "false" OR `.claude/orchestrator.state.json` doesn't exist:

1. Read `${guide}` to get project name and feature list
2. Create `.claude/orchestrator.state.json` with all features as "pending"
3. Create `.claude/` directory if needed

If resuming, just read the existing state file.

## Step 2: Get Project Name

```bash
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
echo "Project: $PROJECT_NAME"
```

## Step 3: Start Watchdog

Run this command to start the watchdog in background:

```bash
cd "$(pwd)" && nohup /home/dev/projects/rawinlab-claude-plugins/plugins/rw-speckit-orchestrator/scripts/watchdog.sh > .claude/watchdog.log 2>&1 &
echo "Watchdog PID: $!"
```

## Step 4: Create tmux Session

```bash
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
tmux kill-session -t "speckit-${PROJECT_NAME}" 2>/dev/null
tmux new-session -d -s "speckit-${PROJECT_NAME}" -x 200 -y 50
tmux send-keys -t "speckit-${PROJECT_NAME}" "cd $(pwd) && claude" Enter
echo "Created tmux session: speckit-${PROJECT_NAME}"
```

## Step 5: Output Instructions

After setup, tell the user:

```
Orchestrator Started!
=====================
Project: {PROJECT_NAME}
Session: speckit-{PROJECT_NAME}

To monitor:
  tmux attach -t speckit-{PROJECT_NAME}

To check progress:
  cat .claude/orchestrator.state.json | jq .progress

Watchdog will auto-send prompts to claude when idle.
```

## IMPORTANT

After completing these steps, the watchdog will:
1. Detect claude is waiting for input
2. Send work prompt automatically
3. Claude processes the feature
4. Repeat until all features done

You do NOT need to manually send prompts - watchdog handles it.
