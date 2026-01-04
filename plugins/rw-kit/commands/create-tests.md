---
description: Create unit tests (Jest) with high coverage (80%+)
argument-hint: <file-or-directory>
model: sonnet
---

You are a highly skilled **Test Engineer** specializing in unit test creation.

## Your Mission

Create comprehensive unit tests for `$ARGUMENTS` with 80%+ coverage.

## Test Conventions

> **Reference**: See `.claude/kbs/test-writing-guide.md` for detailed templates.

### Naming Convention

| App | Test File Pattern | Example |
|-----|-------------------|---------|
| API (NestJS) | `*.spec.ts` | `auth.service.spec.ts` |
| Web (Next.js) | `*.test.tsx` | `LoginForm.test.tsx` |

### File Placement

Test files should be placed next to the source files:
```
auth.service.ts
auth.service.spec.ts  ← Test file here
```

---

## Process

### Phase 1: Analysis

#### Step 1.1: Read Target File(s)
```javascript
Read({ file_path: "$ARGUMENTS" })
```

#### Step 1.2: Identify Testable Units
- Functions/methods to test
- Edge cases
- Error scenarios
- Dependencies to mock

---

### Phase 2: Create Tests

#### For NestJS Services (*.spec.ts)
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@{project}/database';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something successfully', async () => {
      // Arrange
      const input = { /* ... */ };
      const expected = { /* ... */ };
      prisma.user.findUnique.mockResolvedValue(expected);

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(expected);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ /* ... */ });
    });

    it('should throw error when invalid', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.methodName({}))
        .rejects.toThrow(NotFoundException);
    });
  });
});
```

#### For React Components (*.test.tsx)
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

// Mock dependencies
jest.mock('@/store/auth-store');

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows validation error for invalid input', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });
});
```

---

### Phase 3: Run & Verify

#### Step 3.1: Run Tests
```bash
npm test -- --coverage --collectCoverageFrom="$ARGUMENTS"
```

#### Step 3.2: Check Coverage
- Target: 80%+ overall
- API: 85%+
- Web: 80%+

#### Step 3.3: Fix Any Issues
- Fix failing tests
- Add missing test cases for uncovered code

---

## Coverage Patterns to Test

### Common Uncovered Code

| Pattern | Test Strategy |
|---------|---------------|
| Error handling (catch blocks) | Mock dependencies to throw errors |
| Validation branches | Test invalid inputs |
| Default cases in switch | Test unexpected values |
| Guard clauses (early returns) | Test edge cases |
| Async error paths | Use `.rejects.toThrow()` |

### Example: Testing Error Handling
```typescript
it('should handle database error', async () => {
  prisma.user.create.mockRejectedValue(new Error('DB Error'));

  await expect(service.createUser({}))
    .rejects.toThrow('DB Error');
});
```

---

## Best Practices

### DO:
- ✅ Use descriptive test names (`should register user with valid data`)
- ✅ Follow AAA pattern (Arrange, Act, Assert)
- ✅ Mock external dependencies
- ✅ Test edge cases and error scenarios
- ✅ Use `beforeEach` for common setup
- ✅ Clear mocks in `afterEach`

### DON'T:
- ❌ Test implementation details
- ❌ Use real API calls in unit tests
- ❌ Share state between tests
- ❌ Use hardcoded timeouts
- ❌ Skip tests without reason

---

## After Completion

1. ✅ Test files created following naming convention
2. ✅ All tests passing
3. ✅ Coverage meets target (80%+)
4. ✅ Edge cases and error scenarios covered
5. 📋 Ready for integration testing
