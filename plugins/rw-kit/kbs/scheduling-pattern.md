# Context-Aware Batch Scheduling Pattern

> **Reference**: This document is the single source of truth for the scheduling pattern used across all commands and agents.

## The Problem

Running many parallel agents causes **main context to fill up quickly**, making it impossible to:
- Run `/compact` when needed
- Continue the conversation
- Complete large modules

## The Solution: Batch-Based Execution with Compaction

### Key Principles

1. **Batch tasks by dependency level** (max 5-7 agents per batch)
2. **Compact after each batch** to free context
3. **Minimize subagent output** - tell agents to reply "DONE" only
4. **Subagents have isolated context** - use them for all work
5. **Verify via files, not output** - check created files instead of reading agent output

---

## Subagent Output Minimization (CRITICAL)

### The Root Cause of Context Bloat

When a subagent completes, its **full output is added to main context**. A single agent can return:
- 500+ lines of code changes
- 200+ lines of logs
- Full file diffs

**This quickly fills main context even with batching!**

### Solution: Minimal Output Prompts

Always include these instructions at the END of every subagent prompt:

```
---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list of files created/modified]

Do NOT include:
- Code snippets
- Full file contents
- Detailed explanations
- Logs or debug output
---
```

### Example Prompts

#### Bad (causes context bloat):
```javascript
Task({
  subagent_type: 'backend-development:backend-architect',
  prompt: 'Create user authentication endpoints',
  run_in_background: true
})
// Agent returns 500+ lines → fills main context
```

#### Good (minimal output):
```javascript
Task({
  subagent_type: 'backend-development:backend-architect',
  prompt: `Create user authentication endpoints in apps/api/src/auth/

Requirements:
- POST /auth/register
- POST /auth/login
- POST /auth/refresh

---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list]

Do NOT include code snippets or detailed explanations.
---`,
  run_in_background: true
})
// Agent returns: "DONE: Created auth endpoints. Files: auth.controller.ts, auth.service.ts"
```

### Verification Strategy

Instead of reading agent output for details, verify via file system:

```javascript
// After agent completes
TaskOutput(agent.id, { block: false })

if (result.status === 'completed') {
  // DON'T: Parse result.output for details
  // DO: Check files directly
  Glob({ pattern: 'apps/api/src/auth/*.ts' })
  Read({ file_path: 'apps/api/src/auth/auth.controller.ts', limit: 20 })
}
```

### Context Savings

| Method | Context Used |
|--------|--------------|
| Full agent output | ~5,000-20,000 tokens |
| Minimal "DONE" response | ~50-100 tokens |
| **Savings per agent** | **99%+** |

---

## Comparison

### OLD (Unlimited Parallel) - DO NOT USE
```
Launch 15+ agents at once
↓ All outputs return to main context
↓ Context fills up to 95%+
↓ Cannot run /compact
↓ Session becomes unusable
```

### NEW (Batched with Compaction) - USE THIS
```
Batch 0: 5 agents → Poll → Complete → /compact (free context)
Batch 1: 5 agents → Poll → Complete → /compact (free context)
Batch 2: 4 agents → Poll → Complete → /compact (free context)
Testing: Run tests → Fix → /compact
```

---

## Implementation Pattern

### Step 1: Group Tasks by Dependency Level

```
TaskID | Depends On | Batch
-------|------------|------
1      | none       | 0
2      | none       | 0
3      | none       | 0
4      | 1          | 1
5      | 3          | 1
6      | 1, 2       | 1
7      | 4, 5, 6    | 2
```

### Step 2: Execute Batch-by-Batch

```javascript
for (batch of batches) {
  // 2.1 Launch batch (max 5-7 agents)
  for (task of batch.tasks.slice(0, 7)) {
    Task({
      subagent_type: getAgentType(task),
      prompt: task.description,
      run_in_background: true
    })
  }

  // 2.2 Poll until batch complete
  while (batchRunning) {
    for (agent of batchAgents) {
      result = TaskOutput(agent.id, block: false)
      if (result.completed) {
        // Record status ONLY, not full output
        log(`✅ ${task.name}: completed`)
      }
    }
  }

  // 2.3 Summary and Compact
  printBatchSummary()
  // Use /compact to free context before next batch
}
```

### Step 3: Handle Large Batches

If a batch has more than 7 tasks:

```javascript
// Split into sub-batches
const subBatches = chunkArray(batch.tasks, 5)

for (subBatch of subBatches) {
  // Execute sub-batch
  executeSubBatch(subBatch)
  // Compact between sub-batches
  compact()
}
```

---

## Batch Size Guidelines

| Scenario | Max Agents | Reason |
|----------|------------|--------|
| Normal execution | 5-7 | Balanced parallelism |
| Complex tasks | 3-5 | Each agent returns more data |
| Simple tasks | 7-10 | Less context per task |
| Testing phase | 3-5 | Test output can be large |

---

## Context Management Rules

### DO:
- Limit each batch to 5-7 agents
- Use `/compact` after each batch completes
- Summarize agent results (status only)
- Track progress in TodoWrite
- Use subagents for all work

### DON'T:
- Launch 10+ agents simultaneously
- Return full agent output to main context
- Wait until context is 95% full
- Ignore context warnings
- Skip compaction between batches

---

## Output Summarization

### Bad: Full Output
```
Agent completed with output:
[500 lines of code changes]
[200 lines of logs]
[Full diff of all files]
```

### Good: Summary Only
```
✅ Task 4: API endpoints created
   - Created: auth.controller.ts, auth.service.ts
   - Modified: app.module.ts
```

---

## Error Handling in Batches

```javascript
if (task.failed) {
  // 1. Record failure
  failedTasks.push(task)

  // 2. Launch fix agent (counts toward batch limit)
  fixAgent = Task({
    subagent_type: "unit-testing:debugger",
    prompt: `Fix: ${task.error}`,
    run_in_background: true
  })

  // 3. Track for retry after batch
  pendingRetries.push({ task, fixAgent })
}

// After batch complete, retry failed tasks
for (retry of pendingRetries) {
  if (retry.fixAgent.completed) {
    retryTask(retry.task)
  }
}
```

---

## Integration with Testing Phases

### After Implementation Batches

```javascript
// Phase 3: Unit Testing
runUnitTests()
if (failures) {
  launchFixAgents(failures)  // Max 5 agents
  compact()
}

// Phase 4: E2E Testing
runE2ETests()
if (failures) {
  launchFixAgents(failures)  // Max 5 agents
  compact()
}
```

---

## Available Specialized Agents

| Task Type | Agent Full Name |
|-----------|-----------------|
| Database/Prisma | `backend-development:backend-architect` |
| API/NestJS | `backend-development:backend-architect` |
| UI/React/Next.js | `multi-platform-apps:frontend-developer` |
| Security Review | `full-stack-orchestration:security-auditor` |
| Unit/E2E Tests | `full-stack-orchestration:test-automator` |
| Performance | `full-stack-orchestration:performance-engineer` |
| Deployment/CI/CD | `full-stack-orchestration:deployment-engineer` |
| TypeScript | `javascript-typescript:typescript-pro` |
| JavaScript | `javascript-typescript:javascript-pro` |
| API Docs | `documentation-generation:api-documenter` |
| Technical Docs | `documentation-generation:docs-architect` |
| Tutorials | `documentation-generation:tutorial-engineer` |
| UI/UX Design | `multi-platform-apps:ui-ux-designer` |
| Codebase Search | `Explore` |
| Implementation Plan | `Plan` |
| Debugging | `unit-testing:debugger` |

---

## Quick Reference

```
# Batch execution flow
📦 Batch 0 (5-7 agents) → Poll → ✅ → /compact
📦 Batch 1 (5-7 agents) → Poll → ✅ → /compact
📦 Batch N (5-7 agents) → Poll → ✅ → /compact

# Task call with MINIMAL OUTPUT prompt
Task(subagent_type: "agent-name", prompt: `
  [Your task description]

  ---
  RESPONSE FORMAT (CRITICAL):
  When complete, respond with ONLY:
  DONE: [1-2 sentence summary]
  Files: [comma-separated list]

  Do NOT include code snippets or detailed explanations.
  ---
`, run_in_background: true)

# Poll non-blocking
TaskOutput(task_id: "agent_id", block: false)

# Check completion - verify via files, NOT output
result.status === "completed" | "running" | "failed"
Glob({ pattern: "path/to/expected/*.ts" })  // Verify files exist

# After each batch
/compact  ← CRITICAL: Free context before next batch
```

### Minimal Output Template (Copy-Paste)

```
---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list of files created/modified]

Do NOT include:
- Code snippets
- Full file contents
- Detailed explanations
- Logs or debug output
---
```

---

## Workflow Summary

```
┌─────────────────────────────────────────────────────────┐
│                    EXECUTION FLOW                        │
├─────────────────────────────────────────────────────────┤
│  1. Parse todolist → Group by dependency                 │
│  2. For each batch:                                      │
│     a. Launch 5-7 agents (run_in_background: true)      │
│     b. Poll non-blocking until complete                  │
│     c. Summary output (status only)                      │
│     d. /compact ← FREE CONTEXT                          │
│  3. Unit Tests → Fix failures → /compact                 │
│  4. E2E Tests → Fix failures → /compact                  │
│  5. Final checks → Commit → Report                       │
└─────────────────────────────────────────────────────────┘
```
