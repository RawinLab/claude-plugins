---
name: create-tests
description: Create unit tests (Jest) with high coverage (80%+)
argument-hint: <file-or-directory>
model: sonnet
---

You are a highly skilled **Test Engineer** specializing in unit test creation.

## Your Mission

Create comprehensive **UNIT tests** for `$ARGUMENTS` with 80%+ coverage.

> **Note**: For integration tests with real database, use `/rw-kit:create-integration-tests`

## Test Types Overview

| Type | Database | External Services | Speed | Use Case |
|------|----------|-------------------|-------|----------|
| **Unit** (this command) | Mocked | Mocked | Fast | Business logic, pure functions |
| **Integration** | Real + Seed | Mocked | Medium | Service interactions, DB queries |
| **E2E** | Real + Seed | Real | Slow | Full user flows |

---

## What to Mock vs NOT Mock (CRITICAL)

### MUST Mock (External Dependencies)
| Category | Examples | Why |
|----------|----------|-----|
| External APIs | Payment gateway, Email service | Unreliable, costly |
| Time/Date | `new Date()`, `Date.now()` | Non-deterministic |
| Random | `Math.random()`, UUID generators | Non-deterministic |
| File system | `fs.readFile`, `fs.writeFile` | Side effects |
| Network | `fetch`, `axios` | Slow, unreliable |

### DO NOT Mock (Test the Real Thing)
| Category | Examples | Why |
|----------|----------|-----|
| Business logic | Validation, calculations | Core functionality |
| Pure functions | Formatters, transformers | No side effects |
| Class methods | Service methods being tested | Test target |
| Internal utilities | Helper functions | Part of unit |

### AVOID Over-Mocking
```typescript
// BAD: Mocking the thing you're testing
const mockValidate = jest.fn().mockReturnValue(true);
service.validate = mockValidate;
expect(service.validate(data)).toBe(true); // Useless!

// GOOD: Test real validation logic
expect(service.validate(validData)).toBe(true);
expect(service.validate(invalidData)).toBe(false);
```

---

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
auth.service.spec.ts  <- Test file here
```

---

## Process

### Phase 1: Analysis

#### Step 1.1: Read Target File(s)
```javascript
Read({ file_path: "$ARGUMENTS" })
```

#### Step 1.2: Identify Testable Units
- Pure functions (no external dependencies)
- Business logic methods
- Validation functions
- Data transformation functions
- Edge cases and error scenarios

#### Step 1.3: Identify What Needs Mocking
Only mock:
- Database calls (PrismaService)
- External API calls
- Time-dependent functions

---

### Phase 2: Create Unit Tests

#### For NestJS Services (*.spec.ts)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@{project}/database';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    // Only mock external dependencies (DB, external services)
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
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test REAL business logic, not mocked behavior
  describe('validatePassword', () => {
    it('should return true for valid password', () => {
      // Test REAL validation logic
      expect(service.validatePassword('ValidPass123!')).toBe(true);
    });

    it('should return false for weak password', () => {
      expect(service.validatePassword('weak')).toBe(false);
    });
  });

  // Mock only DB calls, test real logic
  describe('login', () => {
    it('should return token for valid credentials', async () => {
      // Arrange - mock DB response
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword'
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Spy on real password comparison (don't mock it!)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      // Act
      const result = await service.login({
        email: 'test@example.com',
        password: 'password123'
      });

      // Assert
      expect(result.accessToken).toBeDefined();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
    });

    it('should throw for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        password: 'hashedPassword'
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

---

#### For React Components (*.test.tsx)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

// Only mock external API calls
const mockLogin = jest.fn();
jest.mock('@/lib/api', () => ({
  authApi: { login: (...args) => mockLogin(...args) }
}));

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test REAL rendering
  it('renders all form fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  // Test REAL validation (don't mock validation!)
  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled(); // API should not be called
  });

  // Test REAL form submission flow
  it('submits form with valid data', async () => {
    mockLogin.mockResolvedValue({ token: 'abc123' });
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

#### Step 3.3: Review Mock Usage
Check that tests are meaningful:
- [ ] Business logic is tested with REAL code
- [ ] Only external dependencies are mocked
- [ ] Edge cases test REAL behavior

---

## Anti-Patterns to Avoid

### 1. Testing Mock Behavior
```typescript
// BAD - This tests nothing useful
prisma.user.findUnique.mockResolvedValue({ id: '1' });
const result = await service.getUser('1');
expect(result).toEqual({ id: '1' }); // Just testing the mock!

// GOOD - Test real transformation/logic
prisma.user.findUnique.mockResolvedValue({
  id: '1',
  createdAt: new Date('2024-01-01')
});
const result = await service.getUser('1');
expect(result.memberSince).toBe('January 2024'); // Tests real formatting
```

### 2. Mocking Internal Methods
```typescript
// BAD - Don't mock the class you're testing
jest.spyOn(service, 'validateEmail').mockReturnValue(true);

// GOOD - Test the real validation
expect(service.validateEmail('valid@email.com')).toBe(true);
expect(service.validateEmail('invalid')).toBe(false);
```

### 3. 100% Mock Coverage
```typescript
// BAD - Everything is mocked, nothing is tested
const mockService = {
  login: jest.fn().mockResolvedValue({ token: 'x' }),
  validate: jest.fn().mockReturnValue(true),
};

// GOOD - Use real service, mock only DB
const realService = new AuthService(mockPrisma);
```

---

## Best Practices

### DO:
- Test REAL business logic and validation
- Mock only external I/O (database, APIs, filesystem)
- Use descriptive test names (`should reject login with invalid email format`)
- Follow AAA pattern (Arrange, Act, Assert)
- Test edge cases with REAL code paths
- Clear mocks in `afterEach`

### DON'T:
- Mock the service/component you're testing
- Mock validation or business logic
- Test that mocks return what you told them to return
- Use real API calls in unit tests
- Share state between tests

---

## After Completion

1. Test files created following naming convention
2. All tests passing
3. Coverage meets target (80%+)
4. **Verified**: Business logic tested with real code
5. **Verified**: Only external dependencies mocked
6. Ready for integration testing (`/rw-kit:create-integration-tests`)
