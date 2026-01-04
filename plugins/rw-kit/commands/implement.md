---
name: implement
description: Full workflow for new features, bug fixes, or enhancements (type: feature|fix|enhancement)
argument-hint: <feature-name> <type> [--auto-answer] [--resume]
model: opus
arguments:
  - name: auto-answer
    description: Auto-answer confirmations during execution (true/false)
    required: false
    default: "true"
  - name: resume
    description: Resume from previous execution state (true/false)
    required: false
    default: "false"
---
name: implement

You are a highly skilled **Team Lead** orchestrating the full implementation workflow.

## Your Mission

Implement `$ARGUMENTS` using the complete workflow from requirement creation to final verification.

## Auto-Answer & State Management

### Auto-Answer Mode (Default: ON)
When `--auto-answer` is true (default):
- Hooks in `.claude/hooks/` will automatically answer confirmations
- No user intervention needed during execution
- Selects "(Recommended)" options automatically

### State Tracking
- State file: `.claude/rw-kit.state.json`
- Tracks: current phase, tasks, progress, resume point
- Use `--resume` to continue from previous state

### Resume Mode
If `--resume` is true and state file exists:
1. Load existing state
2. Skip completed phases/tasks
3. Continue from resume point

---
name: implement

## Process Overview

```
1. CREATE REQUIREMENT → requirements/{XX}-{feature-name}.md
2. PLAN MODULE → plans/{XX}-1-{feature-name}-plan.md
3. CONVERT TO TODOLIST → plans/{XX}-1-{feature-name}-todolist.md
4. EXECUTE TASKS → Parallel agent orchestration
5. TEST & VERIFY → Unit tests, E2E tests, UAT
6. COMPLETION → docs/reports/{timestamp}-{feature}-completion.md
```

---
name: implement

## Phase 1: Create Requirement

### Step 1.1: Parse Arguments
Extract from `$ARGUMENTS`:
- Feature name (e.g., "user-notifications")
- Type: feature | fix | enhancement

### Step 1.2: Determine Module Number
```javascript
// Find existing modules
Glob({ pattern: "requirements/*.md" })
// Or plans folder
Glob({ pattern: "plans/*-plan.md" })

// Get next available number
```

### Step 1.3: Create Requirement File
```javascript
Write({
  file_path: "requirements/{XX}-{feature-name}.md",
  content: `# {Feature Name}

## Type
{feature | fix | enhancement}

## Description
{Brief description of what needs to be done}

## User Stories
- As a [user], I want [feature] so that [benefit]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
{Any technical considerations}
`
})
```

---
name: implement

## Phase 2: Plan Module

> **IMPORTANT**: Follow the scheduling pattern in `.claude/kbs/scheduling-pattern.md`

### Step 2.1: Launch Parallel Analysis (Background)
```javascript
Task({
  subagent_type: "Explore",
  prompt: `Search codebase for existing implementations related to: {feature}

---
name: implement
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Structure: [key directories and patterns found]
---`,
  run_in_background: true
})

Task({
  subagent_type: "sa-analyst",
  prompt: `Analyze requirements for: {feature}

---
name: implement
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Requirements: [key requirements identified]
---`,
  run_in_background: true
})

Task({
  subagent_type: "tech-lead",
  prompt: `Design technical architecture for: {feature}

---
name: implement
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Architecture: [key architectural decisions]
---`,
  run_in_background: true
})
```

### Step 2.2: Create Plan File
```javascript
Write({
  file_path: "plans/{XX}-1-{feature-name}-plan.md",
  content: `# Plan: {Feature Name}

## Overview
{Description}

## Features
1. {Feature 1}
2. {Feature 2}

## Technical Design
### API Endpoints
{endpoints}

### Database Changes
{schema}

### UI Components
{components}

## Test Cases
- {test case 1}
- {test case 2}
`
})
```

---
name: implement

## Phase 3: Convert to TodoList

### Step 3.1: Create TodoList with Dependencies
```javascript
Write({
  file_path: "plans/{XX}-1-{feature-name}-todolist.md",
  content: `# TodoList: {Feature Name}

## Tasks with Dependencies

### Root Tasks (No Dependencies)
- [ ] Task 1: {description} [agent: backend-development:backend-architect] [deps: none]
- [ ] Task 2: {description} [agent: multi-platform-apps:frontend-developer] [deps: none]

### Dependent Tasks
- [ ] Task 3: {description} [agent: backend-development:backend-architect] [deps: Task 1]
- [ ] Task 4: {description} [agent: multi-platform-apps:frontend-developer] [deps: Task 2]
- [ ] Task 5: {description} [agent: full-stack-orchestration:test-automator] [deps: Task 3, Task 4]
`
})
```

---
name: implement

## Phase 4: Execute Tasks

### Step 4.1: Group Tasks by Dependency Level
```
Batch 0: Tasks with no dependencies
Batch 1: Tasks depending only on Batch 0
Batch 2: Tasks depending on Batch 0 or 1
...
```

### Step 4.2: Execute Batches (Max 5-7 agents per batch)

For each batch:
```javascript
// Launch batch with Minimal Output Template
for (task of batch.tasks.slice(0, 7)) {
  Task({
    subagent_type: task.agent,
    prompt: `${task.description}

---
name: implement
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list]

Do NOT include code snippets or detailed explanations.
---`,
    run_in_background: true
  })
}

// Poll until complete
// Update todolist file (mark completed tasks)
// /compact before next batch
```

### Step 4.3: Update TodoList File
```javascript
// Mark completed tasks in the todolist file
Edit({
  file_path: "plans/{XX}-1-{feature-name}-todolist.md",
  old_string: "- [ ] Task 1:",
  new_string: "- [x] Task 1:"
})
```

---
name: implement

## Phase 5: Test & Verify

### Step 5.1: Run Unit Tests
```bash
npm test -- --coverage
```

### Step 5.2: Run E2E Tests
```bash
npx playwright test --project=chromium
```

### Step 5.3: Smoke Test (MANDATORY)
```bash
npm run dev &
sleep 15
curl -f http://localhost:{API_PORT}/api/health
curl -f http://localhost:{WEB_PORT}
```

### Step 5.4: Fix Any Failures
Launch fix agents in background, re-test until all pass.

---
name: implement

## Phase 6: Completion

### Step 6.1: Create Completion Report
```javascript
Write({
  file_path: "docs/reports/{yyyyMMddHHmm}-{feature}-completion.md",
  content: `# Implementation Complete: {Feature Name}

## Summary
- Type: {feature | fix | enhancement}
- Module: {XX}-1-{feature-name}
- Status: COMPLETE

## Files Created/Modified
{list of files}

## Tests
- Unit Tests: {X} passing
- E2E Tests: {X} passing
- Coverage: {X}%

## Smoke Test
- API Health: PASS
- Frontend: PASS

## Next Steps
- [ ] QA Review: \`/project:qa-review {module}\`
`
})
```

### Step 6.2: Commit Changes
```bash
git add .
git commit -m "{type}({module}): implement {feature-name}"
```

---
name: implement

## Quick Reference

```
📋 Phase 1: Create Requirement
📝 Phase 2: Plan Module (parallel agents)
📊 Phase 3: Convert to TodoList
📦 Phase 4: Execute (batch + minimal output + compact)
🧪 Phase 5: Test (unit → E2E → smoke)
✅ Phase 6: Complete (report + commit)
```

## After Completion

1. ✅ Requirement file created
2. ✅ Plan file created
3. ✅ TodoList created and all tasks marked complete
4. ✅ All tests passing
5. ✅ Smoke test passed
6. ✅ Completion report created
7. ✅ Changes committed
8. 📋 Ready for `/project:qa-review {module}`
