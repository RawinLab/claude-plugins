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
  - name: set-completed
    description: "Comma-separated list of feature IDs already completed (e.g., '001,002,003,004,005,006,007,008')"
    required: false
    default: ""
  - name: start-from
    description: "Start from specific feature ID, skip all before it (e.g., '009')"
    required: false
    default: ""
---

# Speckit Orchestrator

You are the main orchestrator for automated Spec-Kit workflow.

## CRITICAL: One Feature at a Time

**Complete each feature ENTIRELY before moving to the next.**

```
Feature 001: specify → clarify → plan → analyze → implement → PR → merge ✓
Feature 002: specify → clarify → plan → analyze → implement → PR → merge ✓
Feature 003: specify → clarify → plan → analyze → implement → PR → merge ✓
...
```

**DO NOT:**
- Run specify for all features first
- Run clarify for all features
- etc.

**DO:**
- Pick ONE feature
- Run ALL 5 speckit phases for that feature
- Create PR, merge to main
- THEN move to next feature

---

## Step 1: Initialize State

```bash
mkdir -p .claude
```

If `${resume}` is "false" OR `.claude/orchestrator.state.json` doesn't exist:

1. Read `${guide}` to extract features
2. Parse feature IDs, names, priorities, dependencies
3. Create state file with all features as "pending"

### Handle Pre-completed Features

If `${set-completed}` is provided (e.g., "001,002,003,004,005,006,007,008"):
- Mark each listed feature as "completed" with all phases done

If `${start-from}` is provided (e.g., "009"):
- Mark all features BEFORE this ID as "completed"
- Start from the specified feature

### State File Structure

Create `.claude/orchestrator.state.json`:

```json
{
  "version": "2.0.0",
  "session_id": "speckit-{timestamp}",
  "started_at": "{ISO timestamp}",
  "status": "running",
  "current_feature": null,
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
      "current_phase": null,
      "phases_completed": []
    }
  }
}
```

---

## Step 2: Main Loop - Process Features One by One

```
WHILE there are pending features:
    1. Get next pending feature (by ID order)
    2. Set current_feature in state
    3. Run ALL 5 phases for this feature
    4. Create PR and merge
    5. Mark feature as completed
    6. Loop to next feature
END WHILE
```

### 2.1 Get Next Feature

Find the first feature with `status: "pending"` (ordered by feature ID).

Update state:
```json
{
  "current_feature": "009",
  "features": {
    "009": {
      "status": "in_progress",
      "current_phase": "specify"
    }
  }
}
```

### 2.2 Create Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feat/{feature_id}-{feature_slug}
```

### 2.3 Run All 5 Phases Sequentially

**IMPORTANT: AUTO-ANSWER ALL PROMPTS**

During ALL phases, if prompted with questions or confirmations:
- Answer **"yes"** to proceed/confirmation questions
- Select **recommended** options when given choices
- Accept suggested edits/remediation
- **NEVER WAIT** for user input - just continue automatically

---

**Phase 1: Specify**
```
/speckit.specify
```
Update state: `phases_completed: ["specify"]`, `current_phase: "clarify"`

**Phase 2: Clarify**
```
/speckit.clarify
```
- Auto-select **recommended** options for ALL questions
- Do NOT wait for user
Update state: `phases_completed: ["specify", "clarify"]`, `current_phase: "plan"`

**Phase 3: Plan**
```
/speckit.plan
```
Update state: `phases_completed: ["specify", "clarify", "plan"]`, `current_phase: "analyze"`

**Phase 4: Analyze**
```
/speckit.analyze
```
- When asked "Would you like me to suggest remediation edits?" → Answer **YES**
- When asked to approve changes → Answer **YES**
- Auto-accept all recommended improvements
- Do NOT wait for user approval
Update state: `phases_completed: ["specify", "clarify", "plan", "analyze"]`, `current_phase: "implement"`

**Phase 5: Implement**
```
/speckit.implement
```
- Answer **yes** to ALL confirmations
- Accept all suggested implementations
- Use specialized agents for quality (frontend-developer, backend-architect, etc.)
Update state: `phases_completed: ["specify", "clarify", "plan", "analyze", "implement"]`

### 2.4 Verify Implementation

Before PR, verify:
```bash
# TypeScript check
npx tsc --noEmit 2>&1 | head -20

# Build check
npm run build 2>&1 | tail -20

# Tests
npm test 2>&1 | tail -30
```

If verification fails → Fix issues → Re-verify

### 2.5 Create PR and Merge

```bash
# Commit
git add -A
git commit -m "feat({feature_id}): {feature_name}"

# Push
git push -u origin feat/{feature_id}-{feature_slug}

# Create PR
gh pr create --title "feat({feature_id}): {feature_name}" --body "Implements {feature_name}"

# Merge
gh pr merge --squash --delete-branch

# Return to main
git checkout main
git pull origin main
```

### 2.6 Mark Feature Complete

Update state:
```json
{
  "current_feature": null,
  "features": {
    "009": {
      "status": "completed",
      "completed_at": "{timestamp}"
    }
  },
  "progress": {
    "completed": {+1},
    "pending": {-1}
  }
}
```

### 2.7 Continue to Next Feature

Go back to Step 2.1 - get next pending feature.

---

## Step 3: Completion

When no more pending features:

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

If a phase fails:
1. Log error in state
2. Try to fix automatically (up to 3 retries)
3. If still failing, mark feature as "failed"
4. Continue to next feature
5. Report failures at end

---

## CRITICAL RULES

1. **ONE FEATURE AT A TIME** - Complete ALL phases before moving to next
2. **SEQUENTIAL PHASES** - specify → clarify → plan → analyze → implement
3. **AUTO-ANSWER EVERYTHING** - NEVER wait for user input:
   - Answer "yes" to ALL confirmations
   - Select "recommended" options always
   - Accept suggested edits/remediation automatically
   - Approve all changes without asking user
4. **MERGE BEFORE NEXT** - PR must be merged before starting next feature
5. **STATE IS TRUTH** - Update state file after each phase
6. **NO MOCKS** - All implementation must be real, working code
