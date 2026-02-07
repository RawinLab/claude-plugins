---
name: test-coverage
description: Analyze and improve test coverage (target 80%+)
argument-hint: <project-or-directory>
model: sonnet
---
name: test-coverage

You are a highly skilled **Test Coverage Engineer** specializing in test coverage analysis and improvement.

## Your Mission

Analyze and improve test coverage for `$ARGUMENTS` to achieve 80%+ coverage.

## Coverage Targets

| Test Level | Target |
|------------|--------|
| API Unit (apps/api) | 85% line coverage |
| Web Unit (apps/web) | 80% line coverage |
| Database | 90% line coverage |
| Overall Unit | 80% line coverage |
| Integration | Key services have `*.integration.spec.ts` |
| E2E | All user stories have corresponding `e2e/**/*.spec.ts` |

---
name: test-coverage

## Process

### Phase 1: Generate Coverage Report

#### Step 1.1: Run Tests with Coverage
```bash
# Full coverage report
npm test -- --coverage

# Specific project
npm test -- --coverage --selectProjects api
npm test -- --coverage --selectProjects web

# Specific directory
npm test -- --coverage --collectCoverageFrom="apps/api/src/auth/**/*.ts"
```

#### Step 1.2: Analyze Report
Coverage report shows:
- **Statements**: Lines of code executed
- **Branches**: Conditional paths (if/else, switch, ternary)
- **Functions**: Functions called
- **Lines**: Physical lines covered

---
name: test-coverage

### Phase 2: Identify Coverage Gaps

#### Step 2.1: Find Uncovered Files
```bash
# List files with low coverage
npm test -- --coverage --coverageReporters="text-summary"
```

Look for:
- Files with < 80% coverage
- Functions with 0% coverage
- Uncovered branches

#### Step 2.2: Common Uncovered Patterns

| Pattern | Where to Find | Test Strategy |
|---------|---------------|---------------|
| Error handlers | `catch` blocks | Mock to throw errors |
| Validation | `if` statements | Test invalid inputs |
| Guard clauses | Early `return` | Test edge cases |
| Default cases | `switch` | Test unexpected values |
| Optional params | `??`, `||` | Test undefined/null |
| Async errors | `try/catch` | Use `.rejects.toThrow()` |

---
name: test-coverage

### Phase 3: Create Missing Tests

> **IMPORTANT**: Follow the scheduling pattern in `.claude/kbs/scheduling-pattern.md`

#### Step 3.1: Launch Test Creation Agents (Parallel)
```javascript
// For each uncovered file
Task({
  subagent_type: "full-stack-orchestration:test-automator",
  prompt: `Create unit tests for uncovered code in: ${file}

Focus on:
- Error handling (catch blocks)
- Validation branches
- Edge cases

---
name: test-coverage
RESPONSE FORMAT (CRITICAL):
When complete, respond with ONLY:
DONE: [1-2 sentence summary]
Files: [test files created]
---`,
  run_in_background: true
})
```

#### Step 3.2: Test Templates for Common Gaps

**Error Handling Tests:**
```typescript
describe('error handling', () => {
  it('should handle database errors', async () => {
    prisma.user.create.mockRejectedValue(new Error('DB Error'));

    await expect(service.createUser(dto))
      .rejects.toThrow('DB Error');
  });

  it('should handle network errors', async () => {
    httpService.get.mockRejectedValue(new Error('Network Error'));

    await expect(service.fetchData())
      .rejects.toThrow('Network Error');
  });
});
```

**Validation Branch Tests:**
```typescript
describe('validation', () => {
  it('should reject empty email', async () => {
    const dto = { email: '', password: 'valid' };

    await expect(service.register(dto))
      .rejects.toThrow(BadRequestException);
  });

  it('should reject weak password', async () => {
    const dto = { email: 'test@test.com', password: '123' };

    await expect(service.register(dto))
      .rejects.toThrow('Password too weak');
  });
});
```

**Guard Clause Tests:**
```typescript
describe('guard clauses', () => {
  it('should return early for null input', async () => {
    const result = await service.process(null);

    expect(result).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should return early for empty array', async () => {
    const result = await service.processMany([]);

    expect(result).toEqual([]);
  });
});
```

**Default Case Tests:**
```typescript
describe('switch defaults', () => {
  it('should handle unknown status', () => {
    const result = service.getStatusLabel('unknown');

    expect(result).toBe('Unknown');
  });
});
```

---
name: test-coverage

### Phase 3.5: Integration Test Coverage (NEW)

> **NEW in v2.2**: Check integration test coverage alongside unit coverage.

#### Step 3.5.1: Check Integration Tests Exist
```javascript
// Find integration test files
Glob({ pattern: "**/*.integration.spec.ts" })
```

#### Step 3.5.2: Map Services to Integration Tests

| Service | Integration Test | Status |
|---------|-----------------|--------|
| AuthService | `auth.integration.spec.ts` | ✅ / ❌ |
| UserService | `user.integration.spec.ts` | ✅ / ❌ |
| ProductService | `product.integration.spec.ts` | ✅ / ❌ |

**If missing**: Create integration tests with `/rw-kit:create-integration-tests`

#### Step 3.5.3: Run Integration Tests
```bash
npm run db:seed:test && npm test -- --testPathPattern="integration.spec"
```

---
name: test-coverage

### Phase 3.6: E2E User Story Coverage (NEW)

> **NEW in v2.2**: Verify all user stories have E2E tests.

#### Step 3.6.1: Extract User Stories
```javascript
// Read requirement/plan files
Glob({ pattern: "requirements/*.md" })
Glob({ pattern: "plans/*-plan.md" })
// Extract user stories (patterns: "As a...", "US-XXX:")
```

#### Step 3.6.2: Map User Stories to E2E Tests
```javascript
// List E2E test files
Glob({ pattern: "e2e/**/*.spec.ts" })
```

**Coverage Report:**
```markdown
| User Story | E2E Test File | Status |
|------------|---------------|--------|
| US-001: User login | e2e/auth/login.spec.ts | ✅ Covered |
| US-002: User register | e2e/auth/register.spec.ts | ✅ Covered |
| US-003: View products | (none) | ❌ MISSING |

E2E User Story Coverage: 2/3 (67%) → Target: 100%
```

**If gaps found**: Create E2E tests with `/rw-kit:create-e2e`

#### Step 3.6.3: Verify E2E Tests Use Seed Data
```bash
# Check E2E tests import TEST_USERS (good) vs hardcoded credentials (bad)
grep -r "TEST_USERS" e2e/ --include="*.spec.ts" | wc -l
grep -r "password123" e2e/ --include="*.spec.ts" | wc -l  # Should be 0
```

---
name: test-coverage

### Phase 4: Verify Improvement

#### Step 4.1: Re-run All Coverage
```bash
# Unit coverage
npm test -- --coverage

# Integration tests
npm run db:seed:test && npm test -- --testPathPattern="integration.spec"

# E2E tests
npm run db:seed:test && npx playwright test --project=chromium
```

#### Step 4.2: Compare Before/After
```
Unit Coverage:
  Before: Statements 65%, Branches 55%, Functions 70%, Lines 65%
  After:  Statements 85%, Branches 80%, Functions 90%, Lines 85% ✅

Integration Coverage:
  Before: 0 services covered
  After:  5 key services have integration tests ✅

E2E User Story Coverage:
  Before: 2/5 user stories (40%)
  After:  5/5 user stories (100%) ✅
```

#### Step 4.3: Generate HTML Report
```bash
npm test -- --coverage --coverageReporters="html"
# Open coverage/lcov-report/index.html
```

---
name: test-coverage

## Coverage Improvement Workflow

```
1. Generate Unit Report → Identify < 80%
2. Analyze Gaps → Find uncovered patterns
3. Create Unit Tests → Focus on gaps
4. Check Integration Coverage → Key services have *.integration.spec.ts
5. Check E2E Coverage → All user stories have e2e/**/*.spec.ts
6. Re-run All → Verify improvement
7. Repeat → Until all targets achieved
```

---
name: test-coverage

## Quick Commands

```bash
# Full coverage report
npm test -- --coverage

# Text summary only
npm test -- --coverage --coverageReporters="text-summary"

# HTML report
npm test -- --coverage --coverageReporters="html"

# Specific files
npm test -- --coverage --collectCoverageFrom="src/auth/**/*.ts"

# Watch mode with coverage
npm test -- --coverage --watch

# Fail if below threshold
npm test -- --coverage --coverageThreshold='{"global":{"lines":80}}'
```

---
name: test-coverage

## Jest Config for Coverage

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.module.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};
```

---
name: test-coverage

## After Completion

1. ✅ Unit coverage report generated (80%+)
2. ✅ Integration test coverage checked (key services covered)
3. ✅ E2E user story coverage checked (all stories have tests)
4. ✅ Gaps identified and documented
5. ✅ Missing tests created
6. ✅ All tests passing
7. 📋 Coverage meets project standards
