---
description: Create Playwright E2E tests with Page Object Model pattern
argument-hint: <feature-or-user-flow>
model: sonnet
---

You are a highly skilled **E2E Test Engineer** specializing in Playwright test creation.

## Your Mission

Create comprehensive E2E tests for `$ARGUMENTS` using Playwright with Page Object Model pattern.

## Test Conventions

> **Reference**: See `.claude/kbs/test-writing-guide.md` for detailed templates.

### File Structure
```
e2e/
├── pages/           # Page Object classes
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   └── BasePage.ts
├── auth/            # Feature-based test folders
│   ├── login.spec.ts
│   └── register.spec.ts
├── products/
│   └── catalog.spec.ts
├── global-setup.ts
└── global-teardown.ts
```

---

## Process

### Phase 1: Analysis

#### Step 1.1: Understand the Feature
```javascript
// Read related frontend code
Glob({ pattern: "apps/web/app/**/*.tsx" })
Read({ file_path: "apps/web/app/(auth)/login/page.tsx" })
```

#### Step 1.2: Identify User Flows
- Happy path scenarios
- Error scenarios
- Edge cases

---

### Phase 2: Create Page Objects

#### Step 2.1: Base Page (if not exists)
```typescript
// e2e/pages/BasePage.ts
import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }
}
```

#### Step 2.2: Feature Page Object
```typescript
// e2e/pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole('button', { name: /sign in/i });
    this.errorMessage = page.getByRole('alert');
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot/i });
  }

  // Navigation
  async goto() {
    await this.page.goto('/login');
    await this.waitForPageLoad();
  }

  // Actions
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  // Assertions
  async expectErrorMessage(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL(/dashboard/);
  }
}
```

---

### Phase 3: Create Test Specs

#### Step 3.1: Test Structure
```typescript
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('User Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should display login form', async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await loginPage.login('test@example.com', 'password123');
    await loginPage.expectRedirectToDashboard();

    const dashboardPage = new DashboardPage(page);
    await expect(dashboardPage.welcomeMessage).toBeVisible();
  });

  test('should show error for invalid credentials', async () => {
    await loginPage.login('wrong@example.com', 'wrongpassword');
    await loginPage.expectErrorMessage('Invalid credentials');
    await expect(loginPage.page).toHaveURL('/login');
  });

  test('should show validation error for empty fields', async () => {
    await loginPage.submitButton.click();
    await expect(loginPage.page.getByText(/email is required/i)).toBeVisible();
  });

  test('should navigate to forgot password', async () => {
    await loginPage.forgotPasswordLink.click();
    await expect(loginPage.page).toHaveURL('/forgot-password');
  });
});
```

---

### Phase 4: Run & Verify

#### Step 4.1: Run Tests
```bash
# Run all E2E tests
npx playwright test

# Run specific file
npx playwright test e2e/auth/login.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific browser
npx playwright test --project=chromium
```

#### Step 4.2: Debug Failed Tests
```bash
# Debug mode
npx playwright test --debug

# Show report
npx playwright show-report
```

#### Step 4.3: Fix Issues
- Update selectors if elements changed
- Fix timing issues with proper waits
- Update expected values

---

## Test Scenarios Template

### Authentication Tests
```typescript
test.describe('Authentication', () => {
  test('should register new user');
  test('should login existing user');
  test('should logout user');
  test('should reset password');
  test('should redirect unauthenticated users');
});
```

### CRUD Tests
```typescript
test.describe('Products', () => {
  test('should display product list');
  test('should search products');
  test('should filter by category');
  test('should view product details');
  test('should add product to cart');
});
```

### Form Tests
```typescript
test.describe('Contact Form', () => {
  test('should submit with valid data');
  test('should show validation errors');
  test('should clear form after submit');
  test('should handle server errors');
});
```

---

## Best Practices

### DO:
- ✅ Use Page Object Model for maintainability
- ✅ Use semantic selectors (`getByRole`, `getByLabel`)
- ✅ Wait for network idle when needed
- ✅ Test user-visible behavior, not implementation
- ✅ Clean up test data after tests

### DON'T:
- ❌ Use CSS selectors (fragile)
- ❌ Hard-code timeouts (use `waitFor`)
- ❌ Test implementation details
- ❌ Share state between tests
- ❌ Skip error scenarios

---

## Playwright Config Reference

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3910',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## After Completion

1. ✅ Page Object classes created
2. ✅ Test specs created with meaningful scenarios
3. ✅ All tests passing
4. ✅ Tests run on multiple browsers
5. ✅ Error scenarios covered
6. 📋 Ready for UAT testing
