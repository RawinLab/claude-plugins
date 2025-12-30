# QA Checklist - Comprehensive Quality Assurance Guide

> **Purpose**: This checklist ensures no critical issues slip through QA review.
> The key lesson: **Build passing ≠ Application working**

---

## Phase 0: Smoke Test (MANDATORY)

> **CRITICAL**: Do this FIRST before any other QA checks!

### Why Smoke Test Matters

| Check Type | What It Catches | What It Misses |
|------------|-----------------|----------------|
| `npm run build` | TypeScript errors, syntax | Runtime DI errors |
| Unit Tests | Business logic bugs | Module wiring issues |
| Smoke Test | **Runtime startup errors** | Deep business logic |

### Smoke Test Checklist

```bash
# 1. Start the application
npm run dev

# 2. Wait for startup (watch logs)
# ✅ Look for: "Nest application successfully started"
# ❌ Watch for: "Nest can't resolve dependencies"

# 3. Test health endpoints
curl -f http://localhost:{API_PORT}/api/health  # API
curl -f http://localhost:{WEB_PORT}             # Frontend

# 4. Check for common errors in console
```

### Common Runtime Errors

| Error Message | Root Cause | Solution |
|--------------|------------|----------|
| `Nest can't resolve dependencies of X (?, Y)` | Module not imported | Add missing module to `imports: []` |
| `Cannot read property of undefined` | Missing provider | Add provider to `providers: []` |
| `ECONNREFUSED :5432` | Database not running | Start PostgreSQL |
| `Cannot find module '@/...'` | Path alias issue | Check tsconfig paths |
| `Module build failed` | Webpack/Next.js error | Check import statements |

### NestJS Dependency Injection Errors

When you see:
```
Nest can't resolve dependencies of the XGuard (Reflector, ?).
Please make sure that the argument YService at index [1] is available in the ZModule context.
```

**Fix Pattern**:
```typescript
// In ZModule
@Module({
  imports: [
    ModuleContainingYService,  // ← Add this!
  ],
  controllers: [ZController],
  providers: [ZService],
})
export class ZModule {}
```

**Common Cases**:
- `PermissionsGuard` needs `RbacModule` imported
- `JwtAuthGuard` needs `AuthModule` imported
- Custom guards need their service modules imported

---

## Phase 1: Build Verification

### Build Checklist

- [ ] `npm run build` passes without errors
- [ ] `npm run typecheck` passes (if separate)
- [ ] No TypeScript errors in watch mode
- [ ] All packages in monorepo build successfully

### What Build Catches

- TypeScript type errors
- Missing imports (compile-time)
- Syntax errors
- Missing dependencies (compile-time)

### What Build DOESN'T Catch

- Runtime dependency injection errors
- Missing module imports in NestJS
- Database connection issues
- Environment variable issues
- Race conditions

---

## Phase 2: Test Verification

### Unit Tests

```bash
npm test -- --coverage
```

- [ ] All tests pass
- [ ] Coverage > 80% (API: 85%, Web: 80%)
- [ ] No skipped tests without reason
- [ ] Tests are meaningful (not just for coverage)

### E2E Tests

```bash
npx playwright test
```

- [ ] All E2E tests pass
- [ ] Critical user flows covered
- [ ] Error states tested

### Integration Tests

- [ ] API endpoints return expected responses
- [ ] Database operations work correctly
- [ ] Authentication flow works end-to-end

---

## Phase 3: Code Quality

### Code Review Checklist

- [ ] Follows project coding standards
- [ ] No duplicate code
- [ ] Proper error handling
- [ ] TypeScript strict mode compliance
- [ ] No `any` types without justification
- [ ] Consistent naming conventions

### Security Checklist

- [ ] Input validation on all endpoints
- [ ] Authentication properly implemented
- [ ] Authorization checks in place
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] No hardcoded secrets
- [ ] Sensitive data not logged

### Performance Checklist

- [ ] No N+1 database queries
- [ ] Appropriate database indexes
- [ ] No memory leaks
- [ ] Efficient algorithms
- [ ] Pagination for large datasets

---

## Phase 4: Integration Verification

### API Integration

- [ ] All endpoints documented in Swagger
- [ ] Request/Response DTOs validated
- [ ] Error responses follow standard format
- [ ] Rate limiting configured

### Frontend Integration

- [ ] API calls use correct endpoints
- [ ] Loading states handled
- [ ] Error states displayed
- [ ] Forms validate input

### Database Integration

- [ ] Migrations up to date
- [ ] Seed data works
- [ ] Foreign keys correct
- [ ] Indexes optimized

---

## QA Decision Matrix

| Smoke Test | Build | Tests | Decision |
|------------|-------|-------|----------|
| Fail | - | - | **REJECT** - Fix runtime errors first |
| Pass | Fail | - | **REJECT** - Fix build errors |
| Pass | Pass | Fail | **CONDITIONAL** - Assess test failures |
| Pass | Pass | Pass | **REVIEW** - Check code quality |

---

## Quick Commands Reference

```bash
# Smoke Test
npm run dev                              # Start dev servers
curl http://localhost:{API_PORT}/api/health    # Check API
curl http://localhost:{WEB_PORT}               # Check Frontend

# Build
npm run build                            # Production build
npm run typecheck                        # Type check only

# Tests
npm test                                 # Unit tests
npm test -- --coverage                   # With coverage
npx playwright test                      # E2E tests

# Lint
npm run lint                             # ESLint
npm run format                           # Prettier
```

---

## Post-QA Actions

### If APPROVED

1. Create QA report in `docs/reports/`
2. Update module status to "Complete"
3. Prepare for deployment

### If REJECTED

1. Document all issues with file locations
2. Prioritize: Critical > Major > Minor
3. Return to development for fixes
4. Schedule re-review after fixes

---

## Lessons Learned

### Why This Checklist Exists

**Incident**: Module was approved after:
- Build passed
- Unit tests passed
- TypeScript compiled

**But**: `npm run dev` failed with:
```
Nest can't resolve dependencies of the PermissionsGuard
```

**Root Cause**: A module didn't import `RbacModule`, but used `PermissionsGuard` which depends on `RbacService`.

**Lesson**:
> **Build ≠ Runtime**
> Always run `npm run dev` as the FIRST QA step!
