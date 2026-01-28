---
name: create-integration-tests
description: Create integration tests with real database and seed data
argument-hint: <service-or-module>
model: sonnet
---
name: create-integration-tests

You are a highly skilled **Test Engineer** specializing in integration testing.

## Your Mission

Create **INTEGRATION tests** for `$ARGUMENTS` using real database with seed data.

> **Key Difference from Unit Tests**: Integration tests use REAL database connections and seed data. No mocking of database or internal services.

## Integration Test Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                  Integration Test Scope                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Real Database          Real Services        Mock Only      │
│   ─────────────          ─────────────        ─────────      │
│   ✅ Prisma queries      ✅ AuthService       ❌ External    │
│   ✅ Transactions        ✅ UserService          APIs        │
│   ✅ Constraints         ✅ Validation        ❌ Email       │
│   ✅ Seed data           ✅ Business logic    ❌ Payment     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---
name: create-integration-tests

## Test Database Setup

### Required Structure

```
prisma/
├── schema.prisma           # Main schema
├── seed.ts                 # Production seed
├── seed-test.ts            # Test seed data (REQUIRED)
└── fixtures/
    ├── users.ts            # Test users
    ├── products.ts         # Test products
    └── index.ts            # Export all fixtures
```

### Test Seed Data Requirements

Create `prisma/seed-test.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const TEST_USERS = {
  // Standard test user
  standard: {
    id: 'test-user-001',
    email: 'test@example.com',
    password: 'Test123!@#',  // Plain text for tests
    hashedPassword: '',      // Will be set below
    name: 'Test User',
  },
  // Admin user
  admin: {
    id: 'test-admin-001',
    email: 'admin@example.com',
    password: 'Admin123!@#',
    hashedPassword: '',
    name: 'Admin User',
    role: 'ADMIN',
  },
  // User with no data (edge case)
  empty: {
    id: 'test-empty-001',
    email: 'empty@example.com',
    password: 'Empty123!@#',
    hashedPassword: '',
    name: 'Empty User',
  },
};

async function main() {
  console.log('🌱 Seeding test database...');

  // Hash passwords
  for (const user of Object.values(TEST_USERS)) {
    user.hashedPassword = await bcrypt.hash(user.password, 10);
  }

  // Clean existing data
  await prisma.user.deleteMany();

  // Create test users
  for (const user of Object.values(TEST_USERS)) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password: user.hashedPassword,
        name: user.name,
        role: user.role || 'USER',
      },
    });
  }

  console.log('✅ Test seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

// Export for use in tests
export { TEST_USERS };
```

---
name: create-integration-tests

## Package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "db:reset:test": "DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate reset --force --skip-seed",
    "db:seed:test": "DATABASE_URL=$TEST_DATABASE_URL npx prisma db seed -- --environment test",
    "test:integration": "DATABASE_URL=$TEST_DATABASE_URL jest --config jest.integration.config.js",
    "test:integration:watch": "DATABASE_URL=$TEST_DATABASE_URL jest --config jest.integration.config.js --watch"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### Environment Setup

Create `.env.test`:
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/myapp_test"
# Or use SQLite for simpler setup:
# DATABASE_URL="file:./test.db"
```

---
name: create-integration-tests

## Process

### Phase 1: Verify Test Infrastructure

#### Step 1.1: Check Seed Data Exists
```javascript
// Verify seed-test.ts exists
Read({ file_path: "prisma/seed-test.ts" })
```

If not exists, CREATE IT following the template above.

#### Step 1.2: Check Test Database Config
```javascript
Read({ file_path: ".env.test" })
Read({ file_path: "package.json" }) // Check for test scripts
```

#### Step 1.3: Verify Fixtures Export Test Data
```javascript
// Test files should be able to import seed data
Read({ file_path: "prisma/fixtures/index.ts" })
```

---
name: create-integration-tests

### Phase 2: Create Integration Test File

#### Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Service Integration | `*.integration.spec.ts` | `auth.integration.spec.ts` |
| API Integration | `*.e2e-spec.ts` | `auth.e2e-spec.ts` |

#### File Placement

```
src/
├── auth/
│   ├── auth.service.ts
│   ├── auth.service.spec.ts         # Unit test (mocked)
│   └── auth.integration.spec.ts     # Integration test (real DB)
```

---
name: create-integration-tests

### Phase 3: Write Integration Tests

#### Template: Service Integration Test

```typescript
// auth.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@{project}/database';
import { AuthService } from './auth.service';
import { AuthModule } from './auth.module';
import { TEST_USERS } from '../../prisma/seed-test';

describe('AuthService (Integration)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset to seed state before each test
    await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;
    // Re-seed test data
    await seedTestUsers(prisma);
  });

  describe('login', () => {
    it('should login with seeded test user', async () => {
      // Use REAL seed data - no mocks!
      const result = await authService.login({
        email: TEST_USERS.standard.email,
        password: TEST_USERS.standard.password,  // Plain text password
      });

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(TEST_USERS.standard.email);
    });

    it('should reject invalid password', async () => {
      await expect(
        authService.login({
          email: TEST_USERS.standard.email,
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('register', () => {
    it('should create new user in database', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'NewUser123!',
        name: 'New User',
      };

      const result = await authService.register(newUser);

      // Verify in REAL database
      const dbUser = await prisma.user.findUnique({
        where: { email: newUser.email },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser.email).toBe(newUser.email);
      expect(result.accessToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await expect(
        authService.register({
          email: TEST_USERS.standard.email,  // Already exists in seed
          password: 'AnyPass123!',
          name: 'Duplicate',
        })
      ).rejects.toThrow('Email already exists');
    });
  });
});

// Helper to re-seed users
async function seedTestUsers(prisma: PrismaService) {
  const bcrypt = require('bcrypt');
  for (const user of Object.values(TEST_USERS)) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password: await bcrypt.hash(user.password, 10),
        name: user.name,
      },
    });
  }
}
```

---
name: create-integration-tests

#### Template: API Integration Test (E2E)

```typescript
// auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TEST_USERS } from '../prisma/seed-test';

describe('AuthController (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset database to seed state
    await resetToSeedState(prisma);
  });

  describe('POST /auth/login', () => {
    it('should return token for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: TEST_USERS.standard.email,
          password: TEST_USERS.standard.password,
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe(TEST_USERS.standard.email);
    });

    it('should return 401 for invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: TEST_USERS.standard.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('POST /auth/register', () => {
    it('should create user and return token', async () => {
      const newUser = {
        email: 'integration-test@example.com',
        password: 'IntegrationTest123!',
        name: 'Integration Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body.accessToken).toBeDefined();

      // Verify in database
      const dbUser = await prisma.user.findUnique({
        where: { email: newUser.email },
      });
      expect(dbUser).toBeDefined();
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: TEST_USERS.standard.email,
          password: 'AnyPass123!',
          name: 'Duplicate User',
        })
        .expect(409);
    });
  });
});
```

---
name: create-integration-tests

### Phase 4: Run Tests

#### Step 4.1: Setup Test Database
```bash
# Create/reset test database
npm run db:reset:test

# Seed test data
npm run db:seed:test
```

#### Step 4.2: Run Integration Tests
```bash
npm run test:integration
```

#### Step 4.3: Verify Results
- All tests should pass with REAL database
- No mocks should be used for database operations
- Seed data should be used consistently

---
name: create-integration-tests

## Seed Data Design Principles

### 1. Predictable IDs
```typescript
// Use fixed IDs for easy reference
const TEST_USERS = {
  standard: { id: 'test-user-001', ... },
  admin: { id: 'test-admin-001', ... },
};
```

### 2. Known Credentials
```typescript
// Store plain text passwords for test assertions
standard: {
  email: 'test@example.com',
  password: 'Test123!@#',  // Use this in tests
  hashedPassword: '',      // Computed at seed time
}
```

### 3. Edge Cases as Seed Data
```typescript
// Include edge case users
empty: {        // User with no orders, posts, etc.
  id: 'test-empty-001',
  ...
},
suspended: {    // User in error state
  id: 'test-suspended-001',
  status: 'SUSPENDED',
  ...
},
```

### 4. Relational Data
```typescript
// Seed related data together
const TEST_ORDERS = {
  completed: {
    id: 'test-order-001',
    userId: TEST_USERS.standard.id,  // Reference user
    status: 'COMPLETED',
  },
};
```

---
name: create-integration-tests

## Best Practices

### DO:
- Use REAL database connection
- Import and use seed data constants
- Reset database state before each test
- Test actual database constraints (unique, foreign keys)
- Verify data in database after operations

### DON'T:
- Mock PrismaService or database calls
- Use random data that changes between runs
- Leave test data that affects other tests
- Skip database verification

---
name: create-integration-tests

## Checklist Before Completion

1. **Seed Data**
   - [ ] `prisma/seed-test.ts` exists with test data
   - [ ] Test credentials are documented
   - [ ] Edge case data is included

2. **Test Infrastructure**
   - [ ] `.env.test` has test database URL
   - [ ] `package.json` has test scripts
   - [ ] Jest config for integration tests exists

3. **Tests**
   - [ ] Tests use imported seed data constants
   - [ ] No mocking of database/internal services
   - [ ] Database state reset between tests
   - [ ] All tests pass with real database

4. **Documentation**
   - [ ] Test data documented in README or fixtures
   - [ ] How to run integration tests documented

---
name: create-integration-tests

## After Completion

1. Seed data file created/updated (`prisma/seed-test.ts`)
2. Test database scripts added to `package.json`
3. Integration tests created using real database
4. All tests passing with `npm run test:integration`
5. Ready for E2E testing (`/rw-kit:create-e2e`)
