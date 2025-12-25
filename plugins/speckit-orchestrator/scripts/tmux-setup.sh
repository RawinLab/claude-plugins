#!/bin/bash
#
# tmux-setup.sh - Setup tmux session for orchestration
#
# Usage: ./tmux-setup.sh [workers_count]
#

set -e

WORKERS=${1:-4}
SESSION_NAME="speckit-orch"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up tmux session: $SESSION_NAME with $WORKERS workers"

# Kill existing session if any
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

# Create new session (detached)
tmux new-session -d -s "$SESSION_NAME" -x 200 -y 50

# Name the window
tmux rename-window -t "$SESSION_NAME:0" 'orchestrator'

# Calculate split percentages for workers
# Dashboard takes top 35%, workers share bottom 65%

# First split: dashboard (top) vs workers area (bottom)
tmux split-window -v -t "$SESSION_NAME:0" -p 65

# Now split the worker area horizontally based on worker count
if [ "$WORKERS" -ge 2 ]; then
    # Split pane 1 in half
    tmux select-pane -t "$SESSION_NAME:0.1"
    tmux split-window -h -t "$SESSION_NAME:0.1" -p 50
fi

if [ "$WORKERS" -ge 3 ]; then
    # Split left half again
    tmux select-pane -t "$SESSION_NAME:0.1"
    tmux split-window -h -t "$SESSION_NAME:0.1" -p 50
fi

if [ "$WORKERS" -ge 4 ]; then
    # Split right half again
    tmux select-pane -t "$SESSION_NAME:0.3"
    tmux split-window -h -t "$SESSION_NAME:0.3" -p 50
fi

# For more than 4 workers, we'd need more complex layout
# This handles 1-4 workers

# Label panes (optional, for clarity)
tmux select-pane -t "$SESSION_NAME:0.0" -T "Dashboard"
for i in $(seq 1 $WORKERS); do
    tmux select-pane -t "$SESSION_NAME:0.$i" -T "Worker $i" 2>/dev/null || true
done

# Select dashboard pane
tmux select-pane -t "$SESSION_NAME:0.0"

echo "tmux session '$SESSION_NAME' created with $WORKERS worker panes"
echo ""
echo "Pane layout:"
echo "  0: Dashboard (watchdog)"
for i in $(seq 1 $WORKERS); do
    echo "  $i: Worker W$i"
done
echo ""
echo "To attach: tmux attach -t $SESSION_NAME"
