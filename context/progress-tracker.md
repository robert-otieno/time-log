# Time Log — Progress Tracker

Update this file after every completed feature. A new session should be able to identify the current phase, last verified result, next action, and active blockers without reconstructing history from chat.

## Current Status

**Phase:** Phase 0 — Baseline and Framework Gate

**Last completed:** 00 Repository Baseline

**Current:** 01 Next.js 16 Compatibility Gate — automated gate passed; authenticated smoke pending

**Next:** Complete the post-upgrade login/task/logout smoke, then start 02 Firebase Admin Foundation

**Blockers:** None

## Existing Repository Baseline

- [x] Next.js 15 App Router application exists
- [x] React 19, TypeScript strict, Tailwind CSS v4, shadcn/Radix primitives exist
- [x] Firebase client Authentication and Firestore exist
- [x] Google login UI exists
- [x] Logout control exists, but server-session hardening is not complete
- [x] Personal daily tasks, subtasks, priorities, goals, habits, categories, tags, shortcuts, and focus mode exist
- [ ] Collaborative organization/project model exists
- [ ] Firebase Admin server authentication exists
- [ ] Firebase Storage file workflows exist
- [ ] Resend exists

Existing checkmarks describe repository presence, not production readiness for the new architecture.

## Progress

### Phase 0 — Baseline and Framework Gate

- [x] 00 Repository Baseline
- [ ] 01 Next.js 16 Compatibility Gate — automated checks pass; manual smoke pending

### Phase 1 — Authentication First

- [ ] 02 Firebase Admin Foundation
- [ ] 03 Secure Login Session
- [ ] 04 Complete Logout

### Phase 2 — Tenant, Roles, and Onboarding

- [ ] 05 Organization and Membership Schema
- [ ] 06 Audit Event Foundation
- [ ] 07 Personal Organization Bootstrap
- [ ] 08 Personalized Onboarding
- [ ] 09 People, Clients, and Invitations

### Phase 3 — Projects and Visibility

- [ ] 10 Project CRUD and Navigation
- [ ] 11 Visibility Primitive
- [ ] 12 Client Portal Shell

### Phase 4 — To-Dos

- [ ] 13 Project Task Schema and Repository
- [ ] 14 To-Do List UI
- [ ] 15 My Work
- [ ] 16 Legacy Task Migration

### Phase 5 — Time Tracking

- [ ] 17 Active Timer Domain
- [ ] 18 Global Timer UI
- [ ] 19 Stop Timer and Time Entries
- [ ] 20 Time Views and Reports

### Phase 6 — Admin and Email Foundation

- [ ] 21 Admin Console
- [ ] 22 Audit Trail Viewer
- [ ] 23 Resend Outbox and Templates
- [ ] 24 Resend Webhooks and Preferences
- [ ] 25 Scheduled Notifications

### Phase 7 — Storage and Core Collaboration

- [ ] 26 Firebase Storage and File Metadata
- [ ] 27 Message Board
- [ ] 28 Calendar
- [ ] 29 Project Templates

### Phase 8 — Extended Project Tools

- [ ] 30 Card Table
- [ ] 31 Chat
- [ ] 32 Automatic Check-Ins
- [ ] 33 External Links
- [ ] 34 Email Forwards

### Phase 9 — AI Agents and Connectors

- [ ] 35 Agent Registry and Read-Only Runs
- [ ] 36 Approval Inbox
- [ ] 37 Connector Vault and Initial Connectors
- [ ] 38 AI-Assisted Workflows

### Phase 10 — Production Readiness

- [ ] 39 Security and Abuse Review
- [ ] 40 Performance and Observability
- [ ] 41 Accessibility and Responsive QA
- [ ] 42 Release and Migration

## Decisions Made

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-09-16 | Keep Firebase and add Firebase Admin/server sessions | Reuses the existing platform while making team/server workflows secure |
| 2026-09-16 | Target Next.js 16 behind a compatibility gate | Accept the upgrade only when build and smoke tests remain green |
| 2026-09-16 | Clients are restricted project guests | Prevent organization-wide and internal-content access |
| 2026-09-16 | Use explicit `internal` / `client-visible` visibility | Content owners control what clients see; default remains safe |
| 2026-09-16 | Require approval for consequential AI actions | Keep humans accountable for shared/external changes |
| 2026-09-16 | Support live and manual time entries | Covers real workflows while preserving clear source history |
| 2026-09-16 | Require saved tasks for non-admin timers | Users must clearly identify work before tracking time |
| 2026-09-16 | Allow admins to start project-level timers | Supports administrative/unplanned work without weakening member policy |
| 2026-09-16 | Use Resend with a durable outbox | Prevent lost/duplicate email and make delivery observable |
| 2026-09-16 | Add an append-only audit trail for meaningful actions | Provide accountable history across users, admins, system jobs, integrations, and AI without collecting noisy UI telemetry |
| 2026-09-16 | Pin Vitest 4.1.11 for the baseline | Vitest 5 requires Node type definitions newer than the repository's current `@types/node` 20 declaration |

## Active Notes

- The repository was synchronized before implementation began. `AGENTS.md` and current baseline changes are intentionally uncommitted implementation work.
- Existing Firebase data is user-scoped under `users/{uid}`. New collaborative data must use organization/project scope and an explicit migration.
- `docs/feature-upgrade.md` is legacy product guidance, not the source of truth for the new build.

## Session Log

Add concise entries only when implementation work changes status:

```text
YYYY-MM-DD — Feature NN — completed/blocked — verification summary — next action
```

2026-09-16 — Feature 01 — in progress — official Next.js codemod applied; Next.js 16.3.5, React 19.3.0, ESLint CLI, tests, typecheck, lint, and production build verified — run authenticated smoke

2026-09-16 — Feature 00 — completed — tests, typecheck, production build, route availability, login, task create/edit/complete, and logout verified; lint limitation documented — start Feature 01
