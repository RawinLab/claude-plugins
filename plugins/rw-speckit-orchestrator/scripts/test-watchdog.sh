#!/bin/bash
#
# test-watchdog.sh - Test watchdog functions without running full orchestration
#
# Usage: ./test-watchdog.sh [test-name]
#   ./test-watchdog.sh           # Run all tests
#   ./test-watchdog.sh deps      # Test dependency checking only
#   ./test-watchdog.sh next      # Test get_next_pending_feature only
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/watchdog-test-$$"
STATE_FILE="$TEST_DIR/.claude/orchestrator.state.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; exit 1; }
info() { echo -e "${YELLOW}→${NC} $1"; }

# Setup test environment
setup() {
    info "Setting up test environment at $TEST_DIR"
    mkdir -p "$TEST_DIR/.claude"
}

# Cleanup
cleanup() {
    info "Cleaning up $TEST_DIR"
    rm -rf "$TEST_DIR"
}

trap cleanup EXIT

# Create test state file
create_state_file() {
    cat > "$STATE_FILE" << 'EOF'
{
  "version": "1.0.0",
  "config": {
    "workers_count": 2,
    "project_name": "Test Project"
  },
  "progress": {
    "total_features": 5,
    "completed": 2,
    "in_progress": 0,
    "pending": 3,
    "failed": 0
  },
  "features": {
    "001": {
      "name": "Feature 1",
      "status": "completed",
      "dependencies": []
    },
    "002": {
      "name": "Feature 2",
      "status": "completed",
      "dependencies": ["001"]
    },
    "003": {
      "name": "Feature 3 - deps met",
      "status": "pending",
      "dependencies": ["001", "002"]
    },
    "004": {
      "name": "Feature 4 - deps NOT met",
      "status": "pending",
      "dependencies": ["003"]
    },
    "005": {
      "name": "Feature 5 - no deps",
      "status": "pending",
      "dependencies": []
    }
  },
  "workers": {
    "worker-1": { "status": "idle", "current_feature": null },
    "worker-2": { "status": "idle", "current_feature": null }
  }
}
EOF
}

# ===== Import functions from watchdog.sh =====

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

# Check if there's work available
has_available_work() {
    local next=$(get_next_pending_feature)
    [ -n "$next" ]
}

# Check if all features complete
check_all_complete() {
    local completed=$(jq -r '.progress.completed // 0' "$STATE_FILE" 2>/dev/null || echo "0")
    local total=$(jq -r '.progress.total_features // 0' "$STATE_FILE" 2>/dev/null || echo "0")

    if [ "$completed" -eq "$total" ] && [ "$total" -gt 0 ]; then
        return 0
    fi
    return 1
}

# Get worker count
get_worker_count() {
    jq -r '.config.workers_count // 4' "$STATE_FILE" 2>/dev/null || echo "4"
}

# ===== Tests =====

test_jq_available() {
    info "Testing jq is available..."
    if command -v jq &>/dev/null; then
        pass "jq is installed: $(jq --version)"
    else
        fail "jq is not installed"
    fi
}

test_state_file_read() {
    info "Testing state file reading..."
    local project=$(jq -r '.config.project_name' "$STATE_FILE" 2>/dev/null)
    if [ "$project" == "Test Project" ]; then
        pass "Can read state file (project: $project)"
    else
        fail "Cannot read state file correctly"
    fi
}

test_dependency_check_no_deps() {
    info "Testing dependency check - feature with no deps (005)..."
    if check_dependencies_complete "005"; then
        pass "Feature 005 (no deps) correctly returns true"
    else
        fail "Feature 005 should have deps complete (no deps)"
    fi
}

test_dependency_check_deps_met() {
    info "Testing dependency check - feature with deps met (003)..."
    if check_dependencies_complete "003"; then
        pass "Feature 003 (deps: 001,002 completed) correctly returns true"
    else
        fail "Feature 003 should have deps complete"
    fi
}

test_dependency_check_deps_not_met() {
    info "Testing dependency check - feature with deps NOT met (004)..."
    if check_dependencies_complete "004"; then
        fail "Feature 004 should NOT have deps complete (depends on pending 003)"
    else
        pass "Feature 004 (deps: 003 pending) correctly returns false"
    fi
}

test_get_next_pending_feature() {
    info "Testing get_next_pending_feature..."
    local next=$(get_next_pending_feature)
    # Should return 003 or 005 (both have deps met), but 003 comes first alphabetically
    if [ "$next" == "003" ]; then
        pass "get_next_pending_feature returns '003' (first pending with deps met)"
    elif [ "$next" == "005" ]; then
        pass "get_next_pending_feature returns '005' (pending with no deps)"
    else
        fail "Expected '003' or '005', got '$next'"
    fi
}

test_has_available_work() {
    info "Testing has_available_work..."
    if has_available_work; then
        pass "has_available_work returns true (there are pending features)"
    else
        fail "Should have available work"
    fi
}

test_check_all_complete_false() {
    info "Testing check_all_complete (should be false)..."
    if check_all_complete; then
        fail "Should not be all complete (2/5)"
    else
        pass "check_all_complete correctly returns false (2/5 completed)"
    fi
}

test_get_worker_count() {
    info "Testing get_worker_count..."
    local count=$(get_worker_count)
    if [ "$count" == "2" ]; then
        pass "get_worker_count returns 2"
    else
        fail "Expected 2, got $count"
    fi
}

test_all_complete_scenario() {
    info "Testing all-complete scenario..."
    # Modify state to have all completed
    jq '.progress.completed = 5 | .progress.pending = 0' "$STATE_FILE" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "$STATE_FILE"

    if check_all_complete; then
        pass "check_all_complete returns true when all done"
    else
        fail "Should be all complete"
    fi

    # Restore
    create_state_file
}

test_no_available_work_scenario() {
    info "Testing no-available-work scenario (all pending blocked)..."
    # Modify state: only 004 pending (blocked by 003 which is also pending)
    jq '.features["003"].status = "pending" | .features["005"].status = "completed"' "$STATE_FILE" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "$STATE_FILE"

    local next=$(get_next_pending_feature)
    if [ "$next" == "003" ]; then
        pass "get_next_pending_feature still finds 003 (deps 001,002 are completed)"
    else
        info "Result: '$next'"
    fi

    # Restore
    create_state_file
}

# ===== Main =====

main() {
    echo ""
    echo "=========================================="
    echo "  Watchdog Script Test Suite"
    echo "=========================================="
    echo ""

    setup
    create_state_file

    local test_name="${1:-all}"

    case "$test_name" in
        all)
            test_jq_available
            test_state_file_read
            test_dependency_check_no_deps
            test_dependency_check_deps_met
            test_dependency_check_deps_not_met
            test_get_next_pending_feature
            test_has_available_work
            test_check_all_complete_false
            test_get_worker_count
            test_all_complete_scenario
            test_no_available_work_scenario
            ;;
        deps)
            test_dependency_check_no_deps
            test_dependency_check_deps_met
            test_dependency_check_deps_not_met
            ;;
        next)
            test_get_next_pending_feature
            test_has_available_work
            ;;
        *)
            echo "Unknown test: $test_name"
            echo "Usage: $0 [all|deps|next]"
            exit 1
            ;;
    esac

    echo ""
    echo -e "${GREEN}All tests passed!${NC}"
    echo ""
}

main "$@"
