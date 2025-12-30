# Test Writing Guide for Agents

> **Reference**: This guide is for agents writing tests. Follow these conventions strictly.

## Overview

Testing strategy:
- **Unit Tests**: Jest (80%+ coverage required)
- **E2E Tests**: Playwright (cross-browser testing)

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

## E2E Testing (Playwright)

### File Structure

```
e2e/
  auth/
    login.spec.ts
    register.spec.ts
  products/
    catalog.spec.ts
    search.spec.ts
  checkout/
    cart.spec.ts
    payment.spec.ts
  global-setup.ts
  global-teardown.ts
```

### E2E Test Template
```typescript
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill form
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');

    // Submit
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('should show validation error for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('should redirect authenticated user to dashboard', async ({ page, context }) => {
    // Set auth token
    await context.addCookies([{
      name: 'auth_token',
      value: 'valid_token',
      domain: 'localhost',
      path: '/',
    }]);

    await page.goto('/login');
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### Page Object Model (Recommended)
```typescript
// e2e/pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

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
}

// Usage in test
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');

  await expect(page).toHaveURL('/dashboard');
});
```

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

### E2E Tests
```bash
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
| API | 85% |
| Web | 80% |
| Database | 90% |
| Config | 85% |

---

## Best Practices

### DO:
- Use descriptive test names (`should register user with valid data`)
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test edge cases and error scenarios
- Use `beforeEach` for common setup
- Clear mocks in `afterEach`
- Use Page Object Model for E2E tests

### DON'T:
- Test implementation details
- Use real API calls in unit tests
- Share state between tests
- Use hardcoded timeouts (use `waitFor` instead)
- Skip tests without reason
- Write flaky tests

---

## Quick Reference

```bash
# Unit Tests
npm test                              # Run all
npm test -- --coverage               # With coverage
npm test -- --watch                  # Watch mode

# E2E Tests
npx playwright test                  # Run all
npx playwright test --project=chromium  # Specific browser
npx playwright test --headed         # See browser
npx playwright test --debug          # Debug mode
```
