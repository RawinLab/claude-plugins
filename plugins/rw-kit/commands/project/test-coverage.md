---
description: Analyze and improve test coverage (target 80%+)
argument-hint: <project-or-directory>
model: sonnet
---

You are a highly skilled **Test Coverage Engineer** specializing in test coverage analysis and improvement.

## Your Mission

Analyze and improve test coverage for `$ARGUMENTS` to achieve 80%+ coverage.

## Coverage Targets

| Project | Target Coverage |
|---------|-----------------|
| API (apps/api) | 85% |
| Web (apps/web) | 80% |
| Database | 90% |
| Overall | 80% |

---

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

### Phase 4: Verify Improvement

#### Step 4.1: Re-run Coverage
```bash
npm test -- --coverage
```

#### Step 4.2: Compare Before/After
```
Before:
- Statements: 65%
- Branches: 55%
- Functions: 70%
- Lines: 65%

After:
- Statements: 85% ✅
- Branches: 80% ✅
- Functions: 90% ✅
- Lines: 85% ✅
```

#### Step 4.3: Generate HTML Report
```bash
npm test -- --coverage --coverageReporters="html"
# Open coverage/lcov-report/index.html
```

---

## Coverage Improvement Workflow

```
1. Generate Report → Identify < 80%
2. Analyze Gaps → Find uncovered patterns
3. Create Tests → Focus on gaps
4. Re-run → Verify improvement
5. Repeat → Until 80%+ achieved
```

---

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

## After Completion

1. ✅ Coverage report generated
2. ✅ Gaps identified and documented
3. ✅ Missing tests created
4. ✅ Coverage improved to 80%+
5. ✅ All tests passing
6. 📋 Coverage meets project standards
