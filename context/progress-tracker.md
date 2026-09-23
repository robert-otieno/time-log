# Time Log — Progress Tracker

Update this file after every completed feature. A new session should be able to identify the current phase, last verified result, next action, and active blockers without reconstructing history from chat.

## Current Status

**Phase:** Phase 7 — Storage and Core Collaboration

**Last completed:** 25 Scheduled Notifications

**Current:** 27 Message Board — browser verification pending

**Blockers:** Message attachments remain deferred because Feature 26 Firebase Storage requires a pricing-plan upgrade. The post, comment, visibility, moderation, pinning, and announcement workflows are otherwise available.

2026-09-23 — Timer launcher overflow fix — constrained shared Select triggers and dialogs to their parent width, truncated long selected project/task values, allowed full dropdown options to wrap, and added shrink boundaries to launcher form rows — typecheck and lint pass with 28 pre-existing warnings; verify long project/task names at mobile and desktop widths

2026-09-22 — Time-entry correction recovery — changed corrections to field-level patches so a billable-only edit preserves exact timestamps and every untouched value; fixed the server-action/domain boundary to remove routing-only `projectId` and stop-only `completeTask` fields before strict domain validation; added safe error feedback and action/domain regression coverage — 208 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass; re-test billable-only correction and manual time entry

2026-09-21 — Feature 27 — browser verification pending — added project-scoped posts and comments, author editing, administrator moderation and pinning, soft archive/restore, explicit post visibility, internal-default internal comments, client-visible client comments, client-safe discovery and Rules, edited markers, archived view, bounded older-post pagination, transactional announcement fan-out through the existing Resend outbox, and send-time recipient/access/visibility reauthorization; attachments remain deferred with Storage paused — 204 unit tests, 23 Rules tests, typecheck, lint (28 pre-existing warnings), and production build pass; deploy Firestore indexes/rules, then run admin/member/client and announcement delivery smoke

2026-09-21 — Feature 26 pricing hold — retained the verified Storage implementation but centrally disabled Docs & Files; removed it from project navigation, overview, settings, and client tool discovery; direct page access returns Not Found, downloads return Service Unavailable, and upload/finalization commands fail closed — resume Feature 26 after upgrading the Firebase project, then deploy its indexes/rules and run the documented browser smoke

2026-09-21 — Feature 26 — browser verification pending — added private tenant/project object paths, exact pending-upload authorization, direct resumable 25 MB uploads, extension/MIME/signature validation, server-observed size/checksum finalization, Firestore metadata lifecycle, internal-by-default visibility, clean-scan client gate, five-minute audited signed downloads, archive flow, Docs & Files project UI, deny-by-default Firestore/Storage Rules, and isolated emulator coverage; typecheck, 201 unit tests, 22 Rules tests, lint (28 pre-existing warnings), and production build pass — deploy Firestore indexes plus Firestore/Storage Rules, then run authenticated upload/download/archive and denied-client smoke

2026-09-21 — Feature 25 Hobby scheduling compatibility — deployment verification accepted; replaced hourly-only eligibility with deterministic daily reminder/digest scanning and a persisted catch-up window that remains frozen across cursor continuation, retained authenticated POST for operations, added Vercel-native authenticated GET, and configured the single Hobby cron for 16:00 UTC with approximate delivery documented — 196 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass; deploy the updated cron configuration, then begin Feature 26 Firebase Storage and File Metadata

2026-09-21 — Semantic badge palette — added accessible light/dark success, warning, blocked, info, and neutral status badges with dot-plus-label treatment; applied them to task status/priority, project lifecycle, people/invitations, audit outcomes, visibility, and time-entry/report metadata — 195 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass; run authenticated light/dark badge visual smoke

2026-09-21 — Shadcn visual preset — adopted preset `b311momZs0` (`radix-maia`, `mist`) across global tokens and shared primitives; added DM Sans/Outfit typography, application-level tooltip context, the preset Input Group, and React DayPicker v10 compatibility while removing the legacy root `text-xs` override — 185 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass; run authenticated light/dark desktop/mobile visual smoke

2026-09-21 — Project-scoped administration — separated organization roles from assignment-level project authority; Project admins are organization members with administrative access only to selected projects, can manage project settings without changing the linked client, cannot enter organization administration, and can be invited or converted from an Organization admin with final-admin protection; legacy assignments default safely to Member; refined Admin access controls into a responsive Role/Project access row with a checkable project list — 185 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass; run authenticated SAS/personal-project role-conversion smoke

2026-09-21 — Context-aware timer launcher — the global Start timer now derives project context from `/projects/[projectId]` routes unless an explicit Track time action supplies stronger context; eligible tasks are recommended by current-user assignment, in-progress status, deadline, priority, and stable order, while non-project pages retain the neutral first-accessible-project fallback — 179 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass; run project-route, explicit-task, and non-project browser smoke

2026-09-21 — To-do list compactness refinement — replaced per-task cards with one divided hierarchical list; collapsed rows now show completion and title, while a single click-expanded details region reveals descriptions, metadata, and secondary actions before an explicit edit mode; subtasks retain visible indentation and client views retain read-only disclosure — 172 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass; run authenticated desktop/mobile task, subtask, archive, and client-view smoke

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
- [x] 01 Next.js 16 Compatibility Gate

### Phase 1 — Authentication First

- [x] 02 Firebase Admin Foundation
- [x] 03 Secure Login Session
- [x] 04 Complete Logout

### Phase 2 — Tenant, Roles, and Onboarding

- [x] 05 Organization and Membership Schema
- [x] 06 Audit Event Foundation
- [x] 07 Personal Organization Bootstrap
- [x] 08 Personalized Onboarding
- [ ] 09 People, Clients, and Invitations (implemented; authenticated smoke pending)

### Phase 3 — Projects and Visibility

- [x] 10 Project CRUD and Navigation
- [x] 11 Visibility Primitive
- [x] 12 Client Portal Shell

### Phase 4 — To-Dos

- [x] 13 Project Task Schema and Repository
- [x] 14 To-Do List UI
- [x] 15 My Work
- [x] 16 Legacy Task Migration

### Phase 5 — Time Tracking

- [x] 17 Active Timer Domain
- [x] 18 Global Timer UI
- [x] 19 Stop Timer and Time Entries
- [x] 20 Time Views and Reports

### Phase 6 — Admin and Email Foundation

- [x] 21 Admin Console
- [x] 22 Audit Trail Viewer
- [x] 23 Resend Outbox and Templates
- [x] 24 Resend Webhooks and Preferences
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
| 2026-09-16 | Normal logout affects only the current browser | Avoid surprising account-wide Firebase refresh-token revocation; reserve “Log out everywhere” for an explicit security action |

| 2026-09-16 | Key organization memberships and project assignments by Firebase UID | Makes membership and assignment authorization deterministic in Firestore Rules |
| 2026-09-16 | Keep client companies separate from client-user memberships | Allows multiple client users to share one client entity without conflating identity and account data |
| 2026-09-16 | Permit collaborative writes only through verified server operations | Keeps authorization, validation, and future audit-event creation on one trusted boundary |
| 2026-09-16 | Use a closed audit action registry with per-action safe-field allowlists | Prevent ad hoc action names and sensitive values from entering the immutable audit trail |
| 2026-09-16 | Generate correlation identifiers on the server | Prevent callers from spoofing request/run relationships |
| 2026-09-16 | Treat denied and failed audit persistence as mandatory | Avoid reporting a meaningful action as fully handled when its required history was not stored |
| 2026-09-16 | Derive personal organization IDs from a truncated SHA-256 UID digest | Makes bootstrap deterministic without exposing Firebase UIDs in organization paths or slugs |
| 2026-09-16 | Preserve existing active organization selection during bootstrap | Avoid disrupting users who already selected another accessible organization; selection never grants access |
| 2026-09-16 | Repair missing bootstrap records but reject conflicting state | Keep retries self-healing without silently overwriting ownership or authorization data |
| 2026-09-16 | Persist onboarding state inside the organization tenant | Keeps onboarding writes server-controlled and aligned with membership authorization |
| 2026-09-16 | Use a deterministic onboarding first-project record | Makes repeated project submissions safe without duplicate workspaces |
| 2026-09-16 | Keep task/timer onboarding educational until their numbered features | Avoid disposable implementations while teaching the required task-first workflow |
| 2026-09-20 | Bootstrap personal organizations when the secure session is created | Removes an unnecessary four-document transaction from every protected navigation while retaining idempotent onboarding |
| 2026-09-20 | Memoize authenticated request reads and discover member projects assignment-first | Prevents repeated session/access reads and project-list N+1 queries without weakening authorization |
| 2026-09-20 | Store a server-only global active-timer pointer under each user | Enforces one active timer across organizations, projects, tabs, and browsers without relying on UI state |
| 2026-09-20 | Use a server-generated Firestore Timestamp captured once per start command | Provides an authoritative, deterministic start instant across transaction retries and elapsed-time displays |

## Active Notes

- The repository was synchronized before implementation began. `AGENTS.md` and current baseline changes are intentionally uncommitted implementation work.
- Existing Firebase data is user-scoped under `users/{uid}`. New collaborative data must use organization/project scope and an explicit migration.
- `docs/feature-upgrade.md` is legacy product guidance, not the source of truth for the new build.

## Session Log

2026-09-21 — Completed-task flow — hid completed work from the default To-dos view while retaining explicit Done-filter recovery, promoted visible children of hidden completed parents, synchronized timer-driven completion into open lists, excluded completed tasks from timer launch queries, and rejected completed task IDs at timer start; added the required task status query index — deploy Firestore indexes and verify completion disappearance plus timer choices

2026-09-21 — Timer completion workflow — added an optional unchecked “Mark task completed” choice to the stop dialog; stopping, time-entry creation, eligible task completion, timer cleanup, and correlated audits now commit atomically, while already-completed tasks remain idempotent and Picture-in-Picture quick stop remains completion-free — verify stop-only, stop-and-complete, archived-task retry, and project-level timer flows

2026-09-21 — Admin information architecture — removed People from primary navigation, moved invitations and membership access to `/admin/people`, added persistent Overview/People/Activity administration navigation, and retained `/people` as a compatibility redirect — verify admin navigation, invitation result redirects, and non-admin denial

2026-09-20 — Unified application shell — moved the shared role-aware header to the authenticated layout so My Work, Projects, People, Settings, Admin, Activity, and Time use one navigation implementation; added active-route states and a deliberate mobile menu while suppressing chrome during onboarding — verify desktop/mobile navigation for admin, member, and client roles

2026-09-20 — Shared navigation recovery — replaced the divergent My Work and Projects header implementations with one role-aware `AppHeader`, including the same project switcher, icon map, label rules, brand route, and utilities — verify transitions between My Work, Projects, and project detail routes

2026-09-20 — Project header consistency — standardized My Work, Projects, People, Settings, and Admin as icon-plus-visible-label destinations; retained compact icon controls only for Theme and Logout — verify navigation labels across internal and client roles

2026-09-20 — Project header clarity — replaced ambiguous Settings/Admin icon-only actions with conventional gear/shield icons and persistent text labels; allowed safe header wrapping on constrained widths — verify the header at mobile, tablet, and desktop widths

2026-09-20 — Project navigation recovery — added a persistent responsive My Work link to the project workspace header for internal users while preserving the client-only portal boundary — verify return navigation from Projects and an individual project

2026-09-20 — Theme hydration recovery — fixed the expected `next-themes` pre-hydration mutation by scoping `suppressHydrationWarning` to the root HTML element; typecheck, focused lint, and logout route tests pass — verify `/login` with both light and dark system themes

2026-09-20 — Feature 25 — deployment verification pending — added an authenticated hourly notification scheduler, recipient-timezone reminder/digest windows, deterministic enqueue with immediate delivery, due retry scanning, bounded organization/member cursors, run records/counts/failures, and correlated per-organization scheduler audits; review fixes prevent capped members from losing remaining work and make lifecycle auditing explicit; automatic check-ins remain deferred to their Feature 32 domain prerequisite — deploy the Firestore index, configure `CRON_SECRET`, invoke the cron route, and verify one due reminder plus an idempotent repeat

2026-09-20 — Feature 24 — completed — personal notification preferences and verified Resend delivery webhook behavior accepted — start Feature 25 Scheduled Notifications

2026-09-20 — Feature 24 — browser verification pending — added personal timezone/category settings, legacy preference compatibility, signed raw-body Resend webhooks, hashed receipt deduplication, out-of-order event protection, operational delivery states, privacy-preserving engagement-event omission, and hashed bounce/complaint suppression enforced immediately before non-essential delivery; review fixes keep provider outcomes separate from outbox retry state and audit the actual applied/stale/duplicate webhook result; 162 unit tests, 19 Rules tests, typecheck, lint (28 pre-existing warnings), and production build pass — configure webhook secret/endpoint and run settings plus Resend delivery-event smoke

2026-09-20 — Feature 23 — completed — typed Resend outbox, repository templates, assignment delivery, claim leases, retry metadata, recipient authorization, and suppression accepted — start Feature 24 Resend Webhooks and Preferences

2026-09-20 — Feature 23 — browser verification pending — added typed invitation/assignment/mention/reminder/announcement/digest notification records, repository-owned branded HTML/text templates, transactional claim leases, permanent logical idempotency, recipient re-authorization and suppression, retry scheduling metadata, invitation migration, and atomic task-assignment email enqueue with immediate best-effort delivery; review fixes preserve email-less assignment intent and convert recipient-resolution faults into audited retryable failures; 150 unit tests, 18 Rules tests, typecheck, lint (28 pre-existing warnings), and production build pass — run invitation and assignment browser smoke

2026-09-20 — Feature 22 — completed — organization and project activity views, guarded exports, correlation details, client denial, and export auditing accepted — start Feature 23 Resend Outbox and Templates

2026-09-20 — Feature 22 — browser verification pending — added admin organization activity, assigned-member project activity, client denial, safe summaries, one-year filters, opaque cursor pagination, correlation details, admin-only CSV/JSON exports, 90-day/5,000-event export guards, CSV formula neutralization, and succeeded/denied/failed export audits; review fixes added the Admin Console entry point and denied-export auditing; 140 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass — run role/browser/export smoke

2026-09-20 — Feature 21 — browser verification pending — added an audited admin-only organization console, organization/client health summaries, client-company directory, role management, last-active-admin protection, confirmed suspension/removal/demotion, atomic soft removal assignment cleanup, client-owned project assignment enforcement, archived-project assignment prevention, organization name/timezone settings with timezone confirmation, canonical project links, and recent administrative history; 140 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass — run admin/member/client browser smoke

2026-09-20 — Feature 20 — browser verification pending — added personal day/week time views with period navigation, organization-timezone date boundaries, project summaries, role-scoped filters, approved-only client preview/navigation, audited client-safe CSV export, and report aggregation/empty states; review fixes block clients from personal time, neutralize spreadsheet formulas, cap each project report at 2,000 entries with explicit partial-results feedback, and reject partial exports; 136 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass — run admin/member/client browser smoke

2026-09-20 — Global timer enhancement — automated verification complete — added a capability-gated Document Picture-in-Picture “Keep timer visible” control, compact always-on-top active-task timer, audited Stop & save using explicit internal/non-billable defaults, PiP lifecycle cleanup, permission failure feedback, and a live elapsed/task browser-title fallback; 129 unit tests, typecheck, and lint (28 pre-existing warnings) pass — run authenticated supported-browser PiP/open/minimize/close/stop smoke alongside Feature 19 browser verification

2026-09-20 — Feature 19 — verification pending — added atomic stop-to-entry conversion and timer cleanup, server-calculated durations, final notes, billable and client-reporting controls, manual entries, member/admin task policy, recent project entries, audited authorized corrections with correction counts, audited invalid-range failures, cross-tab stop invalidation, and server-only entry Rules; 129 unit tests, 18 Rules tests, typecheck, and lint (28 pre-existing warnings) pass — run authenticated stop/manual/correction/client-isolation smoke and rerun production build after stopping dev

2026-09-20 — Feature 18 — completed — global timer placement refined to a bottom-center floating control with authenticated page clearance; user directed progression to the stop/time-entry lifecycle — start Feature 19

2026-09-20 — Feature 18 — verification pending — added the persistent responsive timer control, lazy authorized project/task launcher, admin project-level option, member task requirement, audited inline task creation, server-authoritative elapsed display, active project/task/note/start context, duplicate-start recovery, BroadcastChannel/focus/visibility/30-second cross-tab refresh, retained state with Offline/Sign in feedback, My Work preselection, and a real project Time route; 124 unit tests, typecheck, and lint (28 pre-existing warnings) pass; production compilation passed but final build could not be rerun while the developer's Next dev process held `.next` — run authenticated start/refresh/navigation/second-tab/offline smoke and rerun build after stopping dev

2026-09-20 — Feature 17 — completed — added strict active-timer and pointer schemas, transactional one-timer-per-user enforcement, member task requirement, admin project-level timers, client/project/task authorization, server-derived elapsed time, pointer integrity checks, atomic start audit events, and server-only Firestore Rules for timer state; 122 unit tests, 17 Rules tests, typecheck, lint (28 pre-existing warnings), and production build pass — start Feature 18 Global Timer UI

2026-09-20 — Navigation performance recovery — implementation verified — moved organization bootstrap to secure session creation, request-memoized session/organization/project access, replaced member project N+1 reads with assignment-first discovery, skipped completed legacy migration scans, added route progress, nested loading skeletons, pressed button states, and immediate project-switch feedback; 115 unit tests, typecheck, lint (28 pre-existing warnings), and production build pass — run authenticated navigation smoke, then start Feature 17 Active Timer Domain

2026-09-20 — Feature 16 — completed — authenticated legacy task import accepted by the user; source preservation and reconciliation behavior confirmed — performance recovery requested before Feature 17

2026-09-18 — Feature 16 — verification pending — added preview-first non-destructive legacy task/subtask migration, strict supported-field mapping, deterministic destination IDs, nested task conversion, internal visibility and self-assignment, unmapped/invalid reporting, bounded resumable transactions, target locking, reconciliation marker updates, correlated audit events, and Projects-page confirmation/results UI; 114 unit tests, typecheck, lint (28 legacy warnings), and production build pass — run authenticated browser smoke with empty, populated, retry, and issue-reporting states

2026-09-18 — Feature 15 — completed — authenticated browser smoke accepted; My Work aggregation, due groups, navigation, timer handoff, empty state, and client redirect are ready — start Feature 16 Legacy Task Migration

2026-09-18 — Feature 15 — verification pending — replaced the legacy home dashboard with server-authorized cross-project assigned work grouped by overdue, today, upcoming, and no due date; added organization-timezone grouping, unfinished-task filtering, project/task links, timer-route handoff, client redirect, empty state, and access/grouping tests; 111 unit tests, typecheck, lint (28 legacy warnings), and production build pass — run authenticated admin/member/client browser smoke

2026-09-18 — Feature 14 — completed — authenticated browser smoke confirmed immediate task creation, Shadcn date/time deadlines, direct subtask creation, archive discovery, and restore behavior — start Feature 15 My Work

2026-09-18 — Feature 14 — verification pending — added the real project To-dos route, client-safe task DTOs, authorized assignee loading, immediate optimistic parent/subtask creation, direct nested subtask forms, Shadcn-composed optional date/time deadlines with timezone-safe date-only storage, compact/nested rows, expandable inline editing, filters, optimistic complete/reopen with rollback, explicit Archived view with audited Restore, read-only client mode, and safe server actions; 107 unit tests, typecheck, lint (28 legacy warnings), and production build pass — run focused parent/subtask, deadline, archive/restore, and client browser smoke

2026-09-18 — Feature 13 — completed — added strict project-task documents and commands, multiple internal assignees, timezone-aware deadlines, independent completion/archive state, same-collection subtasks with cycle checks, bounded visibility-aware repository queries, audited lifecycle mutations, shared visibility adapter, composite indexes, and client-safe Rules; 103 unit tests, 16 Rules tests, typecheck, lint, and production build pass — start Feature 14

2026-09-18 — Feature 12 — completed — authenticated client portal smoke passed after index deployment; assigned-project, restricted-navigation, empty-state, and non-disclosing route behavior confirmed — start Feature 13

2026-09-16 — Feature 12 — verification pending — added assignment-first client project discovery, cross-tenant reference filtering, direct-route reauthorization, historical read-only project access, client-safe tool availability checks, non-disclosing tool routes, restricted navigation, portal banner, and empty state; 92 unit tests, 16 Rules tests, typecheck, lint, and production build pass — run authenticated client portal smoke

2026-09-16 — Feature 11 — completed — added canonical visibility schemas/defaults, independent project-access policy, database query constraints, Zod-allowlisted client serialization, adapter-based audited changes, shared badge/control UI, and task-path Rules coverage; 86 unit tests, 16 Rules tests, typecheck, lint, and production build pass — start Feature 12

2026-09-16 — Feature 10 — completed — authenticated Project Settings retest confirmed after plain DTO serialization fix; automated gates remain green — start Feature 11

2026-09-16 — Feature 10 — verification pending — fixed the project Settings Server/Client serialization failure by mapping Firestore-backed project and client records to explicit plain form DTOs before rendering the client form; added a timestamp-metadata regression test; 76 unit tests, typecheck, lint (zero errors; 28 legacy warnings), and production build pass — re-test authenticated admin project Settings

2026-09-16 — Feature 10 — verification pending — added strict project commands, immutable collision-safe keys, audited CRUD/lifecycle services, verified active-organization resolution, project index/forms/switcher, internal-only authorized shell, enabled-tool navigation and direct-route rejection, read-only historical states, and assignment-aware access; 75 unit tests, 14 Rules tests, 3 browser auth checks, typecheck, lint, and production build pass — run authenticated admin/member/client project smoke

2026-09-16 — Feature 09 — verification pending — added admin People UI, member/client invitation validation, hashed seven-day tokens, authenticated email-bound acceptance, durable Resend outbox with idempotent delivery, client companies, explicit project assignments, suspend/restore/remove lifecycle, last-admin protection, and server-only outbox Rules coverage; 70 unit tests, 13 Rules tests, typecheck, lint, and production build pass — configure Resend and run admin invitation plus invited-account acceptance smoke

2026-09-16 — Feature 08 — completed — authenticated onboarding passed after replacing the timezone datalist with a searchable shadcn combobox and work-hour inputs with shadcn time pickers; automated gates remain green — start Feature 09

2026-09-16 — Feature 08 — verification pending — all tested onboarding areas passed except the non-responsive native timezone datalist; replaced it with a searchable shadcn combobox and replaced native work-hour inputs with canonical shadcn time pickers; 63 unit tests, typecheck, and lint pass — re-smoke the profile step

2026-09-16 — Feature 08 — verification pending — resumable four-step onboarding, validated schedule and notification preferences, workspace rename, deterministic first project, task-first timer education, audited server actions, routing, and server-only Rules coverage implemented; 63 unit tests, 12 Firestore Rules tests, typecheck, lint, and production build pass — run authenticated onboarding and resume smoke

2026-09-16 — Feature 07 — completed — deterministic personal organization bootstrap, active admin membership, preserved workspace selection, legacy migration marker, atomic audit, conflict handling, and protected-layout integration verified through initial and repeated authenticated live Firestore loads; 56 unit tests, 11 Firestore Rules tests, typecheck, lint, and production build pass — start Feature 08

2026-09-16 — Feature 06 — completed — versioned audit schema, canonical action registry, typed redaction allowlists, server correlation helpers, create-only repository, transactional command boundary, mandatory denied/failed auditing, and browser-denial Rules tests implemented; 51 unit tests, 9 Firestore Rules tests, typecheck, lint, and production build pass — start Feature 07

2026-09-16 — Feature 05 — completed — organization, membership, client, invitation, project, and assignment schemas; capability policy; server repository boundary; deny-by-default Firestore Rules; and role-matrix emulator tests implemented; 35 unit tests, 6 Firestore Rules tests, typecheck, lint, and production build pass — start Feature 06

Add concise entries only when implementation work changes status:

```text
YYYY-MM-DD — Feature NN — completed/blocked — verification summary — next action
```

2026-09-16 — Feature 01 — in progress — official Next.js codemod applied; Next.js 16.3.5, React 19.3.0, ESLint CLI, tests, typecheck, lint, and production build verified — run authenticated smoke
2026-09-16 — Feature 01 — completed — authenticated login/task/logout smoke confirmed; logout now requires confirmation with cancel, pending, and safe failure states; 9 tests, typecheck, lint, and production build pass — start Feature 02
2026-09-16 — Feature 02 — completed — canonical Firebase Admin credentials validated server-side; singleton lazy initialization and typed ID/session actor verification added; unauthenticated routes fail closed with 401; 14 tests, typecheck, lint, and production build pass — configure credentials and start Feature 03
2026-09-16 — Feature 03 — in progress — recent-token exchange, httpOnly session cookie, safe return paths, verified protected layout, optimistic Proxy redirect, explicit login states, and session clearing added; automated checks and route failure probes pass — run authenticated browser smoke
2026-09-16 — Feature 03 — completed — Google sign-in, session persistence after refresh, hostile return-path fallback, confirmed logout, back-navigation protection, and direct protected-route rejection verified manually — start Feature 04
2026-09-16 — Feature 04 — in progress — idempotent dedicated logout endpoint, server-first termination, full document state reset, 29 unit/integration tests, and 3 Playwright browser checks pass — confirm logout once after navigation hardening
2026-09-16 — Feature 04 — completed — confirmed logout clears the current-browser session, resets client state through full navigation, and prevents Back/direct protected access; automated gates remain green — start Feature 05

2026-09-16 — Feature 00 — completed — tests, typecheck, production build, route availability, login, task create/edit/complete, and logout verified; lint limitation documented — start Feature 01
