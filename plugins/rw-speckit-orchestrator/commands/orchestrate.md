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

You are the main orchestrator for automated Spec-Kit workflow using Task Tool.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  MAIN ORCHESTRATOR (You)                    │
│  - Parse guide, manage state                                │
│  - Spawn Task workers for each feature                      │
│  - Monitor progress, handle retries                         │
│  - MANAGE CONTEXT: /context + /compact บ่อยๆ                │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Task Tool (sequential)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker Agent (speckit-worker)                              │
│  Feature 009: specify → clarify → plan → analyze → implement│
│  - Auto-answer ALL prompts                                  │
│  - MANAGE CONTEXT: /context + /compact                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Task Tool (can be parallel)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Subagents (during implement phase)                         │
│  - frontend-developer, backend-architect, etc.              │
│  - MANAGE CONTEXT: /context + /compact                      │
└─────────────────────────────────────────────────────────────┘
```

---

## CRITICAL: Context Management

**คุณต้อง manage context ตลอดเวลา:**

1. หลังจบแต่ละ feature → รัน `/compact`
2. ก่อนเริ่ม feature ใหม่ → เช็ค `/context`
3. ถ้า context > 60% → รัน `/compact` ทันที

```
/context   ← ตรวจสอบ context usage
/compact   ← สรุปให้ context เล็กลง
```

---

## Step 1: Initialize State

```bash
mkdir -p .claude
```

### 1.1 Parse Guide

Read `${guide}` and extract all features:
- Feature ID (e.g., "009")
- Feature name
- Dependencies (if any)

### 1.2 Handle Pre-completed Features

If `${set-completed}` is provided:
- Mark each listed feature as "completed"

If `${start-from}` is provided:
- Mark all features BEFORE this ID as "completed"

### 1.3 Create/Update State File

`.claude/orchestrator.state.json`:

```json
{
  "version": "3.0.0",
  "status": "running",
  "current_feature": null,
  "progress": {
    "total": 15,
    "completed": 8,
    "failed": 0,
    "pending": 7
  },
  "features": {
    "009": {
      "name": "ai-image-generation",
      "status": "pending",
      "retry_count": 0,
      "error": null
    }
  }
}
```

---

## Step 2: Main Loop - Process Features

⚠️ **CRITICAL: SEQUENTIAL EXECUTION ONLY** ⚠️

**ห้าม spawn หลาย Task พร้อมกัน! ต้องทำทีละ feature เท่านั้น!**

```
FOR EACH feature IN pending_features (ONE BY ONE):
    1. Check context → /compact if needed
    2. Get SINGLE next pending feature
    3. Spawn ONE Task worker for this feature
    4. WAIT for completion (TaskOutput with block=true) ← MUST WAIT!
    5. Handle result (success/failure/retry)
    6. Update state file
    7. /compact after each feature
    8. THEN move to next feature ← ไม่ใช่ parallel!
END FOR
```

**DO NOT:**
- ❌ Spawn multiple Task tools in one message
- ❌ Run features 001, 002, 003 at the same time
- ❌ Use run_in_background: true

**DO:**
- ✅ Process ONE feature completely before starting next
- ✅ Wait for TaskOutput before spawning next Task
- ✅ Sequential: 001 → (wait) → 002 → (wait) → 003

### 2.1 Get Next Feature

```bash
# Find first pending feature
next_feature=$(jq -r '[.features | to_entries[] | select(.value.status == "pending")] | first | .key' .claude/orchestrator.state.json)
```

### 2.2 Spawn Worker with Task Tool

**⚠️ IMPORTANT: Spawn ONLY ONE Task at a time!**

After this Task completes, you may spawn the next one. NOT before!

```
// Spawn SINGLE worker - DO NOT spawn multiple!
Task(
  subagent_type: "speckit-worker",
  description: "Process feature {feature_id}",
  run_in_background: false,  // MUST be false!
  prompt: "
    You are a Speckit Worker. Process feature {feature_id}: {feature_name}

    Project path: {current_directory}
    State file: .claude/orchestrator.state.json

    Run ALL 6 phases:

    SEQUENTIAL (ทีละ phase):
    1. /speckit.specify
    2. /speckit.clarify - AUTO-ANSWER ทุกคำถาม เลือก recommended
    3. /speckit.plan
    4. /speckit.tasks
    5. /speckit.analyze - AUTO-ANSWER ทุกคำถาม ตอบ YES ทุกข้อ

    PARALLEL OK (phase นี้ spawn หลาย subagent ได้):
    6. /speckit.implement - ใช้ specialized agents, skills ได้เต็มที่!

    CRITICAL:
    - Phases 1-5: SEQUENTIAL - รอให้เสร็จก่อนไป phase ถัดไป
    - Phase 6 (implement): PARALLEL OK - spawn หลาย agent พร้อมกันได้
    - AUTO-ANSWER ทุก prompt ไม่ต้องรอ user
    - ตอบ 'yes' ทุก confirmation
    - เลือก 'recommended' option เสมอ
    - ทำงานจริง ไม่ mock data
    - Manage context: /context ตรวจสอบ, /compact บ่อยๆ

    After all phases complete:
    - Verify implementation (build, types)
    - Write and run tests
    - Create PR and merge
    - Return success/failure status
  "
)
```

### 2.3 Wait for Worker Completion

```
result = TaskOutput(task_id: "{worker_task_id}", block: true)
```

### 2.4 Handle Result

**If SUCCESS:**
```json
{
  "features": {
    "{feature_id}": {
      "status": "completed",
      "completed_at": "{timestamp}"
    }
  },
  "progress": { "completed": "+1", "pending": "-1" }
}
```

**If FAILED:**
```
retry_count = state.features[feature_id].retry_count

if retry_count < 3:
    # Retry with resume
    Task(
      resume: "{worker_task_id}",
      prompt: "Previous attempt failed. Fix the error and continue."
    )
    retry_count += 1
else:
    # Mark as failed, move to next
    state.features[feature_id].status = "failed"
    state.progress.failed += 1
```

### 2.5 Compact After Each Feature

```
/compact
```

**ทำทุกครั้งหลังจบ feature เพื่อรักษา context**

---

## Step 3: Completion

When all features processed:

```
✅ Speckit Orchestration Complete!
==================================
Total Features: {total}
Completed: {completed}
Failed: {failed}

{list of completed features}

{list of failed features with errors}
```

---

## Error Handling

| Error Type | Action |
|------------|--------|
| Worker timeout | Retry with resume (max 3) |
| Phase failed | Retry from failed phase |
| Max retries exceeded | Mark failed, continue to next |
| Context overflow | /compact and retry |

---

## CRITICAL RULES

1. **🚨 SEQUENTIAL ONLY** - ทำทีละ feature เท่านั้น! ห้าม parallel!
2. **USE TASK TOOL** - Spawn worker for each feature via Task tool
3. **ONE FEATURE AT A TIME** - Wait for TaskOutput BEFORE spawning next Task
4. **NEVER BATCH** - ห้าม spawn Task หลายตัวในข้อความเดียว
5. **AUTO-ANSWER** - Workers must auto-answer all prompts
6. **RETRY ON FAILURE** - Up to 3 retries with resume
7. **MANAGE CONTEXT** - /context + /compact บ่อยๆ ทั้ง orchestrator และ workers
8. **STATE IS TRUTH** - Update state after every action
9. **NO MOCKS** - All implementation must be real, working code

## ⚠️ ANTI-PATTERN: ห้ามทำแบบนี้!

```
❌ WRONG - Multiple Tasks in one message:
Task(feature 001) + Task(feature 002) + Task(feature 003)

✅ CORRECT - One Task, wait, then next:
Task(feature 001) → TaskOutput(wait) → Task(feature 002) → TaskOutput(wait) → ...
```
