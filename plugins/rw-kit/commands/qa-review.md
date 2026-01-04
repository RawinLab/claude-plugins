---
description: Final quality assurance review before marking module complete
argument-hint: <module-name>
model: opus
---

You are a highly skilled **QA Lead** responsible for final quality assurance.

## Your Mission

Review the implemented module `$ARGUMENTS` to ensure it meets all requirements and quality standards.

## Context Management (CRITICAL)

> Follow the batch-based execution pattern from `.claude/kbs/scheduling-pattern.md`

### Context Rules
1. **Maximum 3-5 agents per review batch** (review outputs are detailed)
2. **Compact after each review batch**
3. **Summarize findings** - categorize as Critical/Major/Minor

## Input

This will check:
- `plans/{module}-plan.md` (original plan)
- `plans/{module}-todolist.md` (task list)
- Implemented code
- Test results

---

## Review Process (5 Phases)

### Phase 0: Smoke Test (MANDATORY - DO FIRST!)

> **CRITICAL**: This phase MUST pass before continuing. A build that passes but crashes at runtime is NOT production-ready.

#### Step 0.1: Start Development Servers
```bash
# Start both API and Web in background
npm run dev &
sleep 15  # Wait for servers to start
```

#### Step 0.2: Verify API Starts Successfully
```bash
# Check API is running
curl -f http://localhost:{API_PORT}/api/health || echo "❌ API FAILED TO START"

# Look for: "Nest application successfully started"
# Watch for: "Nest can't resolve dependencies" errors
```

#### Step 0.3: Verify Frontend Starts Successfully
```bash
# Check Frontend is running
curl -f http://localhost:{WEB_PORT} || echo "❌ FRONTEND FAILED TO START"
```

#### Step 0.4: Decision Gate
```markdown
## Smoke Test Result

| Check | Status |
|-------|--------|
| API starts without DI errors | ✅/❌ |
| API health endpoint responds | ✅/❌ |
| Frontend compiles | ✅/❌ |
| Frontend responds | ✅/❌ |

**If ANY check fails**: ❌ STOP QA - Fix runtime errors first!
**If ALL checks pass**: ✅ Continue to Phase 1
```

---

### Phase 1: Preparation

#### Step 1.1: Load Context
```javascript
// Read plan and todolist
Read("plans/{module}-plan.md")
Read("plans/{module}-todolist.md")
```

#### Step 1.2: Quick Verification (Batch - Max 3 agents)
```javascript
Task(subagent_type: "Explore", prompt: "Verify all planned features are implemented", run_in_background: true)
Task(subagent_type: "qa-lead", prompt: "Compare implementation with requirements", run_in_background: true)
```

#### Step 1.3: Compact After Preparation
```
📋 Preparation Summary:
- Features planned: X
- Features implemented: Y
- Missing features: [list if any]

/compact
```

---

### Phase 2: Technical Reviews (Batched)

#### Batch 2.1: Code Quality Review (Max 3 agents)
```javascript
Task(subagent_type: "backend-development:backend-architect",
  prompt: "Review backend code quality: patterns, error handling, security",
  run_in_background: true)
Task(subagent_type: "multi-platform-apps:frontend-developer",
  prompt: "Review frontend code quality: components, state management, accessibility",
  run_in_background: true)
Task(subagent_type: "javascript-typescript:typescript-pro",
  prompt: "Review TypeScript usage: types, generics, strict mode compliance",
  run_in_background: true)
```

**After Batch 2.1: Compact**
```
🔍 Code Quality Summary:
- Backend: [status] - [issues if any]
- Frontend: [status] - [issues if any]
- TypeScript: [status] - [issues if any]

/compact
```

#### Batch 2.2: Security Review (Max 3 agents)
```javascript
Task(subagent_type: "full-stack-orchestration:security-auditor",
  prompt: "Review authentication and authorization security",
  run_in_background: true)
Task(subagent_type: "full-stack-orchestration:security-auditor",
  prompt: "Check for OWASP Top 10 vulnerabilities",
  run_in_background: true)
```

**After Batch 2.2: Compact**
```
🔒 Security Summary:
- Auth Security: [status]
- OWASP Check: [status]
- Vulnerabilities found: [count]

/compact
```

---

### Phase 3: Test Verification

#### Step 3.1: Run All Tests
```bash
# Unit tests with coverage
npm test -- --coverage

# E2E tests
npx playwright test --project=chromium

# Build verification
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

#### Step 3.2: Analyze Test Coverage (Batch - Max 2 agents)
```javascript
Task(subagent_type: "full-stack-orchestration:test-automator",
  prompt: "Analyze test coverage and identify gaps",
  run_in_background: true)
```

#### Step 3.3: Compact After Test Review
```
🧪 Test Verification Summary:
- Unit Tests: X/Y passed (Z% coverage)
- E2E Tests: X/Y passed
- Build: PASS/FAIL
- TypeScript: PASS/FAIL
- Lint: PASS/FAIL

/compact
```

---

### Phase 4: Decision & Report

#### Step 4.1: Compile Findings

Categorize all findings:

| Severity | Description | Action |
|----------|-------------|--------|
| 🔴 Critical | Security vulnerabilities, data loss risk | MUST fix before release |
| 🟠 Major | Functional bugs, performance issues | Should fix before release |
| 🟡 Minor | Code style, minor improvements | Can fix later |

#### Step 4.2: Make Decision

**If PASS (No Critical/Major issues):**
- Status: ✅ APPROVED FOR PRODUCTION

**If FAIL (Critical/Major issues exist):**
- Status: ❌ NEEDS FIXES
- Return to Team Lead for fixes

#### Step 4.3: Create QA Report

Create report in `docs/reports/` with format `yyyyMMddHHmm-{module}-qa-report.md`:

```markdown
# QA Review Report

## Module: [Module Name]
## Reviewer: QA Lead
## Date: [Date]

---

## Summary

| Metric | Status |
|--------|--------|
| Requirements | ✅ Met / ❌ Not Met |
| Code Quality | ✅ Good / ⚠️ Needs Work |
| Security | ✅ Passed / ❌ Failed |
| Performance | ✅ Acceptable / ⚠️ Needs Optimization |
| Test Coverage | X% |

---

## Test Results

### Unit Tests
- Total: X | Passed: Y | Failed: Z
- Coverage: X%

### E2E Tests
- Total: X | Passed: Y | Failed: Z

### Build & Lint
- Build: ✅ PASS / ❌ FAIL
- TypeScript: ✅ PASS / ❌ FAIL
- Lint: ✅ PASS / ❌ FAIL

---

## Findings

### 🔴 Critical Issues
1. [Issue description] - [File/Location]
   - Impact: [description]
   - Recommendation: [fix suggestion]

### 🟠 Major Issues
1. [Issue description] - [File/Location]

### 🟡 Minor Issues
1. [Issue description] - [File/Location]

---

## Security Checklist

- [ ] Authentication properly implemented
- [ ] Authorization checks in place
- [ ] Input validation on all endpoints
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Sensitive data encrypted

---

## Decision

**Status**: ✅ APPROVED FOR PRODUCTION / ❌ NEEDS FIXES

### If Approved:
- Module is ready for deployment

### If Rejected:
- Command: `/project:execute {todolist}` to fix issues
```

---

## Quick Reference: Context Management

```
🚀 Phase 0: Smoke Test (MANDATORY) - npm run dev must work!
📋 Preparation (2-3 agents) → /compact
🔍 Code Quality (3 agents) → /compact
🔒 Security (2-3 agents) → /compact
🧪 Tests → /compact
✅ Decision & Report
```

### Common Runtime Errors to Check

| Error | Cause | Fix |
|-------|-------|-----|
| `Nest can't resolve dependencies` | Missing module import | Add module to `imports: []` |
| `Cannot find module` | Missing npm package | Run `npm install` |
| `ECONNREFUSED` | Database not running | Start PostgreSQL |

---

## After Review

### If Approved:
1. ✅ QA report created in `docs/reports/`
2. ✅ Module marked as complete
3. 📋 Ready for deployment

### If Rejected:
1. ❌ QA report with issues created
2. 📋 Return to `/project:execute {todolist}` for fixes
3. 🔄 Re-run `/project:qa-review {module}` after fixes
