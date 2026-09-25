# Time Log — Build Plan

## Core Principle

Build the smallest secure vertical slice first: authenticate, create a project task, start a compliant timer, stop it, and log out. Every later tool reuses the same tenant, role, visibility, audit, notification, and project-navigation primitives.

Do not build all project tools in parallel. Complete and verify each numbered feature before moving its checkbox in `progress-tracker.md`.

## Phase 0 — Baseline and Framework Gate

### 00 Repository Baseline

- Record current Node/npm versions and environment requirements.
- Run the existing build and smoke-test Google login, task create/edit/complete, and logout.
- Add test coverage around the behavior that must survive migration.
- Document known pre-existing issues rather than folding them into unrelated features.

**Done when:** a reproducible baseline exists and regressions can be distinguished from old defects.

### 01 Next.js 16 Compatibility Gate

- Require Node 20.9 or newer.
- Use the official Next.js upgrade codemod.
- Update Next.js, React, React DOM, React type packages, and scripts together.
- Replace the removed `next lint` workflow with ESLint CLI configuration.
- Resolve App Router, async request API, Turbopack, and dependency issues.
- Run build and the Phase 0 smoke tests.
- If the gate cannot pass without broad unrelated rewrites, revert only upgrade-specific changes and continue P0 on Next.js 15.

**Done when:** Next.js 16 build and smoke tests pass, or a documented fallback decision is recorded.

## Phase 1 — Authentication First

### 02 Firebase Admin Foundation

- Add validated server-only environment configuration.
- Initialize Firebase Admin exactly once in server modules.
- Add helpers to verify ID/session tokens and return a typed actor.
- Remove server authorization paths that depend on browser `clientAuth.currentUser`.

### 03 Secure Login Session

- Keep Google sign-in initially.
- Exchange a fresh Firebase ID token for an httpOnly, secure, sameSite cookie.
- Add protected route handling and safe redirect validation.
- Make authentication loading, failure, retry, and signed-in states explicit.

### 04 Complete Logout

- Add a server logout endpoint/action that clears the session cookie.
- Sign out the Firebase browser client and reset user-scoped state.
- Redirect to `/login`; back navigation and direct protected URLs must not restore access.
- Add an end-to-end login/logout test.

**Phase exit:** protected server operations identify the actor securely, and login/logout work reliably.

## Phase 2 — Tenant, Roles, and Onboarding

### 05 Organization and Membership Schema

- Create organization, member, client, invitation, and project-assignment records, with project-level member/admin authority separate from organization roles.
- Add role/capability policy helpers.
- Write Firestore rules and emulator tests for admin, member, client, suspended, and unassigned cases.

### 06 Audit Event Foundation

- Define the versioned audit schema, canonical action naming, actor types, outcomes, target references, and redaction allowlists.
- Add a request/run correlation ID to interactive requests, cron jobs, webhooks, connectors, and AI runs.
- Add transactional audit writes to domain mutations and server-only writes for denied/failed actions.
- Make the audit collection create-only for trusted server code and test that browser clients cannot create, update, or delete it.
- Cover login/logout, invitation, role, project, visibility, task, timer, time-entry correction, file access, notification, approval, connector, and AI action categories.

### 07 Personal Organization Bootstrap

- On first authenticated use, idempotently create a personal organization and admin membership.
- Store active organization selection without trusting it for authorization.
- Preserve a path to migration of existing user-scoped data.

### 08 Personalized Onboarding

- Capture name, timezone, working hours, and email preferences.
- Allow organization naming and first project creation.
- Finish with create-task and timer education.
- Make every step resumable and idempotent.

### 09 People, Clients, and Invitations

- Organization admin creates invitations for organization admin, project admin, member, or client access; project-admin invitations require explicit projects.
- Send invitations through the Resend outbox.
- Accept invitations only for the intended authenticated email/account.
- Add suspend/remove flows with audit events.

**Phase exit:** organizations have enforceable membership and a first-run path.

## Phase 3 — Projects and Visibility

### 10 Project CRUD and Navigation

- Add projects index, create/edit/archive, project switcher, and enabled-tools configuration.
- Build a project shell used by every tool.
- Enforce project membership in server code and rules.

### 11 Visibility Primitive

- Add reusable `VisibilityControl`, badge, policy helper, and query filters.
- Default all supported records to `internal`.
- Add visibility audit events and client-safe serialization.
- Test that internal records do not leak through direct URL, search, counts, files, or email.

### 12 Client Portal Shell

- Show assigned projects only.
- Render only enabled tools that have client-visible content.
- Remove internal navigation and management actions.
- Add role-switching test fixtures for admin/member/client.

**Phase exit:** a client can enter one assigned project without learning anything internal.

## Phase 4 — To-Dos (P0)

### 13 Project Task Schema and Repository

- Add project tasks with assignees, status, priority, due date, visibility, order, and audit fields.
- Validate all commands with Zod.
- Add project-scoped indexes and repository tests.

### 14 To-Do List UI

- Add create, inline edit, complete/reopen, archive, filters, empty/loading/error states, and optimistic updates with rollback.
- Keep active work primary while retaining completed and archived work in independent, collapsed lifecycle sections with filtered counts.
- Reuse accessible shadcn primitives and existing keyboard conventions where appropriate.
- Ensure visibility and assignment are clear without making rows noisy.

### 15 My Work

- Aggregate tasks assigned to the current user across accessible projects.
- Group by overdue, today, upcoming, and no due date.
- Provide fast project/task selection for timer start.

### 16 Legacy Task Migration

- Build an idempotent migration into a user-selected project.
- Map supported fields and preserve source IDs in migration metadata.
- Reconcile before/after counts and report unmapped fields.

**Phase exit:** internal users can plan and assign real project work; client visibility is enforced.

## Phase 5 — Time Tracking (P0)

### 17 Active Timer Domain

- Implement one-active-timer-per-user transaction.
- Require a saved task for non-admins; allow task creation inline before start.
- Permit admins to start at project level, while recommending a task.
- Calculate elapsed display from the server start time.

### 18 Global Timer UI

- Add persistent timer control in authenticated layout.
- Survive navigation, refresh, and a second tab.
- Handle start conflicts, deleted/archived tasks, lost network, and expired sessions.

### 19 Stop Timer and Time Entries

- Convert active timer to an entry transactionally.
- Add notes, billable flag, and client-reporting status.
- Support manual entries and audited corrections.
- Never allow the browser to author authoritative duration without server validation.

### 20 Time Views and Reports

- Add personal day/week views and project summaries.
- Filter by user, task, date, billable, and client-reporting status.
- Add client-safe report preview before share/export.

**Phase exit:** task-linked time is reliable across tabs and reportable without leaking internal entries.

## Phase 6 — Admin and Email Foundation

### 21 Admin Console

- Manage people, organization roles, project-admin/member assignments, clients, projects, and organization settings.
- Show destructive action confirmations and audit history.
- Prevent removal of the last active organization admin.

### 22 Audit Trail Viewer

- Add an admin-only organization activity page with filters for time, actor, action, outcome, project, and target.
- Add project activity views filtered through the viewer's project/content permissions.
- Show human-readable summaries backed by canonical action codes, with correlation details available for support.
- Add cursor pagination and guarded CSV/JSON export; exporting the audit trail is itself audited.
- Do not expose the internal audit viewer to clients in the initial release.

### 23 Resend Outbox and Templates

- Add server-only Resend client, typed email categories, recipient resolution, and branded templates.
- Claim pending messages, use deterministic idempotency keys, and store provider IDs.
- Build invitation, assignment, mention, reminder, announcement, and digest templates.

### 24 Resend Webhooks and Preferences

- Verify webhook signatures, deduplicate events, tolerate out-of-order delivery, and update status.
- Add per-user timezone and category preferences.
- Suppress unauthorized, disabled, or obsolete messages immediately before sending.

### 25 Scheduled Notifications

- Add authenticated cron routes for reminders, daily summaries, check-ins, and retries.
- Record job runs, cursors, failures, and counts.
- Make schedules timezone-aware and idempotent.

**Phase exit:** essential transactional email is observable, retry-safe, and access-aware.

## Phase 7 — Storage and Core Collaboration

### 26 Firebase Storage and File Metadata

- Add private tenant/project paths, metadata records, upload constraints, signed/authenticated download, and Storage Rules tests.
- Add file visibility independent of the parent record.
- **Paused:** implementation is retained but application access is disabled until the Firebase project is upgraded to a plan that permits Cloud Storage.

### 27 Message Board

- Add durable posts, comments, attachments, visibility, pinning, and announcement email.

### 28 Calendar

- Add events, milestones, deadlines, participants, reminders, and visibility.
- Show task due dates without duplicating task ownership.

### 29 Project Templates

- Add versioned templates for enabled tools, starter tasks/columns, milestones, check-ins, and visibility defaults.
- Applying a template copies a snapshot to the project.

**Phase exit:** teams can share project knowledge, announcements, dates, and reusable setup.

## Phase 8 — Extended Project Tools

### 30 Card Table

- Add configurable columns and drag/reorder for the same task records used in lists.

### 31 Chat

- Add separate internal and client-visible rooms, realtime messages, mentions, retention controls, and pagination.

### 32 Automatic Check-Ins

- Add schedules, questions, recipients, response windows, reminders, structured responses, and visibility.

### 33 External Links

- Add labeled URLs, descriptions, categories, ordering, safe URL validation, and visibility.

### 34 Email Forwards

- Provision a project-specific inbound address through a selected inbound-email provider.
- Verify inbound signatures, store raw message metadata safely, scan attachments, and create an internal review item.
- Do not assume Resend outbound email alone provides the complete inbound workflow; verify provider capability at implementation time.

## Phase 9 — AI Agents and Connectors

### 35 Agent Registry and Read-Only Runs

- Add agent definitions, project scope, allowed tools, structured outputs, run logs, cost/usage metadata, and rate limits.
- Start with read-only summaries and drafting.

### 36 Approval Inbox

- Convert consequential tool calls into expiring approval requests.
- Display exact proposed effects and normalized arguments.
- Re-authorize on approval and execute once.

### 37 Connector Vault and Initial Connectors

- Encrypt credentials, minimize OAuth scopes, support revoke/refresh, and show connection health.
- Choose initial connectors from demonstrated user need; do not ship a generic connector framework without one end-to-end integration.

### 38 AI-Assisted Workflows

- Draft announcements, summarize projects, prepare check-ins, classify inbound mail, and propose tasks.
- AI-created content remains internal until a human changes visibility.

## Phase 10 — Production Readiness

### 39 Security and Abuse Review

- Test authorization matrices, Storage/Firestore Rules, webhook replay, cron authentication, invitation abuse, upload limits, and connector secret isolation.

### 40 Performance and Observability

- Add structured logs, error reporting, query/index monitoring, email delivery dashboards, and agent run metrics.
- Paginate all unbounded collections.

### 41 Accessibility and Responsive QA

- Verify keyboard navigation, focus, labels, contrast, reduced motion, mobile timer operation, and client portal usability.

### 42 Release and Migration

- Run migration dry run, reconciliation, backup, staged rollout, monitoring, and rollback procedure.
- Remove legacy writes only after new project flows are stable.

## Phase 11 — Personal Work Intelligence

### 43 Persisted Timer Pause and Resume

- Persist `running` and `paused` states with bounded active-work segments.
- Synchronize pause/resume across tabs, browser title, global controls, and Document Picture-in-Picture.
- Exclude paused intervals from final entries and audit every transition.

### 44 Inactivity Detection and Recovery

- Prefer permission-gated device Idle Detection and fall back to visible-page activity without treating hidden-tab silence as device inactivity.
- Warn after two minutes of confirmed inactivity, count down for 30 seconds, then auto-pause from the inactivity threshold.
- On return, offer resume, stop, or an audited inactive-time adjustment.

### 45 Tracked-Time Alarms ✅

- Add persisted reminder duration, due state, acknowledgement, and snooze based on active tracked seconds rather than wall time.
- Deduplicate alarms across tabs and show both in-app and service-worker notifications when permission is granted.
- Clearly disclose that initial-release reminders require the browser to remain open; defer closed-browser delivery until Web Push scheduling is available.

### 46 My Work Dashboard and Targets 🚧

- Add private Today, This Week, and This Month work summaries, recent logs, task counts, sessions, inactive time, and an activity timeline.
- Add configurable personal work-hour targets and near-real-time reconciliation after timer and task transitions.
- Keep My Work self-only; broader team activity belongs in a separately authorized administration surface.

### 47 Optimistic Application Mutations ✅

- Add a shared per-record coordinator for snapshots, synchronous projection, duplicate prevention, canonical reconciliation, rollback, and transient retry.
- Slice 1: tasks and timers.
- Slice 2: message board and time entries.
- Slice 3: projects and reversible file metadata actions.
- Slice 4: people, project access, organization settings, and notification preferences.
- Finish with an audit of broad pending locks, `window.location.reload()`, and unnecessary `router.refresh()` calls. Keep external delivery, uploads, security operations, migrations, exports, and consequential AI/connector execution on explicit progress states.

### 48 Task Comments and Replies 🚧

- Add lazy-loaded task discussions with commenter identity, timestamps, edit state, one-level replies, and audited soft deletion.
- Enforce project-team, task-assignee, selected-person, private, and client-visible audiences on the server; replies inherit the root audience.
- Notify eligible reply authors and explicitly selected mentioned members through the existing Resend outbox with delivery-time access revalidation.
- Apply item-scoped optimistic create/edit/delete behavior and cross-tab reconciliation without refreshing the task page.

## Definition of Done for Every Feature

- Acceptance behavior and failure states are implemented.
- Authentication, authorization, organization, project, and visibility checks are covered where relevant.
- Inputs and external payloads are validated.
- Loading, empty, error, success, and permission-denied UI states exist.
- Tests pass at the correct level: unit, component, rules, integration, or E2E.
- `ui-registry.md`, `library-docs.md`, and `progress-tracker.md` are updated when affected.
- Build, typecheck, lint, and relevant smoke tests pass.
