# Context Management Guide for Claude Code

> Maximize effective context usage and simulate "unlimited" context window
>
> **Related**: See `.claude/kbs/scheduling-pattern.md` for batch execution patterns (the primary reference for batch + compact workflow).

## Overview

Claude has a **200k token hard limit**. This guide provides strategies to work effectively within this limit while feeling like you have unlimited context.

## Context Management Strategies

### 1. Use `/compact` Frequently

```bash
# Check context usage
/context

# When usage > 60%, run:
/compact
```

**When to compact:**
- After completing a batch of tasks
- Before starting a new major task
- When context usage exceeds 60%

### 2. Leverage Subagents

Each subagent has **isolated context** - they don't consume main context.

```javascript
// GOOD: Uses subagent context, not main
Task({
  subagent_type: 'backend-development:backend-architect',
  prompt: 'Complex task here...',
  run_in_background: true
})

// BAD: Doing everything in main context
// Reading many files, writing code, all in main thread
```

**Subagent benefits:**
- Each agent has own 200k context
- Results return as summary only
- Main context stays clean

### 3. Minimal Output Template

**ALWAYS add this to subagent prompts:**

```
---
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [comma-separated list]

Do NOT include code snippets or detailed explanations.
---
```

**Savings:**
- Without template: ~5,000-20,000 tokens per agent
- With template: ~50-100 tokens per agent
- **99%+ reduction!**

### 4. Batch Execution Pattern

```
Batch 1 (5-7 agents) → Complete → /compact
Batch 2 (5-7 agents) → Complete → /compact
Batch 3 (5-7 agents) → Complete → /compact
```

**Rules:**
- Maximum 5-7 parallel agents per batch
- Compact after each batch completes
- Verify via files, not agent output parsing

### 5. Three-Level Context Management (NEW)

Adapted from rw-speckit-orchestrator pattern:

```
┌─────────────────────────────────────────────────────────────┐
│  Level 1: Orchestrator (Main Context)                       │
│  - Coordinates batches and phases                           │
│  - /context → check after each batch                        │
│  - /compact → after each batch completes                    │
│  - Threshold: 60% → compact immediately                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Task Tool
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Level 2: Batch Workers (Subagent Context)                  │
│  - Execute assigned tasks                                   │
│  - /context → check after each major step                   │
│  - /compact → if > 50%, ALWAYS before complex operations    │
│  - Threshold: 50% → compact immediately                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Task Tool (can be parallel)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Level 3: Nested Subagents                                  │
│  - Specialized work (frontend, backend, tests)              │
│  - /context → check regularly                               │
│  - /compact → if > 70%                                      │
│  - Threshold: 70% → compact immediately                     │
└─────────────────────────────────────────────────────────────┘
```

**Context Thresholds:**

| Level | Threshold | Action |
|-------|-----------|--------|
| Orchestrator | 60% | `/compact` immediately |
| Batch Worker | 50% | `/compact` immediately |
| Nested Subagent | 70% | `/compact` immediately |

**Mandatory Compact Points:**

| Event | Action |
|-------|--------|
| After each batch completes | `/compact` |
| Before starting new phase | Check `/context` |
| Before complex operation | `/compact` if needed |
| After tests complete | `/compact` |

**Hook Integration:**
The `context-monitor.json` hook automatically suggests `/compact` when:
- A batch completes
- Multiple consecutive tool calls
- Signs of context pressure detected

### 6. Use Explore Agent for Research

Instead of reading many files in main context:

```javascript
// GOOD: Explore agent searches in its own context
Task({
  subagent_type: 'Explore',
  prompt: 'Find all authentication-related files and summarize the auth flow'
})

// BAD: Reading 20+ files in main context
Read({ file_path: 'file1.ts' })
Read({ file_path: 'file2.ts' })
// ... continues eating main context
```

## Context Usage Optimization

### Token Cost Reference

| Action | Approximate Tokens |
|--------|-------------------|
| CLAUDE.md (typical) | ~3,000-6,000 |
| System prompt + tools | ~20,000-25,000 |
| Average file read | ~500-2,000 |
| Subagent result (no template) | ~5,000-20,000 |
| Subagent result (with template) | ~50-100 |
| Git diff output | ~200-5,000 |

### Best Practices

1. **Start fresh for unrelated tasks** - Use `/clear` when switching contexts
2. **Read only what you need** - Use `limit` and `offset` for large files
3. **Use Glob/Grep first** - Find specific files before reading
4. **Delegate to subagents** - Complex tasks should run in isolated context
5. **Compact proactively** - Don't wait until context is full

## Quick Reference

```bash
# Check current context usage
/context

# Compact conversation (summarize history)
/compact

# Clear and start fresh
/clear

# List running tasks
/tasks
```

## Simulating "Unlimited" Context

By combining these strategies, you effectively get:

```
Main Context: 200k tokens
+ Subagent 1: 200k tokens (isolated)
+ Subagent 2: 200k tokens (isolated)
+ Subagent N: 200k tokens (isolated)
+ Compaction: Continuous summarization
─────────────────────────────────
= Effectively unlimited context
```

The key is **proper orchestration** - use main context for coordination, delegate heavy work to subagents.
