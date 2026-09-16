# Repository Baseline

Captured on 2026-09-16 before the Time Log implementation begins.

## Runtime and Toolchain

| Item | Baseline |
| --- | --- |
| Node.js | 24.16.0 locally; project minimum is 20.9.0 to support the planned Next.js 16 gate |
| npm | 11.13.0 |
| Next.js | 15.4.6 |
| React / React DOM | 19.1.0 |
| TypeScript | 5.x with `strict: true` |
| Firebase web SDK | 12.1.0 |
| Firebase Admin SDK | 13.5.0 |
| Tailwind CSS | 4.x |
| Test runner | Vitest 4.1.11, Node environment |

## Required Development Configuration

The existing application expects these browser-visible Firebase variables:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

The preliminary server Firebase Admin implementation currently expects:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

If service-account variables are absent it falls back to Application Default Credentials. Phase 02 will replace this with validated server-only environment configuration and align names with `context/code-standards.md`.

Never record environment values, tokens, or credentials in this file.

## Existing Product Behavior to Preserve During Migration

- Firebase Google sign-in presents `/login` and redirects authenticated users to the requested internal path or `/`.
- A client-side auth guard redirects signed-out users away from application routes.
- Logout signs out the Firebase browser client, clears the legacy `token` cookie, and returns to `/login`.
- Users can create, edit, complete, reopen, and delete personal daily tasks and subtasks.
- Users can select a date and carry incomplete tasks forward.
- Weekly priorities, goals, habits, categories, tags, keyboard shortcuts, focus mode, and nudge routes exist.
- Date-only values use `YYYY-MM-DD` and must not shift because of timezone conversion.

This is a behavioral baseline, not approval of the current security model. Phase 02–04 replaces browser-only protection and the script-readable token cookie with verified server sessions.

## Automated Baseline Checks

```text
npm run test
npm run typecheck
npm run build
```

The initial unit suite locks down date-only formatting, week ranges, and legacy habit schedule interpretation. Authentication and Firestore mutation behavior require emulator/integration and end-to-end coverage in later foundation features.

Baseline results captured on 2026-09-16:

| Check | Result |
| --- | --- |
| `npm run test` | Pass — 2 files, 7 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass — production compilation, type validation, page generation, and trace collection completed |
| `npm run lint` | Known baseline failure — opens interactive Next.js ESLint setup because no ESLint configuration exists |
| Production route probe | Pass for availability — `/login` and `/` both return HTTP 200 on the local production server |

## Known Pre-Existing Issues

- `npm run lint` uses `next lint`. This remains a known baseline limitation and will be replaced with ESLint CLI during Feature 01 because Next.js 16 removes `next lint`.
- Authentication protection is client-side. A preliminary bearer-token verifier exists but no secure httpOnly session exchange is wired into login/logout.
- The unauthenticated `/` route returns the application shell from the server and relies on the client guard to redirect after hydration. Treat this as a security baseline issue for Features 02–04.
- The login redirect accepts the raw `next` query value and must be restricted to safe internal paths.
- Product naming still says “Visio Genesis” in the login page, header, and metadata.
- The root layout applies `text-xs` globally; the UI context marks this pattern for retirement.
- Existing Firestore collections are user-scoped legacy data and are not the future organization/project model.
- There were no automated tests before this baseline.
- A fully authenticated Google/task/logout browser smoke test is manual until the E2E harness and Firebase test environment are introduced.

## Manual Smoke Checklist

Run against a non-production Firebase project:

1. Open `/login`; confirm the Google sign-in action is available.
2. Sign in; confirm redirect to `/` or a safe internal `next` path.
3. Create a daily task, edit its title and metadata, complete it, and reopen it.
4. Add and toggle a subtask.
5. Change the selected date and confirm the expected task list loads.
6. Sign out; confirm `/login` appears and protected content is no longer usable.

Record the date and result here when this checklist is executed manually.

**Last manual run:** Not yet recorded.
