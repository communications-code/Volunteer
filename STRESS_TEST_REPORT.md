# Stress Test Report - Serving Network

Date: 2026-02-15 (EST)
Tester: Codex
Scope: Stress and reliability testing of app behavior excluding intentional email sends.

## Safety / Scope Notes
- I did **not** call endpoints intended to send real emails (`/api/contact`, `/api/email/test`, successful `/api/pledges` flows).
- I focused on public API reliability, auth edge behavior, and runtime resilience under DB/connectivity failure.

## Test Matrix

### 1) Live Vercel endpoint checks (non-email)
Target: `https://servingnetwork.vercel.app`

- Baseline burst:
  - `/api/needs` x60: `200=60`, avg `0.164s`
  - `/api/categories` x60: `200=1`, `403=59`, avg `0.122s`
  - `/api/user` x40: `403=40`, avg `0.124s`
  - `/api/login` x40 invalid creds: `403=40`, avg `0.118s`
- Concurrent stress:
  - `/api/needs` x300 (parallel 25): `403=300`, avg `0.146s`

Observed headers on blocked responses:
- `x-vercel-mitigated: challenge`
- `x-vercel-challenge-token: ...`
- Body: **Vercel Security Checkpoint** HTML (not JSON)

### 2) Runtime resilience simulation (local)

Simulated unstable DB connectivity with an invalid DB host and started the production server build.

Result:
- First `GET /api/needs` timed out (`status=000`)
- Server process exited within ~7s
- Crash stack showed unhandled async error:
  - `Error: getaddrinfo ENOTFOUND ...`
  - `node:internal/process/promises: triggerUncaughtException`

## What Is Not Functioning As Expected

### Finding A - Requests can be blocked by Vercel security challenge under load patterns
Severity: High (availability)

Symptoms:
- API starts returning HTML challenge pages with `403` instead of API JSON.
- Any client expecting JSON can fail hard or show generic load errors.

Why this is likely happening:
- Vercel bot/abuse mitigation is being triggered for this traffic pattern.
- The app/client has no explicit handling for challenge HTML responses.

Evidence:
- Repeated responses include `x-vercel-mitigated: challenge`.
- `/api/needs` changed from `200` responses to `403 challenge` under stress.

### Finding B - Startup DB failure can crash the whole process (likely source of intermittent needs-load failures)
Severity: Critical (process crash)

Symptoms:
- `/api/needs` can stall/time out during startup and then app process dies.

Why this is likely happening:
- `DatabaseStorage` constructor kicks off async `initializeAdminUser()` without `await`/`catch`.
- Any DB DNS/connection error in that async path becomes an unhandled rejection and can terminate the process.

Evidence:
- Local runtime simulation reproduced process death from startup DB lookup failure.

Code references:
- `server/storage.ts:44`
- `server/storage.ts:52`
- `server/storage.ts:55`
- `server/storage.ts:285`

### Finding C - Startup path does extra DB work that increases cold-start fragility
Severity: High (latency/reliability risk)

Symptoms:
- Increased chance of transient startup failures under cold starts.

Why this is likely happening:
- Session store enables `createTableIfMissing: true` on startup.
- Startup also performs admin existence check every process start.
- In serverless, this can add DB round trips/DDL pressure during cold starts.

Code references:
- `server/storage.ts:46`
- `server/storage.ts:48`
- `server/storage.ts:52`
- `server/storage.ts:57`

### Finding D - Pledge status logic appears inconsistent for GROUP needs
Severity: Medium (functional correctness)

Symptoms:
- GROUP needs may be marked `PLEDGED` too early (first pledge), even if slots remain.

Why this is likely happening:
- `storage.createPledge()` already has GROUP-specific status logic.
- Route handler then unconditionally sets `PLEDGED` for originally `FLOATING` needs.

Code references:
- `server/storage.ts:247`
- `server/storage.ts:259`
- `server/routes.ts:580`
- `server/routes.ts:582`

### Finding E - Update route computes fallback status but does not use it
Severity: Low/Medium (state drift risk)

Symptoms:
- Editing a need can unintentionally drift status behavior depending on payload shape.

Why this is likely happening:
- Route computes `status` fallback but does not pass/use it in update call.

Code references:
- `server/routes.ts:493`
- `server/routes.ts:496`
- `server/storage.ts:187`

## Most Likely Cause Of Your Intermittent "Error Loading Needs"

Top likely causes (in order):
1. **Process-level crash on startup DB hiccup** from unhandled async initialization (`initializeAdminUser`) causing intermittent downtime for `/api/needs`.
2. **Platform challenge responses** (`403` HTML checkpoint) being surfaced in client as generic API failure.
3. Cold-start DB overhead from session table creation + startup admin query increasing failure window.

## Raw Evidence Summary
- `/api/needs` initially healthy (`200 x60`) then challenge-blocked under sustained request pattern (`403 x300`).
- Challenge responses explicitly labeled by Vercel headers.
- Controlled local run confirmed startup DB failure can crash process and make `/api/needs` unavailable.

