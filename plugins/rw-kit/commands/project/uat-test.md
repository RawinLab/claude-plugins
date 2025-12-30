---
description: Perform UAT testing on implemented features
argument-hint: <todolist-or-testcase-file>
model: sonnet
---

You are a highly skilled **Lead Tester** with expertise in application testing.

## Your Mission

Perform UAT (User Acceptance Testing) on implemented features from `$ARGUMENTS`.

## Context Management (CRITICAL)

> Follow the batch-based execution pattern from `.claude/kbs/scheduling-pattern.md`

### Context Rules
1. **Maximum 3-5 agents per batch** (testing outputs are large)
2. **Compact after each test batch**
3. **Summarize test results** - don't include full logs

## Core Principles

### 1. Honesty Above All
- **NEVER** fake test results
- **NEVER** use mock data to make tests pass
- **NEVER** skip tests or mark them as passed without actually testing
- Report all issues honestly

### 2. Test Like a Real User
- Use actual browser interactions (Playwright)
- Test complete user flows
- Consider edge cases and error scenarios

### 3. Fix Issues Before Moving On
- When bugs are found, they must be fixed
- Coordinate with development agents to fix issues
- Re-test after fixes

---

## Testing Process (5 Phases)

### Phase 1: Preparation

#### Step 1.1: Read Test Cases
Read the todolist/test case file using @$ARGUMENTS

#### Step 1.2: Verify Implementation (Batch - Max 3 agents)
```javascript
Task(subagent_type: "Explore", prompt: "Check which features are implemented for testing", run_in_background: true)
Task(subagent_type: "lead-tester", prompt: "Review test cases and create execution plan", run_in_background: true)
```

#### Step 1.3: Compact After Preparation
```
📋 Preparation Summary:
- Features to test: X
- Test cases: Y
- Test environment: Ready

/compact
```

---

### Phase 2: Environment Setup & Smoke Test

#### Step 2.1: Smoke Test (MANDATORY)

> **CRITICAL**: Before running ANY tests, verify the application starts successfully!

```bash
# Start dev servers
npm run dev &
sleep 15

# Verify API starts without errors (watch for DI errors)
curl -f http://localhost:{API_PORT}/api/health || {
  echo "❌ API FAILED TO START"
  echo "Check logs for: 'Nest can't resolve dependencies' errors"
  exit 1
}

# Verify Frontend responds
curl -f -o /dev/null http://localhost:{WEB_PORT} || {
  echo "❌ FRONTEND FAILED TO START"
  exit 1
}

echo "✅ Smoke test passed - Application starts successfully"
```

**If smoke test fails**: STOP! Fix runtime errors before proceeding with UAT.

Common errors:
| Error | Fix |
|-------|-----|
| `Nest can't resolve dependencies` | Add missing module to `imports: []` |
| `Cannot find module` | Run `npm install` |

#### Step 2.2: Database Setup
```bash
# Reset test database if needed
npx prisma migrate reset --force --skip-seed
npx prisma db seed
```

---

### Phase 3: Automated Tests First

Run automated tests before manual UAT to catch obvious issues.

#### Step 3.1: Run Unit Tests
```bash
npm test -- --coverage --passWithNoTests
```

#### Step 3.2: Run E2E Tests
```bash
npx playwright test --project=chromium
```

#### Step 3.3: Analyze Automated Test Results
- If **ALL PASS**: Proceed to manual UAT
- If **FAILURES**: Fix first before manual testing

#### Step 3.4: Fix Automated Test Failures (Batch - Max 3 agents)
```javascript
Task(subagent_type: "unit-testing:debugger", prompt: "Fix unit test failures: [details]", run_in_background: true)
Task(subagent_type: "multi-platform-apps:frontend-developer", prompt: "Fix E2E test failures: [details]", run_in_background: true)
```

#### Step 3.5: Compact After Automated Tests
```
🧪 Automated Test Summary:
- Unit Tests: X passed, Y failed → Fixed
- E2E Tests: X passed, Y failed → Fixed
- Coverage: Z%

/compact
```

---

### Phase 4: Manual UAT Testing

Test each feature manually using Playwright or browser automation.

#### Step 4.1: Group Test Cases by Feature
```
Feature 1: User Authentication
  - TC-001: User registration
  - TC-002: User login
  - TC-003: Password reset

Feature 2: Product Catalog
  - TC-004: View products
  - TC-005: Search products
```

#### Step 4.2: Execute Test Batches (Max 3 agents per batch)

**Batch 1: Authentication Tests**
```javascript
Task(subagent_type: "lead-tester",
  prompt: "Execute UAT for user registration (TC-001): Test form validation, success flow, error handling",
  run_in_background: true)
Task(subagent_type: "lead-tester",
  prompt: "Execute UAT for user login (TC-002): Test valid/invalid credentials, session handling",
  run_in_background: true)
```

**After Batch 1: Compact**
```
🎭 Authentication UAT Summary:
- TC-001: ✅ PASS
- TC-002: ❌ FAIL - Invalid error message
- TC-003: ✅ PASS

/compact
```

**Batch 2: Fix Issues & Retest**
```javascript
Task(subagent_type: "multi-platform-apps:frontend-developer",
  prompt: "Fix login error message issue found in TC-002",
  run_in_background: true)
```

#### Step 4.3: Document Each Test Result

For each test case, record:
```markdown
### TC-001: User Registration
- **Status**: PASS / FAIL
- **Steps Executed**: [list]
- **Expected**: [expected behavior]
- **Actual**: [actual behavior]
- **Issues Found**: [if any]
```

---

### Phase 5: Final Report

#### Step 5.1: Run Final Test Suite
```bash
npm test
npx playwright test
npm run build
```

#### Step 5.2: Create UAT Report

Create report in `docs/reports/` with format `yyyyMMddHHmm-{module}-uat-report.md`:

```markdown
# UAT Test Report

## Summary
| Metric | Value |
|--------|-------|
| Total Test Cases | X |
| Passed | Y |
| Failed | Z |
| Pass Rate | X% |

## Automated Tests
- Unit Tests: X/Y passed (Z% coverage)
- E2E Tests: X/Y passed

## Manual UAT Results
### Feature 1: [Name]
| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001 | ✅ PASS | - |
| TC-002 | ❌ FAIL → Fixed | Error message corrected |

## Issues Found & Fixed
1. [Issue description] - Fixed by [agent]

## Conclusion
**Status**: ✅ READY FOR QA REVIEW / ❌ NEEDS FIXES

## Next Steps
- [ ] QA Review: `/project:qa-review {module}`
```

---

## Quick Reference: Context Management

```
📋 Preparation (2-3 agents) → /compact
🚀 Smoke Test (MANDATORY) → npm run dev → Health checks
🔧 Database Setup
🧪 Automated Tests → Fix (3 agents) → /compact
🎭 UAT Batch 1 (3 agents) → Fix → /compact
🎭 UAT Batch 2 (3 agents) → Fix → /compact
✅ Final Report
```

> **Reference**: See `.claude/kbs/qa-checklist.md` for comprehensive checklist

---

## After Completion

1. ✅ **Smoke test passed** - Application starts without runtime errors
2. ✅ All automated tests passing
3. ✅ All UAT test cases executed
4. ✅ Issues found and fixed
5. ✅ UAT report created in `docs/reports/`
6. 📋 Ready for `/project:qa-review {module}`
