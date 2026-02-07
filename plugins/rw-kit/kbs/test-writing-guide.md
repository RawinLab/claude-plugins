# Test Writing Guide for Agents

> **Reference**: This guide is for agents writing tests. Follow these conventions strictly.

## Overview

Testing strategy:
- **Unit Tests**: Jest (80%+ coverage required)
- **Integration Tests**: Jest + Real Database (seed data, no mocking)
- **E2E Tests**: Playwright (user story-driven, seed data)

---

## Unit Testing (Jest)

### File Structure

```
apps/
  api/
    src/
      auth/
        auth.service.ts
        auth.service.spec.ts     ← Unit test file
        auth.controller.ts
        auth.controller.spec.ts  ← Unit test file
  web/
    src/
      components/
        auth/
          LoginForm.tsx
          LoginForm.test.tsx     ← Unit test file
```

### Naming Convention

| App | Test File Pattern | Example |
|-----|-------------------|---------|
| API (NestJS) | `*.spec.ts` | `auth.service.spec.ts` |
| Web (Next.js) | `*.test.tsx` | `LoginForm.test.tsx` |

---

### API Unit Tests (NestJS)

#### Controller Test Template
```typescript
// apps/api/src/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      validateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const registerDto = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      };
      const expectedResult = { id: '1', email: registerDto.email };
      authService.register.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.register(registerDto);

      // Assert
      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for invalid email', async () => {
      // Arrange
      const registerDto = { email: 'invalid', password: 'test', name: 'Test' };
      authService.register.mockRejectedValue(new BadRequestException('Invalid email'));

      // Act & Assert
      await expect(controller.register(registerDto))
        .rejects.toThrow(BadRequestException);
    });
  });
});
```

#### Service Test Template
```typescript
// apps/api/src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@project/database';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      // Arrange
      const dto = { email: 'test@example.com', password: 'password', name: 'Test' };
      const hashedPassword = 'hashed_password';
      const createdUser = { id: '1', ...dto, password: hashedPassword };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createdUser);

      // Act
      const result = await service.register(dto);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { ...dto, password: hashedPassword },
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw ConflictException if email exists', async () => {
      // Arrange
      const dto = { email: 'existing@example.com', password: 'test', name: 'Test' };
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: dto.email });

      // Act & Assert
      await expect(service.register(dto))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

---

### Frontend Unit Tests (React/Next.js)

#### Component Test Template
```typescript
// apps/web/src/components/auth/LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';
import { useAuthStore } from '@/store/auth-store';

// Mock the store
jest.mock('@/store/auth-store');

describe('LoginForm', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form correctly', () => {
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

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('displays loading state during submission', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: true,
      error: null,
    });

    render(<LoginForm />);

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('displays error message on login failure', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: 'Invalid credentials',
    });

    render(<LoginForm />);

    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

#### Hook Test Template
```typescript
// apps/web/src/hooks/useProducts.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useProducts } from './useProducts';
import { api } from '@/lib/api';

jest.mock('@/lib/api');

describe('useProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches products successfully', async () => {
    const mockProducts = [
      { id: '1', name: 'Product 1' },
      { id: '2', name: 'Product 2' },
    ];
    (api.products.list as jest.Mock).mockResolvedValue(mockProducts);

    const { result } = renderHook(() => useProducts());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.products).toEqual(mockProducts);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    const error = new Error('Network error');
    (api.products.list as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.products).toEqual([]);
  });
});
```

---

## Integration Testing (Jest + Real Database)

### File Structure

```
apps/
  api/
    src/
      auth/
        auth.service.ts
        auth.service.spec.ts            ← Unit test (mocked)
        auth.service.integration.spec.ts ← Integration test (real DB)
      products/
        products.service.integration.spec.ts
```

### Naming Convention

| Test Type | File Pattern | Example |
|-----------|-------------|---------|
| Integration | `*.integration.spec.ts` | `auth.service.integration.spec.ts` |

### When to Use Integration Tests

- Testing database operations (CRUD) with real Prisma queries
- Testing service methods that involve multiple database tables
- Testing transactions, cascading deletes, unique constraints
- Testing seed data is correctly structured

### Integration Test Template

```typescript
// apps/api/src/auth/auth.service.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@project/database';
import { TEST_USERS, seedTestDatabase, cleanupTestDatabase } from '../../../prisma/seed-test';

describe('AuthService (Integration)', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, PrismaService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    // Seed the database with known test data
    await seedTestDatabase(prisma);
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
    await prisma.$disconnect();
  });

  describe('login', () => {
    it('should authenticate with seeded test user credentials', async () => {
      const result = await service.login({
        email: TEST_USERS.standard.email,
        password: TEST_USERS.standard.password,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe(TEST_USERS.standard.email);
    });

    it('should reject invalid password for seeded user', async () => {
      await expect(
        service.login({
          email: TEST_USERS.standard.email,
          password: 'wrong-password',
        }),
      ).rejects.toThrow();
    });
  });

  describe('register', () => {
    it('should reject duplicate email from seed data', async () => {
      await expect(
        service.register({
          email: TEST_USERS.standard.email,
          password: 'NewPassword123!',
          name: 'Duplicate User',
        }),
      ).rejects.toThrow();
    });

    it('should create user and persist to real database', async () => {
      const newUser = await service.register({
        email: 'integration-test@example.com',
        password: 'IntegrationTest123!',
        name: 'Integration Test User',
      });

      // Verify in database
      const dbUser = await prisma.user.findUnique({
        where: { email: 'integration-test@example.com' },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.name).toBe('Integration Test User');
    });
  });
});
```

### Setup/Teardown Patterns

```typescript
// Pattern 1: beforeAll/afterAll for read-heavy tests
beforeAll(async () => { await seedTestDatabase(prisma); });
afterAll(async () => { await cleanupTestDatabase(prisma); });

// Pattern 2: beforeEach/afterEach for write-heavy tests (each test gets clean state)
beforeEach(async () => { await seedTestDatabase(prisma); });
afterEach(async () => { await cleanupTestDatabase(prisma); });

// Pattern 3: Transaction rollback (fastest, no cleanup needed)
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});
afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

### Running Integration Tests

```bash
# Run integration tests only
npm test -- --testPathPattern="integration.spec"

# Run with test database
DATABASE_URL="postgresql://test:test@localhost:5432/testdb" npm test -- --testPathPattern="integration.spec"
```

---

## Seed Data Guide

### Purpose

Seed data provides **predictable, known test data** that enables:
- Integration tests to query real data without mocking
- E2E tests to log in with known credentials
- UAT testing with realistic scenarios

### Seed File Location

```
prisma/
  seed.ts           ← Production seed (optional)
  seed-test.ts      ← Test seed data (REQUIRED for testing)
```

### Seed Data Design Principles

1. **Predictable IDs**: Use known IDs (e.g., `test-user-001`) so tests can reference them
2. **Known Credentials**: Passwords that tests can use without discovery
3. **Edge Cases**: Include empty states, expired data, boundary values
4. **Role Coverage**: Users for each role (admin, user, viewer)
5. **Relationship Coverage**: Related data (user → orders → items)
6. **Idempotent**: Running seed twice produces same state (use upsert)

### Seed Data Constants

```typescript
// prisma/seed-test.ts

// ─── Test User Constants ──────────────────────────────
export const TEST_USERS = {
  standard: {
    id: 'test-user-001',
    email: 'test@example.com',
    password: 'Test123!@#',        // Plain text (for test login)
    name: 'Test User',
    role: 'USER',
  },
  admin: {
    id: 'test-admin-001',
    email: 'admin@example.com',
    password: 'Admin123!@#',
    name: 'Admin User',
    role: 'ADMIN',
  },
  empty: {
    id: 'test-empty-001',
    email: 'empty@example.com',
    password: 'Empty123!@#',
    name: 'Empty User',
    role: 'USER',
  },
} as const;

// ─── Test Data Constants ──────────────────────────────
export const TEST_PRODUCTS = {
  active: {
    id: 'test-product-001',
    name: 'Test Product',
    price: 29.99,
    status: 'ACTIVE',
  },
  outOfStock: {
    id: 'test-product-002',
    name: 'Out of Stock Product',
    price: 49.99,
    status: 'OUT_OF_STOCK',
  },
} as const;

// ─── Seed Function ────────────────────────────────────
export async function seedTestDatabase(prisma: PrismaService) {
  // Users (upsert for idempotency)
  for (const user of Object.values(TEST_USERS)) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        password: hashedPassword,
        name: user.name,
        role: user.role,
      },
    });
  }

  // Products
  for (const product of Object.values(TEST_PRODUCTS)) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    });
  }
}

// ─── Cleanup Function ─────────────────────────────────
export async function cleanupTestDatabase(prisma: PrismaService) {
  // Delete in reverse dependency order
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
}
```

### Using Seed Data in Tests

```typescript
// Integration test
import { TEST_USERS, seedTestDatabase } from '../../../prisma/seed-test';

it('should find user by email', async () => {
  const user = await service.findByEmail(TEST_USERS.standard.email);
  expect(user).not.toBeNull();
  expect(user!.name).toBe(TEST_USERS.standard.name);
});
```

```typescript
// E2E test
import { TEST_USERS } from '../../prisma/seed-test';

test('should login with seed user', async ({ page }) => {
  await loginPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
  await expect(page).toHaveURL('/dashboard');
});
```

### Seed Data Commands

```bash
# Seed test database
npx ts-node prisma/seed-test.ts

# Or via package.json script
npm run db:seed:test

# Reset + seed (clean slate)
npx prisma migrate reset --force --skip-seed && npm run db:seed:test
```

---

## User Story → E2E Test Mapping

### Concept

Every user story in requirements should have a corresponding E2E test that **proves the story works** with real data. This creates traceability from requirement → test.

### Mapping Convention

| User Story | E2E Test File | Test Scenarios |
|------------|---------------|----------------|
| US-001: User can login | `e2e/auth/login.spec.ts` | valid login, invalid password, empty fields |
| US-002: User can register | `e2e/auth/register.spec.ts` | valid registration, duplicate email, weak password |
| US-003: User can view products | `e2e/products/catalog.spec.ts` | product list, pagination, empty state |
| US-004: User can search products | `e2e/products/search.spec.ts` | keyword search, no results, filters |

### File Naming Convention

```
e2e/{feature}/{story-keyword}.spec.ts
```

Examples:
- `e2e/auth/login.spec.ts` → US about logging in
- `e2e/auth/register.spec.ts` → US about registration
- `e2e/products/catalog.spec.ts` → US about viewing products
- `e2e/checkout/payment.spec.ts` → US about making payments

### Template: Converting User Story to E2E Test

**User Story**: "As a user, I want to login so that I can access my dashboard"

```typescript
// e2e/auth/login.spec.ts
// Maps to: US-001 - User can login
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TEST_USERS } from '../../prisma/seed-test';

test.describe('US-001: User Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  // Happy path: proves the user story works
  test('should login with valid credentials and reach dashboard', async ({ page }) => {
    await loginPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });

  // Error path: validates error handling
  test('should show error for invalid credentials', async () => {
    await loginPage.login(TEST_USERS.standard.email, 'wrong-password');
    await loginPage.expectErrorMessage('Invalid credentials');
  });

  // Edge case: empty form submission
  test('should show validation errors for empty fields', async () => {
    await loginPage.submitButton.click();
    await expect(loginPage.page.getByText(/email is required/i)).toBeVisible();
  });
});
```

### Traceability Check

After writing E2E tests, verify coverage:
1. Read requirement file → extract all user stories
2. List all `e2e/**/*.spec.ts` files
3. Check each user story has at least one test file
4. Report any gaps

---

## E2E Testing (Playwright)

### File Structure

```
e2e/
  pages/            # Page Object classes
    BasePage.ts
    LoginPage.ts
    DashboardPage.ts
  fixtures/         # Shared test fixtures
    auth.fixture.ts
  auth/             # Feature-based test folders (mapped to user stories)
    login.spec.ts
    register.spec.ts
  products/
    catalog.spec.ts
    search.spec.ts
  global-setup.ts   # Seeds database before all E2E tests
  global-teardown.ts # Cleans up after all E2E tests
```

### Global Setup (Seed Data)

```typescript
// e2e/global-setup.ts
import { PrismaClient } from '@prisma/client';
import { seedTestDatabase, TEST_USERS } from '../prisma/seed-test';

async function globalSetup() {
  const prisma = new PrismaClient();

  try {
    // Seed database with known test data
    await seedTestDatabase(prisma);
    console.log('✅ Test database seeded');

    // Verify health endpoints
    const apiResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:3910'}/api/health`);
    if (!apiResponse.ok) throw new Error('API health check failed');
    console.log('✅ API health check passed');
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
```

### Global Teardown

```typescript
// e2e/global-teardown.ts
import { PrismaClient } from '@prisma/client';
import { cleanupTestDatabase } from '../prisma/seed-test';

async function globalTeardown() {
  const prisma = new PrismaClient();

  try {
    await cleanupTestDatabase(prisma);
    console.log('✅ Test database cleaned up');
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
```

### Playwright Config with Seed Data

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3910',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3910',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Template (with Seed Data)

```typescript
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TEST_USERS } from '../../prisma/seed-test';

test.describe('User Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should login with valid seed credentials', async ({ page }) => {
    await loginPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should show error for invalid credentials', async () => {
    await loginPage.login('wrong@example.com', 'wrongpassword');
    await loginPage.expectErrorMessage('Invalid credentials');
  });

  test('should show validation error for empty fields', async () => {
    await loginPage.submitButton.click();
    await expect(loginPage.page.getByText(/email is required/i)).toBeVisible();
  });
});
```

### Page Object Model (with Seed Data)

```typescript
// e2e/pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole('button', { name: /sign in/i });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectErrorMessage(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}
```

### Test Data Reference (Which Seed User for Which Scenario)

| Scenario | Seed User | Why |
|----------|-----------|-----|
| Normal login/dashboard | `TEST_USERS.standard` | Has complete profile and related data |
| Admin features | `TEST_USERS.admin` | Has ADMIN role permissions |
| Empty states | `TEST_USERS.empty` | No orders/products, tests empty UI |
| Product browsing | Any user | Products seeded via `TEST_PRODUCTS` |
| Permission denied | `TEST_USERS.standard` accessing admin routes | Verifies RBAC |

---

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific project
npm test -- --selectProjects api
npm test -- --selectProjects web

# Run specific file
npm test -- apps/api/src/auth/auth.service.spec.ts

# Watch mode
npm test -- --watch
```

### Integration Tests
```bash
# Run integration tests only
npm test -- --testPathPattern="integration.spec"

# Run with test database URL
DATABASE_URL="postgresql://test:test@localhost:5432/testdb" npm test -- --testPathPattern="integration.spec"

# Seed + run integration tests
npm run db:seed:test && npm test -- --testPathPattern="integration.spec"
```

### E2E Tests
```bash
# Seed database first, then run E2E
npm run db:seed:test && npx playwright test

# Run all E2E tests
npx playwright test

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run specific file
npx playwright test e2e/auth/login.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

---

## Coverage Requirements

| Project | Minimum Coverage |
|---------|------------------|
| API (Unit) | 85% |
| API (Integration) | Key services covered |
| Web | 80% |
| Database | 90% |
| Config | 85% |
| E2E | All user stories have tests |

---

## Best Practices

### DO:
- Use descriptive test names (`should register user with valid data`)
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies in **unit tests only**
- Use real database with seed data in **integration tests**
- Use seed data credentials in **E2E tests** (import `TEST_USERS`)
- Map each user story to at least one E2E test file
- Test edge cases and error scenarios
- Use `beforeEach` for common setup
- Clear mocks in `afterEach`
- Use Page Object Model for E2E tests

### DON'T:
- Test implementation details
- Use real API calls in unit tests
- Hardcode credentials in E2E tests (use `TEST_USERS` from seed data)
- Share state between tests
- Use hardcoded timeouts (use `waitFor` instead)
- Skip tests without reason
- Write flaky tests
- Mock the database in integration tests

---

## Quick Reference

```bash
# Unit Tests
npm test                              # Run all
npm test -- --coverage               # With coverage
npm test -- --watch                  # Watch mode

# Integration Tests
npm run db:seed:test                 # Seed test DB
npm test -- --testPathPattern="integration.spec"  # Run integration

# E2E Tests (seed data required)
npm run db:seed:test                 # Seed before E2E
npx playwright test                  # Run all
npx playwright test --project=chromium  # Specific browser
npx playwright test --headed         # See browser
npx playwright test --debug          # Debug mode

# Full Test Pipeline
npm run db:seed:test && npm test -- --coverage && npx playwright test
```
