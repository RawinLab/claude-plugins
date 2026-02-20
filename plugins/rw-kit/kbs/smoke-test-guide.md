# Smoke Test Guide

> **Single source of truth** for smoke test procedures. All commands and agents should reference this file instead of duplicating smoke test instructions.

## Why Smoke Test Matters

| Check Type | What It Catches | What It Misses |
|------------|-----------------|----------------|
| `npm run build` | TypeScript errors, syntax | Runtime DI errors |
| Unit Tests | Business logic bugs | Module wiring issues |
| **Smoke Test** | **Runtime startup errors** | Deep business logic |

> **Build passing ≠ Application working.** Always run smoke test FIRST.

---

## Smoke Test Procedure

### Step 1: Start Dev Servers

```bash
npm run dev &
sleep 15
```

### Step 2: Verify API

```bash
curl -f http://localhost:{API_PORT}/api/health || echo "API FAILED"
```

Look for: "Nest application successfully started"
Watch for: "Nest can't resolve dependencies"

### Step 3: Verify Frontend

```bash
curl -f -o /dev/null http://localhost:{WEB_PORT} || echo "FRONTEND FAILED"
```

### Step 4: Decision

- **If ANY check fails**: STOP. Fix runtime errors before proceeding.
- **If ALL checks pass**: Continue to next phase.

---

## Common Runtime Errors & Auto-Fix

| Error Pattern | Root Cause | Auto-Fix Action |
|---------------|-----------|-----------------|
| `Nest can't resolve dependencies of X (?, Y)` | Module not imported | Add missing module to `imports: []` |
| `Cannot find module` | Missing npm package | Run `npm install` |
| `ECONNREFUSED :5432` | Database not running | **STOP** - cannot auto-fix |
| `Module not found` | Wrong import path | Fix import path |
| Build type errors | TypeScript issues | Fix TS errors |
| Lint errors | Code style | Run `npx eslint --fix src/` |

### NestJS DI Error Fix Pattern

When you see:
```
Nest can't resolve dependencies of the XGuard (Reflector, ?).
Please make sure that the argument YService at index [1] is available in the ZModule context.
```

Fix:
```typescript
@Module({
  imports: [
    ModuleContainingYService,  // Add this
  ],
})
export class ZModule {}
```

---

## Retry Limits

| Scope | Max Retries | On Exhaust |
|-------|-------------|------------|
| Smoke test auto-fix | 2 | DEGRADED |
