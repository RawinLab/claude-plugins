#!/bin/bash
#
# watchdog.sh - Dumb Monitor Script
#
# This script is INTENTIONALLY SIMPLE. It does NOT:
# - Parse speckit-guide.md
# - Decide which feature to work on
# - Verify implementation quality
# - Make any complex decisions
#
# It ONLY:
# - Monitors if workers are idle
# - Wakes up idle workers
# - Checks if all features complete
# - Updates dashboard display
#

set -e

# Configuration
STATE_FILE=".claude/orchestrator.state.json"
DASHBOARD_FILE=".claude/dashboard.txt"
CHECK_INTERVAL=10  # seconds
# Use project-specific tmux session name to isolate from other projects
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
TMUX_SESSION="speckit-${PROJECT_NAME}"
LOG_FILE=".claude/watchdog.log"

# Colors for dashboard
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if state file exists
wait_for_state_file() {
    while [ ! -f "$STATE_FILE" ]; do
        log "Waiting for state file..."
        sleep 2
    done
    log "State file found"
}

# Simple check: are all features complete?
check_all_complete() {
    if [ ! -f "$STATE_FILE" ]; then
        return 1
    fi

    local completed=$(jq -r '.progress.completed // 0' "$STATE_FILE" 2>/dev/null || echo "0")
    local total=$(jq -r '.progress.total_features // 0' "$STATE_FILE" 2>/dev/null || echo "0")

    if [ "$completed" -eq "$total" ] && [ "$total" -gt 0 ]; then
        return 0  # All complete
    fi
    return 1  # Not complete
}

# Check if a feature's dependencies are all completed
check_dependencies_complete() {
    local feature_id=$1
    local deps=$(jq -r ".features.\"$feature_id\".dependencies[]?" "$STATE_FILE" 2>/dev/null)

    if [ -z "$deps" ]; then
        return 0  # No dependencies
    fi

    for dep in $deps; do
        local dep_status=$(jq -r ".features.\"$dep\".status // \"pending\"" "$STATE_FILE" 2>/dev/null)
        if [ "$dep_status" != "completed" ]; then
            return 1  # Dependency not complete
        fi
    done
    return 0  # All dependencies complete
}

# Get next pending feature that has all dependencies completed
get_next_pending_feature() {
    local features=$(jq -r '.features | to_entries | sort_by(.key) | .[].key' "$STATE_FILE" 2>/dev/null)

    for feat in $features; do
        local status=$(jq -r ".features.\"$feat\".status // \"pending\"" "$STATE_FILE" 2>/dev/null)

        if [ "$status" == "pending" ]; then
            if check_dependencies_complete "$feat"; then
                echo "$feat"
                return 0
            fi
        fi
    done
    return 1  # No pending feature with completed dependencies
}

# Check if there's work available (pending features with deps met)
has_available_work() {
    local next=$(get_next_pending_feature)
    [ -n "$next" ]
}

# Simple check: is a tmux pane idle?
is_pane_idle() {
    local pane=$1

    # Check if pane exists
    if ! tmux list-panes -t "$TMUX_SESSION:0.$pane" &>/dev/null; then
        return 1  # Pane doesn't exist
    fi

    # Check current command - if it's just bash/zsh, pane is idle
    local cmd=$(tmux list-panes -t "$TMUX_SESSION:0.$pane" -F '#{pane_current_command}' 2>/dev/null)

    case "$cmd" in
        bash|zsh|sh|fish)
            return 0  # Idle
            ;;
        *)
            return 1  # Running something
            ;;
    esac
}

# Wake up an idle worker by starting claude with the worker agent
wake_up_worker() {
    local pane=$1
    local worker_id="worker-$pane"

    # Check if there's work available before waking
    if ! has_available_work; then
        log "No work available for $worker_id (all pending features blocked by dependencies)"
        return 1
    fi

    local next_feature=$(get_next_pending_feature)
    local feature_name=$(jq -r ".features.\"$next_feature\".name // \"unknown\"" "$STATE_FILE" 2>/dev/null)
    log "Waking up $worker_id in pane $pane for feature $next_feature: $feature_name"

    # Single-line prompt to avoid quote issues
    local prompt="You are Speckit Worker. Read .claude/orchestrator.state.json, claim feature $next_feature, then run ALL steps: /speckit.specify, /speckit.clarify, /speckit.plan, /speckit.tasks, /speckit.analyze, /speckit.implement. Auto-answer recommended options. Create PR, merge to main, update state. Continue to next feature or exit if done."

    # Start claude with single-line prompt
    tmux send-keys -t "$TMUX_SESSION:0.$pane" "claude -p '$prompt'" Enter
}

# Get number of workers from state file
get_worker_count() {
    jq -r '.config.workers_count // 4' "$STATE_FILE" 2>/dev/null || echo "4"
}

# Render simple dashboard
render_dashboard() {
    if [ ! -f "$STATE_FILE" ]; then
        echo "Waiting for orchestration to start..." > "$DASHBOARD_FILE"
        return
    fi

    local project=$(jq -r '.config.project_name // "Unknown"' "$STATE_FILE")
    local total=$(jq -r '.progress.total_features // 0' "$STATE_FILE")
    local completed=$(jq -r '.progress.completed // 0' "$STATE_FILE")
    local in_progress=$(jq -r '.progress.in_progress // 0' "$STATE_FILE")
    local failed=$(jq -r '.progress.failed // 0' "$STATE_FILE")
    local pending=$((total - completed - in_progress - failed))

    # Calculate percentage
    local percent=0
    if [ "$total" -gt 0 ]; then
        percent=$((completed * 100 / total))
    fi

    # Build progress bar
    local bar_width=40
    local filled=$((percent * bar_width / 100))
    local empty=$((bar_width - filled))
    local progress_bar=$(printf "%${filled}s" | tr ' ' '#')$(printf "%${empty}s" | tr ' ' '-')

    # Get worker status
    local workers_status=""
    local worker_count=$(get_worker_count)
    for i in $(seq 1 $worker_count); do
        local worker_id="worker-$i"
        local feature=$(jq -r ".workers.\"$worker_id\".current_feature // \"-\"" "$STATE_FILE" 2>/dev/null)
        local status=$(jq -r ".workers.\"$worker_id\".status // \"idle\"" "$STATE_FILE" 2>/dev/null)
        workers_status="${workers_status}  $worker_id: $feature ($status)\n"
    done

    # Get recent completed features
    local recent_completed=$(jq -r '[.features | to_entries[] | select(.value.status == "completed") | .key] | sort | reverse | .[0:5] | join(", ")' "$STATE_FILE" 2>/dev/null || echo "-")

    # Get in progress features
    local in_progress_list=$(jq -r '[.features | to_entries[] | select(.value.status == "in_progress") | "\(.key):\(.value.current_step // "?")")] | join(", ")' "$STATE_FILE" 2>/dev/null || echo "-")

    # Write dashboard
    cat > "$DASHBOARD_FILE" << EOF
================================================================================
                    SPECKIT ORCHESTRATOR - $project
================================================================================

  Progress: [$progress_bar] $percent%

  Features: $completed/$total complete | $in_progress in progress | $failed failed

--------------------------------------------------------------------------------
  WORKERS
--------------------------------------------------------------------------------
$(echo -e "$workers_status")
--------------------------------------------------------------------------------
  STATUS
--------------------------------------------------------------------------------
  Completed: $recent_completed
  In Progress: $in_progress_list

--------------------------------------------------------------------------------
  Last Update: $(date '+%Y-%m-%d %H:%M:%S')
================================================================================
EOF
}

# Display dashboard in terminal
display_dashboard() {
    if [ -f "$DASHBOARD_FILE" ]; then
        clear
        cat "$DASHBOARD_FILE"
    fi
}

# Main watchdog loop
main_loop() {
    log "Watchdog started"

    # Wait for state file to be created
    wait_for_state_file

    local worker_count=$(get_worker_count)
    log "Monitoring $worker_count workers"

    while true; do
        # 1. Check if ALL features complete
        if check_all_complete; then
            log "All features complete!"
            render_dashboard
            display_dashboard
            echo ""
            echo "ALL FEATURES COMPLETE! Orchestration finished."
            exit 0
        fi

        # 2. Check each worker pane - wake up if idle
        for pane in $(seq 1 $worker_count); do
            if is_pane_idle "$pane"; then
                wake_up_worker "$pane"
                sleep 2  # Small delay between spawns
            fi
        done

        # 3. Render and display dashboard
        render_dashboard
        display_dashboard

        # 4. Sleep before next check
        sleep "$CHECK_INTERVAL"
    done
}

# Handle signals
cleanup() {
    log "Watchdog stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Entry point
echo "Speckit Orchestrator Watchdog"
echo "============================="
echo "State File: $STATE_FILE"
echo "Check Interval: ${CHECK_INTERVAL}s"
echo ""

main_loop
