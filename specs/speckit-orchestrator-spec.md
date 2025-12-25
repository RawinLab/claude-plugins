# Speckit Orchestrator Plugin - Detailed Specification

## Overview

**Plugin Name:** speckit-orchestrator
**Version:** 1.0.0
**Author:** RawinLab
**License:** MIT
**Status:** Design Phase

---

## CRITICAL: Primary Mission

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   🎯 ORCHESTRATOR'S PRIMARY MISSION:                                    │
│                                                                          │
│   ENSURE ALL FEATURES ARE FULLY IMPLEMENTED - NO EXCEPTIONS             │
│                                                                          │
│   The Orchestrator MUST:                                                │
│   1. Never "fall asleep" or lose track of progress                      │
│   2. Verify each implementation is COMPLETE (not partial)               │
│   3. Retry incomplete implementations until done                        │
│   4. Continue until 100% of features are implemented                    │
│   5. NEVER report success if any feature is incomplete                  │
│                                                                          │
│   This is NON-NEGOTIABLE. Partial success = Failure.                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Problem Statement

### 1.1 Current Pain Points

เมื่อใช้ Spec-Kit workflow กับโปรเจคที่มีหลาย features (เช่น 20 features) ต้อง:

1. **Manual Command Execution**: สั่ง 6 commands ต่อ feature
   ```
   /speckit.specify → /speckit.clarify → /speckit.plan →
   /speckit.tasks → /speckit.analyze → /speckit.implement
   ```

2. **Repetitive Q&A**: ต้องตอบคำถาม clarify ซ้ำๆ (มักตอบ "yes" ตาม recommended)

3. **Context Management**: Context เต็มเร็วเมื่อทำหลาย features ต่อกัน

4. **No Visibility**: ไม่มี dashboard แสดงว่ากำลังทำอะไรอยู่

5. **No Parallelism**: ทำได้ทีละ feature เท่านั้น

### 1.2 Impact

- **Time Waste**: 20 features × 6 commands × ~2 min = ~4 hours of manual work
- **Context Overflow**: ต้อง restart session บ่อย
- **Error Prone**: อาจลืม step หรือทำผิดลำดับ

---

## 2. Solution Overview

### 2.1 What is Speckit Orchestrator?

Plugin สำหรับ Claude Code ที่ทำหน้าที่:

1. **อ่าน speckit-guide.md** แล้ว parse รายการ features
2. **Spawn worker agents** เพื่อทำงานแบบ parallel
3. **แสดง Dashboard** real-time ผ่าน tmux
4. **Auto-answer** คำถาม clarify
5. **Manage context** อัตโนมัติ (compact เมื่อจำเป็น)

### 2.2 Key Benefits

| Benefit | Before | After |
|---------|--------|-------|
| Manual Commands | 120+ commands | 1 command |
| Time to Complete | 4+ hours | Automated |
| Visibility | None | Real-time Dashboard |
| Parallelism | Sequential only | Up to N workers |
| Context Management | Manual | Automatic |

---

## 3. User Stories

### US-1: Start Orchestration
```
As a developer,
I want to run a single command to process all features in speckit-guide,
So that I don't have to manually execute each step.
```

### US-2: Monitor Progress
```
As a developer,
I want to see a real-time dashboard showing what each worker is doing,
So that I can monitor progress and identify issues.
```

### US-3: Configure Parallelism
```
As a developer,
I want to specify how many parallel workers to use,
So that I can balance speed vs resource usage.
```

### US-4: Resume from Failure
```
As a developer,
I want to resume orchestration from where it stopped,
So that I don't have to restart from the beginning after an error.
```

### US-5: Auto-Answer Questions
```
As a developer,
I want the orchestrator to automatically answer clarify questions,
So that the workflow doesn't block waiting for my input.
```

---

## 4. Architecture

### 4.0 CRITICAL: Hybrid Architecture Decision

**คำถาม:** Orchestrator ควรเป็น Shell Script หรือ Claude Agent?

**คำตอบ:** **HYBRID ARCHITECTURE** - Shell Script เป็น "Watchdog" + Agent เป็น "Brain"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WHY HYBRID ARCHITECTURE?                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Problem: Claude Agent อาจ "หลับ" หรือ context หมด                       │
│                                                                          │
│  Solution: Shell Script ที่ไม่มีวันหลับ ทำหน้าที่:                          │
│    1. เป็น "Watchdog" คอยตรวจสอบว่างานเสร็จครบหรือไม่                      │
│    2. Restart workers ที่หยุดทำงาน                                       │
│    3. อ่าน state file และสั่งงาน agent ต่อ                                │
│    4. ไม่มี context limit - ทำงานได้ไม่จำกัด                              │
│                                                                          │
│  ┌──────────────────┐         ┌──────────────────┐                      │
│  │  orchestrator.sh │◀───────▶│   State File     │                      │
│  │  (Never Sleeps)  │         │  (Single Source  │                      │
│  │                  │         │   of Truth)      │                      │
│  └────────┬─────────┘         └──────────────────┘                      │
│           │                                                              │
│           │ spawns & monitors                                            │
│           ▼                                                              │
│  ┌──────────────────────────────────────────────────────┐               │
│  │  Claude Code Workers (feature-worker agents)         │               │
│  │  - Do the actual AI work                             │               │
│  │  - Report progress to state file                     │               │
│  │  - Can be restarted if stuck                         │               │
│  └──────────────────────────────────────────────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Benefits of Hybrid:**
| Aspect | Pure Agent | Hybrid (Shell + Agent) |
|--------|------------|------------------------|
| Reliability | May sleep/timeout | Shell never sleeps |
| Context | Limited, may overflow | Shell has no context limit |
| Resume | Complex | Simple - read state file |
| Monitoring | Limited | Shell can monitor all workers |
| Restartability | Lost progress | Shell restarts from state |

---

### 4.1 High-Level Architecture (Hybrid)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR.SH (Watchdog - Never Sleeps)             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  while not all_features_complete:                                 │  │
│  │      read state_file                                              │  │
│  │      check_worker_health()                                        │  │
│  │      restart_stuck_workers()                                      │  │
│  │      assign_pending_features()                                    │  │
│  │      verify_implementations()                                     │  │
│  │      update_dashboard()                                           │  │
│  │      sleep 5                                                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           TMUX SESSION                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  PANE 0: Dashboard (orchestrator-dashboard)                     │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │ Speckit Orchestrator v1.0.0                               │  │    │
│  │  │ Project: Vidiwo | Features: 20 | Workers: 4               │  │    │
│  │  │ ─────────────────────────────────────────────────────────│  │    │
│  │  │ Progress: ████████░░░░░░░░░░░░ 8/20 (40%)                │  │    │
│  │  │ ─────────────────────────────────────────────────────────│  │    │
│  │  │ Worker 1: Feature 009 [implement] ████████░░ 80%         │  │    │
│  │  │ Worker 2: Feature 010 [plan]      ███░░░░░░░ 30%         │  │    │
│  │  │ Worker 3: Feature 011 [specify]   █░░░░░░░░░ 10%         │  │    │
│  │  │ Worker 4: Feature 012 [clarify]   ██░░░░░░░░ 20%         │  │    │
│  │  │ ─────────────────────────────────────────────────────────│  │    │
│  │  │ Completed: 001,002,003,004,005,006,007,008               │  │    │
│  │  │ Failed: none                                              │  │    │
│  │  │ ─────────────────────────────────────────────────────────│  │    │
│  │  │ Logs: Worker 1 completed step 'tasks' for Feature 009    │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ PANE 1       │ │ PANE 2       │ │ PANE 3       │ │ PANE 4       │    │
│  │ Worker 1     │ │ Worker 2     │ │ Worker 3     │ │ Worker 4     │    │
│  │ claude code  │ │ claude code  │ │ claude code  │ │ claude code  │    │
│  │ session      │ │ session      │ │ session      │ │ session      │    │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        speckit-orchestrator plugin                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────────────┐    ┌──────────────────┐     │
│  │  Commands   │    │      Agents         │    │     Skills       │     │
│  ├─────────────┤    ├─────────────────────┤    ├──────────────────┤     │
│  │ /orchestrate│───▶│ orchestrator-main   │───▶│ guide-parser     │     │
│  │ /orch-status│    │ orchestrator-dash   │    │ workflow-exec    │     │
│  │ /orch-stop  │    │ feature-worker      │    │ context-manager  │     │
│  └─────────────┘    └─────────────────────┘    └──────────────────┘     │
│                                                                          │
│  ┌─────────────┐    ┌─────────────────────┐    ┌──────────────────┐     │
│  │   Hooks     │    │    State Files      │    │   Utilities      │     │
│  ├─────────────┤    ├─────────────────────┤    ├──────────────────┤     │
│  │ auto-clarify│    │ orchestrator.state  │    │ tmux-manager.sh  │     │
│  │ report-back │    │ worker-N.state      │    │ dashboard.sh     │     │
│  └─────────────┘    └─────────────────────┘    └──────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                    │
└──────────────────────────────────────────────────────────────────────────┘

1. INITIALIZATION
   ┌────────────┐      ┌─────────────────┐      ┌────────────────┐
   │ User runs  │─────▶│ Parse           │─────▶│ Create State   │
   │ /orchestrate│      │ speckit-guide.md│      │ File           │
   └────────────┘      └─────────────────┘      └────────────────┘
                                                        │
2. TMUX SETUP                                           ▼
   ┌────────────┐      ┌─────────────────┐      ┌────────────────┐
   │ Create     │─────▶│ Create Worker   │─────▶│ Start          │
   │ tmux session│      │ Panes (1-N)     │      │ Dashboard      │
   └────────────┘      └─────────────────┘      └────────────────┘
                                                        │
3. WORKER EXECUTION                                     ▼
   ┌────────────────────────────────────────────────────────────────┐
   │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
   │  │ Worker 1 │    │ Worker 2 │    │ Worker 3 │    │ Worker N │ │
   │  │          │    │          │    │          │    │          │ │
   │  │ Feature  │    │ Feature  │    │ Feature  │    │ Feature  │ │
   │  │ Queue    │    │ Queue    │    │ Queue    │    │ Queue    │ │
   │  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘ │
   │       │               │               │               │       │
   │       ▼               ▼               ▼               ▼       │
   │  ┌──────────────────────────────────────────────────────────┐ │
   │  │              SHARED STATE FILE (JSON)                    │ │
   │  │  - Feature assignments                                   │ │
   │  │  - Progress updates                                      │ │
   │  │  - Error logs                                            │ │
   │  └──────────────────────────────────────────────────────────┘ │
   └────────────────────────────────────────────────────────────────┘
                                │
4. REPORTING                    ▼
   ┌────────────┐      ┌─────────────────┐      ┌────────────────┐
   │ Worker     │─────▶│ Compact/        │─────▶│ Update State   │
   │ Completes  │      │ Summarize       │      │ File           │
   └────────────┘      └─────────────────┘      └────────────────┘
                                                        │
5. DASHBOARD UPDATE                                     ▼
   ┌────────────┐      ┌─────────────────┐      ┌────────────────┐
   │ Watch      │─────▶│ Parse State     │─────▶│ Render         │
   │ State File │      │ Changes         │      │ Dashboard      │
   └────────────┘      └─────────────────┘      └────────────────┘
```

---

## 5. Detailed Component Specifications

### 5.1 Commands

#### 5.1.1 `/orchestrate`

**Purpose:** เริ่ม orchestration workflow

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `guide` | string | No | `./speckit-guide.md` | Path to speckit-guide file |
| `workers` | number | No | `4` | Number of parallel workers (1-8) |
| `start-from` | string | No | `null` | Feature ID to start from |
| `features` | string | No | `all` | Comma-separated feature IDs or "all" |
| `dry-run` | boolean | No | `false` | Parse and show plan without executing |
| `auto-answer` | string | No | `recommended` | How to answer questions: "recommended", "yes", "no", "ask" |
| `import-state` | string | No | `null` | Import existing progress from JSON file |
| `set-completed` | string | No | `null` | Mark specific features as already completed (e.g., "001,002,003") |

**Example Usage:**
```bash
# Basic usage - process all features with 4 workers
/orchestrate

# Custom guide path with 6 workers
/orchestrate --guide ./my-guide.md --workers 6

# Start from specific feature
/orchestrate --start-from 005

# Process specific features only
/orchestrate --features 001,005,010

# Dry run to see plan
/orchestrate --dry-run

# IMPORTANT: Import existing progress from manual work
# Use this when you've already done some features manually
/orchestrate --set-completed "001,002,003,004,005"

# Or import from existing state file (from another project)
/orchestrate --import-state ./old-project/.claude/orchestrator.state.json
```

**Import Existing Progress (for projects already in progress):**

หากทำ manual มาแล้วบางส่วน สามารถ import progress ได้:

```bash
# Option 1: Mark completed features directly
/orchestrate --set-completed "001,002,003"

# Option 2: Create state file manually and import
# Create .claude/orchestrator.state.json with:
{
  "features": {
    "001": { "status": "completed", "steps_completed": ["specify","clarify","plan","tasks","analyze","implement"] },
    "002": { "status": "completed", "steps_completed": ["specify","clarify","plan","tasks","analyze","implement"] },
    "003": { "status": "in_progress", "current_step": "implement", "steps_completed": ["specify","clarify","plan","tasks","analyze"] }
  }
}
# Then run:
/orchestrate --import-state .claude/orchestrator.state.json

# Option 3: Start fresh from specific feature
/orchestrate --start-from 004 --set-completed "001,002,003"
```

**Output:**
```
Starting Speckit Orchestrator...
- Guide: ./speckit-guide.md
- Features: 20 detected
- Workers: 4
- Mode: parallel

Creating tmux session 'speckit-orch'...
Dashboard: tmux attach -t speckit-orch

Press Ctrl+C to stop orchestration.
```

---

#### 5.1.2 `/orch-status`

**Purpose:** แสดงสถานะปัจจุบัน

**Arguments:** None

**Output:**
```
Speckit Orchestrator Status
───────────────────────────
Session: speckit-orch (running)
Progress: 12/20 features (60%)

Workers:
  Worker 1: Feature 013 [implement] - 45% complete
  Worker 2: Feature 014 [plan] - 70% complete
  Worker 3: Feature 015 [specify] - 20% complete
  Worker 4: idle

Completed: 001,002,003,004,005,006,007,008,009,010,011,012
In Progress: 013,014,015
Pending: 016,017,018,019,020
Failed: none

Estimated Time Remaining: ~35 minutes
```

---

#### 5.1.3 `/orch-stop`

**Purpose:** หยุด orchestration

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `save-state` | boolean | No | `true` | Save state for resume |
| `kill-workers` | boolean | No | `true` | Kill all worker sessions |

**Example Usage:**
```bash
# Stop and save state (can resume later)
/orch-stop

# Stop without saving
/orch-stop --save-state false
```

---

#### 5.1.4 `/orch-resume`

**Purpose:** Resume จาก state ที่ save ไว้

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `state-file` | string | No | `.claude/orchestrator.state.json` | Path to state file |

---

### 5.2 Agents

#### 5.2.1 `orchestrator-main`

**Purpose:** Main orchestrator logic

**Trigger:** เมื่อ `/orchestrate` command ถูกเรียก

**Responsibilities:**
1. Parse speckit-guide.md เพื่อ extract features
2. สร้าง execution plan
3. จัดการ tmux session
4. Spawn workers
5. Monitor progress
6. Handle failures and retries
7. Manage overall context

**System Prompt:**
```markdown
You are the Speckit Orchestrator - a workflow automation agent.

Your responsibilities:
1. Parse the speckit-guide.md to extract all features
2. Create and manage tmux session with dashboard + worker panes
3. Assign features to workers in optimal order (respecting dependencies)
4. Monitor worker progress via state file
5. Handle failures with retry logic
6. Maintain your own context by using /compact when needed

Rules:
1. NEVER mock data - all work must be real
2. Respect feature dependencies (see dependency graph in guide)
3. Workers report back with COMPACT summaries only
4. Use state file as single source of truth
5. Kill stuck workers after 30 minutes timeout

State File Location: .claude/orchestrator.state.json
```

**Tools Available:**
- Bash (for tmux management)
- Read (for speckit-guide.md)
- Write (for state file)
- Task (for spawning workers)

---

#### 5.2.2 `orchestrator-dashboard`

**Purpose:** Real-time dashboard rendering

**Trigger:** Background process watching state file

**Responsibilities:**
1. Watch state file for changes
2. Render dashboard UI
3. Show progress bars
4. Display logs

**Dashboard Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  SPECKIT ORCHESTRATOR v1.0.0                    [RUNNING]   │
│  Project: {project_name}                                    │
│  Guide: {guide_path}                                        │
├─────────────────────────────────────────────────────────────┤
│  OVERALL PROGRESS                                           │
│  ████████████░░░░░░░░░░░░░░░░░░  12/20 features (60%)      │
│  Elapsed: 00:45:23 | ETA: 00:30:00                          │
├─────────────────────────────────────────────────────────────┤
│  WORKERS                                                    │
│  ┌─────────┬──────────┬──────────┬─────────┬────────────┐  │
│  │ Worker  │ Feature  │ Step     │Progress │ Status     │  │
│  ├─────────┼──────────┼──────────┼─────────┼────────────┤  │
│  │ W1      │ F013     │implement │ ████░░  │ coding...  │  │
│  │ W2      │ F014     │ plan     │ ███████ │ planning   │  │
│  │ W3      │ F015     │ specify  │ ██░░░░  │ writing    │  │
│  │ W4      │ -        │ -        │ -       │ idle       │  │
│  └─────────┴──────────┴──────────┴─────────┴────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  FEATURE STATUS                                             │
│  ✓ Completed: 001 002 003 004 005 006 007 008 009 010 011  │
│  ◉ In Progress: 013 014 015                                 │
│  ○ Pending: 016 017 018 019 020                             │
│  ✗ Failed: -                                                │
├─────────────────────────────────────────────────────────────┤
│  RECENT LOGS                                                │
│  [12:45:23] Worker 1: Started implement for Feature 013     │
│  [12:44:18] Worker 2: Completed tasks for Feature 012       │
│  [12:43:55] Worker 3: Started specify for Feature 015       │
│  [12:42:30] Feature 012 marked as completed                 │
└─────────────────────────────────────────────────────────────┘
│  [q] Quit  [p] Pause  [r] Retry Failed  [l] View Logs      │
└─────────────────────────────────────────────────────────────┘
```

---

#### 5.2.3 `feature-worker`

**Purpose:** Execute speckit workflow for a single feature

**Trigger:** Spawned by orchestrator-main via Task tool

**Responsibilities:**
1. Read @claude.md before starting
2. Execute 6-step workflow for assigned feature
3. Auto-answer clarify questions
4. Report progress to state file
5. Compact context when needed
6. Report completion/failure with summary

**System Prompt:**
```markdown
You are a Speckit Feature Worker - executing the speckit workflow for a single feature.

Your assigned feature: {feature_id} - {feature_name}

Workflow Steps (execute in order):
1. /speckit.specify {feature_id}
2. /speckit.clarify (auto-answer: {auto_answer_mode})
3. /speckit.plan
4. /speckit.tasks
5. /speckit.analyze
6. /speckit.implement

Rules:
1. ALWAYS read @claude.md first before any work
2. NEVER mock data - all code must be real and working
3. After each step, update state file with progress
4. If context > 70%, run /compact before continuing
5. On completion, provide a COMPACT summary (max 500 chars)
6. On failure, log error details and stop

State File: .claude/orchestrator.state.json
Your Worker ID: {worker_id}

Report Format:
{
  "worker_id": "{worker_id}",
  "feature_id": "{feature_id}",
  "status": "completed|failed|in_progress",
  "current_step": "specify|clarify|plan|tasks|analyze|implement",
  "step_progress": 0-100,
  "summary": "compact summary here",
  "error": null or "error message"
}
```

**Context Management:**
- หลังทำแต่ละ step ให้ check context usage
- ถ้า > 70% ให้ run `/compact`
- Report กลับไป orchestrator ด้วย summary เท่านั้น (ไม่ใช่ full output)

---

### 5.3 Skills

#### 5.3.1 `guide-parser`

**Purpose:** Parse speckit-guide.md to extract feature list

**Input:** Path to speckit-guide.md

**Output:**
```json
{
  "project_name": "Vidiwo",
  "total_features": 20,
  "features": [
    {
      "id": "001",
      "name": "channel-management",
      "priority": "P0",
      "dependencies": [],
      "phase": 1,
      "estimated_complexity": "medium"
    },
    {
      "id": "002",
      "name": "research-engine",
      "priority": "P0",
      "dependencies": ["001"],
      "phase": 1,
      "estimated_complexity": "high"
    }
  ],
  "dependency_graph": {
    "001": [],
    "002": ["001"],
    "003": ["002"],
    "004": ["003"],
    "005": ["003", "004"],
    "006": ["005"]
  },
  "phases": [
    { "phase": 1, "name": "MVP", "features": ["001-006"] },
    { "phase": 2, "name": "Enhancement", "features": ["007-012"] },
    { "phase": 3, "name": "Scale", "features": ["013-020"] }
  ]
}
```

---

#### 5.3.2 `workflow-executor`

**Purpose:** Execute single step of speckit workflow

**Input:**
```json
{
  "step": "specify|clarify|plan|tasks|analyze|implement",
  "feature_id": "001",
  "auto_answer": "recommended|yes|no|ask"
}
```

**Behavior per Step:**

| Step | Action | Auto-Answer Behavior |
|------|--------|---------------------|
| specify | Run `/speckit.specify {feature}` | N/A |
| clarify | Run `/speckit.clarify` | Answer based on `auto_answer` setting (recommended) |
| plan | Run `/speckit.plan` | N/A |
| tasks | Run `/speckit.tasks` | N/A |
| analyze | Run `/speckit.analyze` | Answer based on `auto_answer` setting (recommended) |
| implement | Run `/speckit.implement` | Answer "yes" to confirmations, verify completion |

**IMPORTANT: Auto-Answer applies to BOTH clarify AND analyze steps!**

---

#### 5.3.3 `context-manager`

**Purpose:** Manage context size across workers

**Functions:**

1. **Check Context:**
   ```
   /context
   ```
   Returns usage percentage

2. **Compact if Needed:**
   ```
   if context_usage > threshold:
     /compact --preserve-recent 5
   ```

3. **Create Summary:**
   Generate compact summary for reporting back to orchestrator

---

### 5.4 Hooks

#### 5.4.1 `auto-clarify`

**Purpose:** Auto-answer clarify questions

**Event:** `UserPromptSubmit` (when worker asks clarify question)

**Logic:**
```python
def should_auto_answer(prompt, mode):
    clarify_patterns = [
        "Do you want to proceed",
        "Should I use",
        "Which approach",
        "recommended"
    ]

    if any(pattern in prompt for pattern in clarify_patterns):
        if mode == "recommended":
            return find_recommended_option(prompt)
        elif mode == "yes":
            return "yes"
        elif mode == "no":
            return "no"
        else:  # ask
            return None  # Don't auto-answer

    return None
```

**Configuration:**
```json
{
  "event": "UserPromptSubmit",
  "match": "speckit.clarify|Do you want|Should I|Which approach",
  "action": "auto-respond",
  "response_mode": "recommended"
}
```

---

#### 5.4.2 `report-back`

**Purpose:** Intercept worker completion and format report

**Event:** `SubagentStop`

**Logic:**
1. ดักจับเมื่อ worker agent จบการทำงาน
2. สร้าง compact summary จาก output
3. Update state file
4. ไม่ส่ง full output กลับไป orchestrator (ป้องกัน context overflow)

---

### 5.5 State Management

#### 5.5.1 State File Structure

**Location:** `.claude/orchestrator.state.json`

```json
{
  "version": "1.0.0",
  "session_id": "speckit-orch-20251226-143022",
  "started_at": "2025-12-26T14:30:22Z",
  "updated_at": "2025-12-26T15:15:45Z",
  "status": "running",

  "config": {
    "guide_path": "./speckit-guide.md",
    "workers_count": 4,
    "auto_answer": "recommended",
    "project_name": "Vidiwo"
  },

  "progress": {
    "total_features": 20,
    "completed": 12,
    "in_progress": 3,
    "pending": 5,
    "failed": 0,
    "percentage": 60
  },

  "features": {
    "001": {
      "name": "channel-management",
      "status": "completed",
      "started_at": "2025-12-26T14:30:30Z",
      "completed_at": "2025-12-26T14:45:12Z",
      "worker_id": "W1",
      "steps_completed": ["specify", "clarify", "plan", "tasks", "analyze", "implement"],
      "summary": "Channel CRUD API implemented with validation"
    },
    "013": {
      "name": "advanced-analytics",
      "status": "in_progress",
      "started_at": "2025-12-26T15:10:00Z",
      "worker_id": "W1",
      "current_step": "implement",
      "step_progress": 45,
      "steps_completed": ["specify", "clarify", "plan", "tasks", "analyze"]
    }
  },

  "workers": {
    "W1": {
      "status": "busy",
      "current_feature": "013",
      "pane_id": 1,
      "context_usage": 65
    },
    "W2": {
      "status": "busy",
      "current_feature": "014",
      "pane_id": 2,
      "context_usage": 42
    },
    "W3": {
      "status": "busy",
      "current_feature": "015",
      "pane_id": 3,
      "context_usage": 28
    },
    "W4": {
      "status": "idle",
      "current_feature": null,
      "pane_id": 4,
      "context_usage": 0
    }
  },

  "logs": [
    {
      "timestamp": "2025-12-26T15:15:45Z",
      "level": "info",
      "worker": "W1",
      "message": "Started implement for Feature 013"
    }
  ],

  "errors": []
}
```

---

#### 5.5.2 State Transitions

```
Feature States:
  pending → in_progress → completed
                ↓
              failed → retrying → in_progress
                         ↓
                    max_retries_exceeded

Worker States:
  idle → busy → idle
           ↓
        error → idle (after reassignment)
```

---

### 5.6 Tmux Management

#### 5.6.1 Session Structure

```bash
Session Name: speckit-orch-{timestamp}

Layout:
┌─────────────────────────────────────────┐
│           Pane 0: Dashboard             │
│            (40% height)                 │
├─────────┬─────────┬─────────┬───────────┤
│ Pane 1  │ Pane 2  │ Pane 3  │ Pane 4    │
│ Worker1 │ Worker2 │ Worker3 │ Worker4   │
│  (15%)  │  (15%)  │  (15%)  │  (15%)    │
└─────────┴─────────┴─────────┴───────────┘
```

#### 5.6.2 Tmux Commands

```bash
# Create session
tmux new-session -d -s speckit-orch -x 200 -y 50

# Create panes
tmux split-window -v -p 60  # Dashboard on top
tmux select-pane -t 0
tmux split-window -h -p 75
tmux split-window -h -p 66
tmux split-window -h -p 50

# Start dashboard in pane 0
tmux send-keys -t speckit-orch:0.0 'watch -n 1 cat .claude/dashboard.txt' Enter

# Start workers in panes 1-4
tmux send-keys -t speckit-orch:0.1 'claude --agent feature-worker --feature 001' Enter
tmux send-keys -t speckit-orch:0.2 'claude --agent feature-worker --feature 002' Enter
tmux send-keys -t speckit-orch:0.3 'claude --agent feature-worker --feature 003' Enter
tmux send-keys -t speckit-orch:0.4 'claude --agent feature-worker --feature 004' Enter

# Attach to session
tmux attach -t speckit-orch
```

---

## 6. Implementation Verification & Completion Guarantee

### 6.0 CRITICAL: The "Never Leave Incomplete" Protocol

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION VERIFICATION                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Problem: /speckit.implement อาจ:                                       │
│    - ทำไม่เสร็จ (partial implementation)                                 │
│    - หยุดกลางคัน (timeout, context overflow)                             │
│    - Agent หลับไป                                                       │
│    - ทำ mock data แทนของจริง                                            │
│                                                                          │
│  Solution: VERIFY + RETRY until truly complete                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Implementation Completion Verification

**หลังจาก Worker รายงานว่า implement เสร็จ, Orchestrator ต้อง VERIFY:**

```bash
# Verification Checklist (orchestrator.sh runs this)
verify_implementation() {
    feature_id=$1

    # 1. Check if worker actually finished (not just timed out)
    worker_status=$(jq -r ".features.\"$feature_id\".status" $STATE_FILE)
    if [ "$worker_status" != "completed" ]; then
        return 1  # Not complete
    fi

    # 2. Check if all 6 steps were executed
    steps_count=$(jq -r ".features.\"$feature_id\".steps_completed | length" $STATE_FILE)
    if [ "$steps_count" -lt 6 ]; then
        return 1  # Missing steps
    fi

    # 3. Check implementation artifacts exist
    # (spec file, plan file, code files based on feature type)
    if ! check_artifacts_exist "$feature_id"; then
        return 1  # Missing artifacts
    fi

    # 4. Optional: Run basic tests/lint
    if ! run_basic_verification "$feature_id"; then
        return 1  # Verification failed
    fi

    return 0  # Truly complete
}
```

### 6.2 Retry Incomplete Implementations

**เมื่อ Verification fail:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  IMPLEMENTATION RETRY FLOW                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Worker reports "implement complete"                               │
│                    │                                                  │
│                    ▼                                                  │
│  2. Orchestrator.sh runs verify_implementation()                      │
│                    │                                                  │
│          ┌────────┴────────┐                                         │
│          │                 │                                          │
│       PASS ✓            FAIL ✗                                       │
│          │                 │                                          │
│          ▼                 ▼                                          │
│  Mark as completed    3. Check retry count                            │
│                           │                                           │
│              ┌────────────┴────────────┐                             │
│              │                         │                              │
│         < 3 retries              ≥ 3 retries                         │
│              │                         │                              │
│              ▼                         ▼                              │
│  4. Spawn NEW worker to       5. Mark as FAILED                      │
│     CONTINUE implementation      Log details                         │
│     (not restart from scratch)   Notify user                         │
│                                  Continue with other features         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Continue vs Restart Logic

**สำคัญ: เมื่อ retry ให้ CONTINUE ไม่ใช่ RESTART:**

```python
# When implementation is incomplete, tell worker to CONTINUE
worker_prompt = f"""
You are CONTINUING an incomplete implementation for Feature {feature_id}.

IMPORTANT: Do NOT restart from scratch.

Previous progress:
- Steps completed: {steps_completed}
- Current step: implement (incomplete)
- What was done: {summary_of_done}
- What's missing: {summary_of_missing}

Your task: COMPLETE the remaining work only.
Read the existing code first, then continue from where it stopped.

State file shows:
{feature_state}

Continue implementation now.
"""
```

### 6.4 Orchestrator.sh Watchdog Loop

```bash
#!/bin/bash
# orchestrator.sh - The Watchdog that NEVER sleeps

STATE_FILE=".claude/orchestrator.state.json"
CHECK_INTERVAL=5  # seconds

main_loop() {
    while true; do
        # Read current state
        state=$(cat $STATE_FILE)

        # Check if ALL features complete
        total=$(echo $state | jq '.progress.total_features')
        completed=$(echo $state | jq '.progress.completed')

        if [ "$completed" -eq "$total" ]; then
            echo "🎉 ALL FEATURES COMPLETE!"
            send_notification "Orchestration complete: $completed/$total features"
            exit 0
        fi

        # Check each in_progress feature
        for feature in $(echo $state | jq -r '.features | to_entries[] | select(.value.status=="in_progress") | .key'); do
            check_and_handle_feature "$feature"
        done

        # Check for stuck workers (no update in 10 minutes)
        check_stuck_workers

        # Assign pending features to idle workers
        assign_pending_features

        # Update dashboard
        update_dashboard

        sleep $CHECK_INTERVAL
    done
}

check_and_handle_feature() {
    feature_id=$1

    # Get last update time
    last_update=$(jq -r ".features.\"$feature_id\".last_update" $STATE_FILE)
    now=$(date +%s)
    diff=$((now - last_update))

    # If no update in 10 minutes, worker might be stuck
    if [ $diff -gt 600 ]; then
        echo "⚠️ Feature $feature_id stuck - no update in 10 min"
        restart_worker_for_feature "$feature_id"
    fi

    # Check if implement step claims complete but verification fails
    current_step=$(jq -r ".features.\"$feature_id\".current_step" $STATE_FILE)
    if [ "$current_step" == "implement" ]; then
        step_progress=$(jq -r ".features.\"$feature_id\".step_progress" $STATE_FILE)
        if [ "$step_progress" -eq 100 ]; then
            # Verify completion
            if ! verify_implementation "$feature_id"; then
                echo "⚠️ Feature $feature_id implementation incomplete - retrying"
                increment_retry_count "$feature_id"
                retry_implementation "$feature_id"
            fi
        fi
    fi
}

restart_worker_for_feature() {
    feature_id=$1
    worker_id=$(jq -r ".features.\"$feature_id\".worker_id" $STATE_FILE)

    # Kill stuck worker
    tmux send-keys -t "speckit-orch:0.$worker_id" C-c
    sleep 2

    # Start new worker to CONTINUE (not restart)
    tmux send-keys -t "speckit-orch:0.$worker_id" \
        "claude --resume-feature $feature_id --continue-from-state" Enter
}

# Run the watchdog
main_loop
```

---

## 7. Error Handling

### 7.1 Error Types

| Error Type | Description | Recovery Action |
|------------|-------------|-----------------|
| `WORKER_TIMEOUT` | Worker stuck for > 30 min | Kill and reassign |
| `STEP_FAILED` | Speckit step returned error | Retry up to 3 times |
| `CONTEXT_OVERFLOW` | Worker context > 90% | Force compact and continue |
| `DEPENDENCY_BLOCKED` | Feature depends on failed feature | Skip and mark blocked |
| `TMUX_ERROR` | Tmux session issue | Recreate session |
| `IMPLEMENT_INCOMPLETE` | Implementation not fully done | Spawn new worker to CONTINUE |
| `VERIFICATION_FAILED` | Output doesn't meet criteria | Retry with specific feedback |

### 7.2 Retry Logic

```python
retry_config = {
    "max_retries": 3,
    "backoff_seconds": [30, 60, 120],  # Exponential backoff
    "retry_on": ["STEP_FAILED", "WORKER_TIMEOUT", "IMPLEMENT_INCOMPLETE"],
    "no_retry_on": ["DEPENDENCY_BLOCKED"]
}
```

### 7.3 Failure Notification

เมื่อ feature fail หลัง max retries:
1. Log error ใน state file
2. Update dashboard
3. ส่ง notification (optional: telegram via rw-telegram plugin)
4. Continue กับ features อื่นที่ไม่ depend

---

## 8. Plugin File Structure

```
speckit-orchestrator/
├── plugin.json                      # Plugin manifest
├── README.md                        # Documentation
│
├── commands/
│   ├── orchestrate.md              # /orchestrate command (entry point)
│   ├── orch-status.md              # /orch-status command
│   ├── orch-stop.md                # /orch-stop command
│   └── orch-resume.md              # /orch-resume command
│
├── agents/
│   ├── feature-worker.md           # Worker agent (does actual work)
│   └── continue-worker.md          # Worker for CONTINUING incomplete work
│
├── skills/
│   ├── guide-parser.md             # Parse speckit-guide skill
│   ├── workflow-executor.md        # Execute workflow step skill
│   └── context-manager.md          # Manage context skill
│
├── hooks/
│   ├── auto-answer.json            # Auto-answer for clarify AND analyze
│   ├── report-progress.json        # Report progress to state file
│   └── verify-completion.json      # Verify implementation complete
│
├── scripts/                         # ⭐ CRITICAL: Shell scripts for reliability
│   ├── orchestrator.sh             # 🔥 MAIN WATCHDOG (never sleeps)
│   ├── tmux-setup.sh               # Setup tmux session
│   ├── dashboard-render.sh         # Render dashboard
│   ├── verify-implementation.sh    # Verify feature completion
│   ├── spawn-worker.sh             # Spawn claude code worker
│   └── state-manager.sh            # State file utilities
│
└── templates/
    ├── state-template.json         # State file template
    ├── dashboard-template.txt      # Dashboard layout template
    └── worker-prompt-continue.md   # Prompt for continuing incomplete work
```

**IMPORTANT: orchestrator.sh is the CORE of this plugin**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  orchestrator.sh responsibilities:                                       │
│                                                                          │
│  1. Parse speckit-guide.md and create initial state                     │
│  2. Setup tmux session with dashboard + worker panes                    │
│  3. Main loop (never exits until ALL complete):                         │
│     - Monitor state file                                                │
│     - Check worker health                                               │
│     - Restart stuck workers                                             │
│     - Verify completions                                                │
│     - Assign pending work                                               │
│     - Update dashboard                                                  │
│  4. GUARANTEE: Only exits when 100% features complete                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Configuration

### 9.1 Plugin Settings

**Location:** `.claude/speckit-orchestrator.local.md`

```yaml
---
# Speckit Orchestrator Configuration

# Worker settings
workers:
  default_count: 4
  max_count: 8
  timeout_minutes: 30

# Auto-answer settings
auto_answer:
  mode: recommended  # recommended | yes | no | ask
  skip_patterns:
    - "test only"
    - "debug"

# Context management
context:
  compact_threshold: 70  # percentage
  preserve_recent: 5     # messages to preserve

# Dashboard
dashboard:
  refresh_interval: 1    # seconds
  log_history: 50        # lines to show

# Retry settings
retry:
  max_attempts: 3
  backoff_multiplier: 2
  initial_delay: 30      # seconds

# Notifications (requires rw-telegram plugin)
notifications:
  enabled: false
  on_complete: true
  on_failure: true
---

# Notes
Add any project-specific notes here.
```

---

## 10. Integration Points

### 10.1 With Existing Plugins

| Plugin | Integration |
|--------|-------------|
| `rw-telegram` | Send notifications on complete/failure |
| `claude-mem` | Store orchestration history |
| `code-review` | Auto-review after implement step |

### 10.2 With Speckit CLI

- Orchestrator calls speckit commands via Claude Code
- Commands: `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`, `/speckit.implement`

---

## 11. Testing Plan

### 11.1 Unit Tests

| Component | Test Cases |
|-----------|------------|
| guide-parser | Parse valid guide, handle missing sections, extract dependencies |
| state-manager | Create, update, load state file |
| tmux-manager | Create session, split panes, send commands |
| orchestrator.sh | Watchdog loop, worker health check, verification |

### 11.2 Integration Tests

| Scenario | Description |
|----------|-------------|
| Single Feature | Run orchestrator with 1 feature, verify completion |
| Parallel Workers | Run with 4 workers, verify parallel execution |
| Resume | Stop mid-way, resume, verify state recovery |
| Error Recovery | Inject failure, verify retry and recovery |
| Incomplete Implementation | Force incomplete, verify retry mechanism |
| Import Progress | Import manual progress, verify continuation |

### 11.3 E2E Tests

| Test | Steps |
|------|-------|
| Full Orchestration | Run on test project with 5 features, verify all complete |
| Dashboard | Verify dashboard updates in real-time |
| Context Management | Run until context > 70%, verify compact works |

---

## 12. Success Criteria

### 12.1 Functional Requirements

- [ ] Parse speckit-guide.md and extract all features
- [ ] Create tmux session with dashboard + worker panes
- [ ] Execute 6-step workflow per feature
- [ ] Support 1-8 parallel workers (default 4)
- [ ] Auto-answer clarify AND analyze questions
- [ ] Real-time dashboard updates
- [ ] Resume from saved state
- [ ] Handle errors and retry
- [ ] **CRITICAL: Verify implementation completion**
- [ ] **CRITICAL: Retry incomplete implementations until done**
- [ ] Import existing progress from manual work
- [ ] Shell script watchdog that never sleeps

### 12.2 Non-Functional Requirements

| Metric | Target |
|--------|--------|
| Reliability | **100% features complete** - this is the PRIMARY goal |
| Performance | < 5 min overhead vs manual execution |
| Context Efficiency | Workers never exceed 90% context |
| Dashboard Latency | < 2 second update delay |
| Watchdog Uptime | Shell script runs until ALL complete |
| Verification Accuracy | Catch 100% of incomplete implementations |

---

## 13. Future Enhancements

### Phase 2 (v1.1)

- [ ] Web dashboard (instead of tmux)
- [ ] Slack/Discord notifications
- [ ] Feature dependency visualization
- [ ] Parallel within feature (specify + clarify can run together)

### Phase 3 (v2.0)

- [ ] Multi-project orchestration
- [ ] Cloud workers (run on remote machines)
- [ ] AI-powered auto-fix for failures
- [ ] Integration with CI/CD pipelines

---

## 14. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Orchestrator | Shell script watchdog that manages the entire workflow |
| Worker | Claude Code agent that executes speckit workflow for single feature |
| Dashboard | Real-time UI showing progress (tmux-based) |
| State File | JSON file tracking all progress and state (single source of truth) |
| Compact | Summarize context to reduce size |
| Watchdog | Shell script that never sleeps, monitors and restarts workers |
| Verification | Process of checking if implementation is truly complete |
| Continue | Resume incomplete work (not restart from scratch) |
| Hybrid Architecture | Shell script + Claude agents working together |

### B. References

- Speckit Guide: `./speckit-guide.md`
- Claude Code Plugin Dev: [Plugin Development Guide]
- Tmux Documentation: https://github.com/tmux/tmux/wiki

---

**End of Specification**

Version: 1.1.0
Last Updated: 2025-12-26
Author: RawinLab

---

## Changelog

### v1.1.0 (2025-12-26)
- Added **Hybrid Architecture** (Shell Script Watchdog + Claude Agents)
- Added **Implementation Verification** - verify completion before marking done
- Added **Retry Incomplete** - continue (not restart) incomplete implementations
- Added **Import Existing Progress** - support for manually-started projects
- Added **Auto-answer for analyze step** (not just clarify)
- Added **orchestrator.sh** as core watchdog that never sleeps
- Updated reliability target to **100% completion** (non-negotiable)
- Added `--set-completed` and `--import-state` arguments

### v1.0.0 (2025-12-26)
- Initial specification
