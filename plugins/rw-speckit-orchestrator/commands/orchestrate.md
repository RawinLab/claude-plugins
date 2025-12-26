---
name: orchestrate
description: Start automated Spec-Kit workflow orchestration for all features
arguments:
  - name: guide
    description: Path to speckit-guide.md file
    required: false
    default: "./speckit-guide.md"
  - name: resume
    description: Resume from existing state file (true/false)
    required: false
    default: "false"
  - name: parallel
    description: Number of parallel workers for implement phase (default 3)
    required: false
    default: "3"
---

# Speckit Orchestrator

You are the main orchestrator for automated Spec-Kit workflow.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (You)                        │
│  1. Parse guide → 2. Create state → 3. Run phases            │
└──────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────────┐
    │                         │                             │
    ▼                         ▼                             ▼
┌─────────┐             ┌─────────┐                   ┌─────────┐
│Phase 1-4│             │Phase 1-4│                   │Phase 1-4│
│SEQUENTIAL│            │SEQUENTIAL│                  │SEQUENTIAL│
│Feature A│             │Feature B│                   │Feature C│
└────┬────┘             └────┬────┘                   └────┬────┘
     │                       │                             │
     └───────────────────────┼─────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Phase 5: IMPL  │
                    │  (PARALLEL)     │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │Worker A │         │Worker B │         │Worker C │
    │Task tool│         │Task tool│         │Task tool│
    └─────────┘         └─────────┘         └─────────┘
```

## Workflow Phases

| Phase | Steps | Mode |
|-------|-------|------|
| 1 | specify | Sequential (all features) |
| 2 | clarify | Sequential (all features) |
| 3 | plan | Sequential (all features) |
| 4 | analyze | Sequential (all features) |
| 5 | implement | **PARALLEL** (Task tool) |

---

## Step 1: Initialize State

Check if resuming or creating new state:

```bash
mkdir -p .claude
```

If `${resume}` is "false" OR `.claude/orchestrator.state.json` doesn't exist:

1. Read `${guide}` to extract features
2. Parse feature IDs, names, priorities, dependencies
3. Create state file with all features as "pending"

### State File Structure

Create `.claude/orchestrator.state.json`:

```json
{
  "version": "2.0.0",
  "session_id": "speckit-{timestamp}",
  "started_at": "{ISO timestamp}",
  "status": "running",
  "config": {
    "guide_path": "${guide}",
    "parallel_workers": ${parallel}
  },
  "current_phase": "specify",
  "progress": {
    "total_features": 0,
    "completed": 0,
    "in_progress": 0,
    "pending": 0
  },
  "features": {
    "001": {
      "name": "feature-name",
      "status": "pending",
      "phase_status": {
        "specify": "pending",
        "clarify": "pending",
        "plan": "pending",
        "analyze": "pending",
        "implement": "pending"
      }
    }
  }
}
```

---

## Step 2: Run Sequential Phases (1-4)

For each phase in order: `specify`, `clarify`, `plan`, `analyze`

### 2.1 Update Current Phase

Update state: `current_phase: "{phase}"`

### 2.2 Process Each Feature Sequentially

For each feature (in priority/dependency order):

1. **Checkout feature branch**
   ```bash
   git checkout main && git pull
   git checkout -b {feature_id}-{phase}-{feature_slug} 2>/dev/null || git checkout {feature_id}-{phase}-{feature_slug}
   ```

2. **Run the speckit command**
   ```
   /speckit.{phase}
   ```
   - For `clarify` and `analyze`: Auto-select recommended options
   - Follow the prompts, complete the phase

3. **Commit progress**
   ```bash
   git add -A
   git commit -m "speckit({feature_id}): complete {phase} phase"
   ```

4. **Update state**
   ```json
   {
     "features": {
       "{feature_id}": {
         "phase_status": {
           "{phase}": "completed"
         }
       }
     }
   }
   ```

5. **Move to next feature**

### 2.3 Phase Complete

After all features complete current phase:
- Update `current_phase` to next phase
- Continue to next phase

---

## Step 3: Run Parallel Implementation (Phase 5)

When all features have completed phases 1-4:

### 3.1 Merge All Prep Branches

```bash
git checkout main
# Merge all feature prep branches
for feature in {feature_ids}; do
  git merge --no-ff {feature}-specify-{slug} -m "Merge {feature} prep"
done
git push origin main
```

### 3.2 Spawn Parallel Workers

Use Task tool to spawn parallel workers for implementation:

```
For each feature (up to ${parallel} at a time):
  Task(
    subagent_type: "speckit-worker",
    prompt: "Implement feature {feature_id}: {feature_name}.
             Read .claude/orchestrator.state.json for context.
             Run /speckit.implement, then create PR and merge.",
    run_in_background: true
  )
```

**IMPORTANT**:
- Spawn up to `${parallel}` workers at once
- When one finishes, spawn next pending feature
- Continue until all features implemented

### 3.3 Monitor Workers

Use TaskOutput to check worker progress:

```
TaskOutput(task_id: "{worker_id}", block: false)
```

When a worker completes:
1. Update state: `features.{id}.phase_status.implement = "completed"`
2. Update progress counts
3. Spawn next pending feature (if any)

---

## Step 4: Completion

When all features are implemented:

1. Update state:
   ```json
   {
     "status": "completed",
     "completed_at": "{ISO timestamp}",
     "progress": {
       "completed": {total},
       "pending": 0
     }
   }
   ```

2. Output summary:
   ```
   ✅ Speckit Orchestration Complete!
   ==================================
   Total Features: {N}
   Completed: {N}
   Duration: {time}

   All features have been implemented and merged.
   ```

---

## Error Handling

If a phase fails for a feature:
1. Log error in state
2. Mark feature as "failed"
3. Continue with other features
4. Report failures at end

---

## Commands for Monitoring

- `/orch-status` - Check current progress
- `/orch-stop` - Stop orchestration

---

## CRITICAL RULES

1. **Phases 1-4 are SEQUENTIAL** - One feature at a time, complete phase before next
2. **Phase 5 is PARALLEL** - Use Task tool to spawn workers
3. **AUTO-ANSWER** - Select recommended options, don't wait for user
4. **STATE IS TRUTH** - Always update state file after each action
5. **NO MOCKS** - All implementation must be real, working code
