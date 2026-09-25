# Time Log — Architecture

## Architecture Decision Summary

Time Log remains on Firebase to minimize migration risk and reuse the current application. The target framework is Next.js 16, but the upgrade is a gated foundation task: capture a working baseline, run the official codemod, resolve issues, and pass build/auth smoke tests before feature development continues. If the upgrade fails the gate, continue P0 on Next.js 15 and track the upgrade separately.

The current browser-only data pattern must not be extended to team features. Collaborative writes, Resend, scheduled work, admin actions, and AI execution require server-verified identity and authorization.

## Stack

| Layer | Tool | Purpose |
| --- | --- | --- |
| Framework | Next.js 16 target, App Router, React 19 | Full-stack web application |
| Language | TypeScript strict | Application and infrastructure code |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, Lucide | Existing component system |
| Client auth | Firebase Authentication | Google sign-in and client auth state |
| Server auth | Firebase Admin SDK | Verify sessions/tokens and perform privileged operations |
| Database | Cloud Firestore | Tenant, project, task, time, notification, and audit data |
| Files | Cloud Storage for Firebase | Project documents, images, and attachments |
| Email | Resend | Transactional messages and delivery webhooks |
| Validation | Zod | Validate every untrusted boundary |
| Scheduling | Deployment cron or Cloud Scheduler calling authenticated routes | Reminders, check-ins, digests, cleanup |
| AI | Provider adapter, model selected at implementation time | Structured agent reasoning and drafting |
| Testing | Vitest + Testing Library; Playwright; Firebase Emulator Suite | Unit, component, rules, and end-to-end coverage |

## Target Folder Structure

```text
/
├── app/
│   ├── (auth)/login/
│   ├── (app)/
│   │   ├── onboarding/
│   │   ├── projects/[projectId]/...
│   │   ├── people/
│   │   ├── agents/
│   │   └── admin/
│   ├── api/
│   │   ├── auth/session/route.ts
│   │   ├── auth/logout/route.ts
│   │   ├── cron/.../route.ts
│   │   ├── resend/webhook/route.ts
│   │   └── agents/.../route.ts
│   └── actions/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── projects/
│   ├── tasks/
│   ├── time/
│   ├── people/
│   └── visibility/
├── domain/
│   ├── auth/
│   ├── organizations/
│   ├── projects/
│   ├── tasks/
│   ├── time/
│   ├── notifications/
│   └── agents/
├── lib/
│   ├── firebase-client.ts
│   ├── firebase-admin.ts
│   ├── resend.ts
│   ├── env.ts
│   └── result.ts
├── emails/
├── context/
├── firestore.rules
├── storage.rules
└── tests/
```

Existing files may be migrated incrementally. New business rules belong in `domain/`; route handlers and components must not become the domain layer.

## System Boundaries

| Area | Owns | Must not own |
| --- | --- | --- |
| `app/` | Routing, request parsing, response construction, server action entry points | Reusable business policy |
| `components/` | Rendering and interaction | Direct privileged Firebase/Resend/AI calls |
| `domain/` | Authorization-aware use cases, schemas, repositories, policy | React UI |
| `lib/` | SDK initialization and low-level shared helpers | Feature workflows |
| `emails/` | Email templates and presentation | Recipient authorization decisions |
| Security Rules | Defense-in-depth for browser Firestore/Storage operations | Full server workflow orchestration |

### Optimistic mutation boundary

Frequent reversible record mutations use the project-owned optimistic coordinator in `hooks/use-optimistic-mutations.ts`. A stable record scope permits unrelated records to mutate concurrently while serializing overlapping operations against the same record. Each mutation captures an exact snapshot, applies a synchronous local projection, executes the existing server-authorized action, reconciles canonical returned values, and rolls back only its affected record on failure. Temporary IDs are replaced by server IDs after creation. Pending state is per scope rather than per list or page.

Actions whose client surfaces fully reconcile their own canonical results do not call `revalidatePath` merely to refresh the same route. This avoids a competing React Server Component refresh after optimistic task and message mutations. Explicit refreshes remain where a mutation changes other server-rendered aggregates or crosses authentication, onboarding, workspace-context, or report-navigation boundaries.

The active timer is a state machine rather than an independent record form. Its Start, Pause, and Resume intents therefore use an ordered client command queue: every intent projects immediately, server commands execute in user order, only the latest intent may reconcile visible state, and focus/poll refreshes pause until the local queue drains. A failed predecessor prevents dependent timer commands from executing against invalid server state; the client then reloads the canonical timer. Stop retains its dedicated immediate-close and cross-context saving workflow and is unavailable while an earlier timer command is being committed.

Tracked-time alarms are persisted inside the active timer and use accumulated active seconds, never wall-clock duration. Configure, trigger claim, dismiss, and snooze are audited server commands. The due transition is transactionally claimed so concurrent tabs cannot independently trigger the same alarm; stable notification tags provide an additional browser-level deduplication layer. BroadcastChannel/storage invalidation distributes canonical alarm state. A minimal service worker displays notifications only after explicit permission, while the in-app due dialog remains available without permission. The initial release requires an open browser and does not claim closed-browser delivery.

Optimism changes presentation timing only. Server identity, authorization, organization/project scope, visibility, validation, transactions, and audit writes remain authoritative. Authentication, logout, migrations, exports, uploads, email delivery, and consequential AI or connector execution use honest progress states instead of claiming optimistic success. Confirmed destructive actions may optimistically hide a record because rollback is possible. Retry is offered only when an error is classified as transient; denied, validation, and conflict results require review.

Project creation, active-project switching, enabled-tool/settings changes, and lifecycle transitions also retain honest pending states. These operations change routing, capability availability, access semantics, or whole-project writability, so a speculative local success would be misleading. File upload and finalization remain server-confirmed; file metadata optimism is deferred while Firebase Storage is intentionally disabled and cannot receive meaningful browser verification.

People and settings administration is also server-confirmed. Invitations, roles, project assignments, suspension, restoration, removal, organization identity/timezone, and personal notification preferences must not claim success before authorization, audit, and any required notification work completes. Editable forms may keep local draft values, but saved/access/delivery states appear only after the authoritative action succeeds; pending state remains scoped to the relevant person or form.

## Authentication and Sessions

The current `token` cookie is written from browser JavaScript and is not sufficient as a trusted server session. The target flow is:

```text
Firebase client sign-in
  → obtain fresh Firebase ID token
  → POST token to /api/auth/session over HTTPS
  → Firebase Admin verifies ID token
  → server creates secure, httpOnly, sameSite session cookie
  → protected server code verifies session and loads membership
```

- Never authorize from `clientAuth.currentUser` inside server code.
- Never trust a raw `uid`, organization ID, project ID, role, or visibility sent by the browser.
- Server mutations derive actor identity from the verified session.
- Logout clears the server cookie and signs out the browser client. Where supported, revoke refresh tokens for high-risk session termination.
- Firebase custom claims may hold coarse platform privileges only. Organization/project membership stays in Firestore because claims are size-limited and can become stale.

## Multi-Tenant Data Model

New collaborative data uses top-level organizations with project subcollections. Legacy `users/{uid}/daily_tasks` data remains read-only during migration and must never be queried as collaborative project data.

```text
users/{uid}
organizations/{organizationId}
organizations/{organizationId}/members/{uid}
organizations/{organizationId}/clients/{clientId}
organizations/{organizationId}/projects/{projectId}
organizations/{organizationId}/projects/{projectId}/projectMembers/{uid}
organizations/{organizationId}/projects/{projectId}/tasks/{taskId}
organizations/{organizationId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}
organizations/{organizationId}/projects/{projectId}/timeEntries/{entryId}
organizations/{organizationId}/projects/{projectId}/activeTimers/{uid}
organizations/{organizationId}/projects/{projectId}/messages/{messageId}
organizations/{organizationId}/projects/{projectId}/files/{fileId}
organizations/{organizationId}/projects/{projectId}/events/{eventId}
organizations/{organizationId}/projects/{projectId}/chatRooms/{roomId}
organizations/{organizationId}/projects/{projectId}/checkIns/{checkInId}
organizations/{organizationId}/projects/{projectId}/links/{linkId}
organizations/{organizationId}/templates/{templateId}
organizations/{organizationId}/agents/{agentId}
organizations/{organizationId}/connectors/{connectorId}
organizations/{organizationId}/approvals/{approvalId}
organizations/{organizationId}/notifications/{notificationId}
organizations/{organizationId}/auditEvents/{eventId}
organizations/{organizationId}/migrations/legacy-user-v1
organizations/{organizationId}/onboarding/{uid}
users/{uid}/preferences/workspace
```

Organization membership and project authority are intentionally separate. `members/{uid}.role` remains `admin`, `member`, or `client`; `projectMembers/{uid}.projectRole` is `admin` or `member` and defaults to `member` when legacy assignments omit it. Organization admins retain access to every project. Internal members, including project admins, must have an active assignment, and project-management commands require `projectRole: admin`. Project administration never grants organization people, invitation, role, settings, or organization-audit capabilities.

### Core Records

All timestamps are server timestamps. All user-authored records include `createdBy`, `createdAt`, `updatedBy`, and `updatedAt`. Deletable collaborative records use `archivedAt` or `deletedAt` unless legal/security requirements demand hard deletion.

#### Organization

```typescript
type Organization = {
  id: string;
  kind: "personal" | "team";
  name: string;
  slug: string;
  timezone: string;
  ownerId: string;
  onboardingState: "not_started" | "in_progress" | "complete";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

Each authenticated user receives one deterministic personal organization on first protected application use. Bootstrap atomically creates the organization, active admin membership, legacy migration marker, active-organization preference when absent, and audit event. Existing active selection is preserved and never substitutes for a membership check.

Active workspace and project preferences are navigation hints stored at `users/{uid}/preferences/workspace`. Server routes resolve the selected organization only after loading and validating an active membership; inaccessible or stale selections fall back to the deterministic personal organization. Project selection is likewise re-authorized before it is persisted and never grants access.

Onboarding persists a versioned, organization-scoped record per user. Each step is an authenticated, validated, audited transaction. The deterministic `onboarding-first` project prevents duplicate first projects, and completing education atomically changes the organization onboarding state to `complete`.

#### Membership

```typescript
type OrganizationMember = {
  userId: string;
  role: "admin" | "member" | "client";
  status: "invited" | "active" | "suspended" | "removed";
  clientId: string | null;
  joinedAt: Timestamp | null;
};
```

Project assignment is explicit. Organization membership alone does not grant a client access to every project.

Admin mutations use server-verified organization membership and audited transactions. Internal members may be assigned to any non-archived project; client users may only be assigned to projects whose `clientId` matches their membership. Suspension blocks organization access while retaining assignments. Soft removal sets membership to `removed`, revokes every active project assignment in the same transaction, and preserves historical attribution. A transactional active-admin count prevents demotion, suspension, or removal of the final active administrator. Organization timezone changes alter future scheduling and display/report boundaries but never rewrite stored timestamps.

Suspension preserves project assignments for restoration. Removal preserves historical attribution but marks current assignments removed; returning requires a new invitation. The final active organization admin cannot be suspended or removed.

#### Project

```typescript
type Project = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  clientId: string | null;
  status: "active" | "on_hold" | "completed" | "archived";
  enabledTools: ProjectTool[];
  defaultVisibility: "internal";
  templateSource: { templateId: string; version: number } | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

#### Task

```typescript
type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeIds: string[];
  status: "backlog" | "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null; // YYYY-MM-DD calendar date
  dueAt: Timestamp | null;
  dueTimeSet: boolean;
  visibility: "internal" | "client-visible";
  parentTaskId: string | null;
  boardColumnId: string | null;
  sortOrder: number;
  completedAt: Timestamp | null;
  archivedAt: Timestamp | null;
  migrationSource: {
    kind: "legacy-user-v1";
    sourceCollection: "daily_tasks" | "daily_subtasks";
    sourceId: string;
    sourcePath: string;
    version: 1;
    migratedAt: Timestamp;
  } | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
};
```

Subtasks use the same collection and schema through `parentTaskId`. Parent references must remain inside the project; writes reject missing parents, self-parenting, and ancestry cycles. Visibility is independent at every level. `dueDate` preserves the calendar date without timezone conversion; `dueAt` is populated only when `dueTimeSet` records an intentional clock time. `archivedAt` is separate from workflow status so completed tasks may be archived without losing their `done` state, and restoring clears only `archivedAt`.

Task comments are server-only project records beneath their task. An audience is one of `project_team`, `assignees`, `selected`, `private`, or `client_visible`; client-visible comments require a client-visible parent task, and clients may create only that audience. Root comments retain an immutable audience owner. Replies inherit the root audience and audience members, remain visually one level deep, and cannot widen access. Authors may edit or soft-delete their comments, while organization and project admins may moderate. Soft deletion clears content but retains a tombstone and thread relationships. Server reads filter every comment independently and never disclose hidden counts or metadata to clients.

Reply authors and explicitly selected mentioned project members may receive a `mention` notification. Recipient membership, project assignment, task state, comment deletion state, and audience access are revalidated again at delivery time. Comment content is not copied into notification or audit records. The client lazy-loads discussions only when task details open, applies record-scoped optimistic updates, and uses a BroadcastChannel invalidation message to reconcile other tabs against canonical server data.

#### Active Timer and Time Entry

```typescript
type ActiveTimer = {
  userId: string;
  organizationId: string;
  projectId: string;
  taskId: string | null; // null only when actor was an admin at start
  startedAt: Timestamp;
  note: string | null;
  state: "running" | "paused";
  accumulatedSeconds: number;
  currentSegmentStartedAt: Timestamp | null;
  segments: Array<{ startedAt: Timestamp; endedAt: Timestamp }>;
  pausedAt: Timestamp | null;
  pauseReason: "manual" | "inactivity" | null;
};

type TimeEntry = {
  id: string;
  organizationId: string;
  projectId: string;
  taskId: string | null;
  userId: string;
  source: "timer" | "manual";
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationSeconds: number;
  segments: Array<{ startedAt: Timestamp; endedAt: Timestamp }>;
  note: string | null;
  billable: boolean;
  clientReportingStatus: "internal" | "approved";
  correctionCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
};
```

One-active-timer enforcement requires a transaction and a global pointer at `users/{uid}/runtime/activeTimer` referencing the project timer. Running and paused both count as active: pausing does not release the pointer or permit a second timer. The timer and pointer are server-owned, created atomically, and use server-generated transition timestamps. Browser Firestore Rules deny direct reads and writes to both records. Do not rely on a UI check; concurrent tabs must not create two timers.

Pause and resume are audited transactions. Pausing closes the current work segment, adds its integer seconds to `accumulatedSeconds`, and records a manual or inactivity reason; resuming opens a new segment on the same timer. Final duration is the sum of active segments only, so paused time is never billable or reported as worked time. Segment history is bounded at 100; a timer at the bound must be stopped before more work is tracked. Legacy timers normalize to one running segment, and legacy entries normalize to one completed segment, without requiring an eager migration.

Inactivity detection is progressive enhancement. A supported secure browser may use the permission-gated Idle Detection API to observe device-level user or screen inactivity. Without that permission or capability, Time Log observes meaningful keyboard, pointer, touch, and scroll activity only while its document is visible; hidden-tab silence must never be treated as inactivity. After two confirmed inactive minutes, the interface presents a 30-second blocking warning. If unanswered, a narrowly validated server command pauses the current segment effective at the warning instant rather than the later callback instant. The server rejects effective instants outside the current segment or in the future, while allowing delayed callbacks after device sleep. Automatic pause retains the global pointer, records `pauseReason: "inactivity"`, appends the standard timer-pause audit, and presents Resume, Stop, or Keep paused recovery actions.

The authenticated shell reads timer state through server actions. Browser tabs exchange invalidation signals through `BroadcastChannel`, refresh when focus or visibility returns, and poll conservatively while visible; every refresh re-reads the server-owned pointer. Browser time advances only a running timer from the serialized server observation and never changes authoritative accumulated time. The interface retains its last known timer during network loss and never treats cross-tab messaging as authoritative state.

### Personal Work Dashboard

My Work is a self-only aggregation surface. Its server loader always derives the subject from the authenticated actor and never accepts a user ID from the browser. It aggregates only projects accessible in the active organization. Today, week-to-date, and month-to-date boundaries use the organization timezone; overlapping timer segments are clipped to those boundaries, paused gaps are inactive time, manual entries count as tracked time but not timer sessions, and task metrics include only tasks assigned to the actor.

Personal targets live at `users/{uid}/preferences/work-target` with a daily duration and working-day set. Initial values derive from onboarding working hours. Period targets are the daily duration multiplied by configured working days elapsed in the selected range. Updates are validated, audited as redacted preference changes, and do not modify organization reporting settings. The client advances display-only running seconds locally and reconciles from the server after timer broadcasts, focus changes, and conservative visible-page polling.

Document Picture-in-Picture is a progressive enhancement for supported secure browsers and opens only from an explicit user gesture. Its always-on-top timer is a React portal over the same authenticated timer state, not a second source of truth. Closing it leaves the timer running; stopping from it invokes the normal audited server action and deliberately saves the existing note as internal, non-billable time. Unsupported browsers keep the in-page control, while all browsers receive a live elapsed-time and task browser-tab title during active tracking.

Stopping a timer atomically creates its time entry and removes both active-timer records. When explicitly requested for a linked task, the same transaction re-authorizes task management, marks an eligible unfinished task done, and appends the correlated completion audit; an already-completed task remains idempotent. Manual entries and corrections accept start/end instants, while the server calculates and validates integer duration seconds. New entries are non-billable and internal unless explicitly changed. Corrections update the record in a transaction, increment `correctionCount`, identify `updatedBy`, and append an audit event; the product never silently rewrites time history.

The stop interface is visually optimistic without becoming authoritative: it immediately closes Picture-in-Picture, broadcasts `timer-stopping`, hides the active timer, and shows a locked “Saving time…” state while the server transaction runs. Other tabs suppress reconciliation and timer creation during that state. A successful response broadcasts `timer-stopped`; any denied, failed, or disconnected response restores the exact prior timer, broadcasts `timer-stop-failed`, and exposes the error. The server transaction remains the only operation that creates the entry or deletes timer records.

Time reporting uses organization-local calendar boundaries and bounded server queries. Admin project reports may include all project entries; member reports are forcibly scoped to the actor; clients cannot access personal time views and project reports are forcibly scoped to `clientReportingStatus: "approved"` before serialization. Queries read at most 2,000 entries per project and disclose truncation; partial client-safe datasets cannot be exported. Client-safe previews and CSV exports omit notes and internal counts, exported user-controlled text is neutralized against spreadsheet formulas, and both preview and export are audited. Personal time views use the configured timezone and never broaden the actor beyond their own entries.

### Audit Event

```typescript
type AuditEvent = {
  id: string;
  organizationId: string;
  projectId: string | null;
  actor: {
    type: "user" | "system" | "agent" | "connector";
    id: string;
    role: "admin" | "member" | "client" | null;
  };
  action: string; // namespaced, for example "time.timer.started"
  target: {
    type: string;
    id: string | null;
  };
  outcome: "succeeded" | "denied" | "failed";
  changes: Array<{ field: string; from?: unknown; to?: unknown }>;
  reasonCode: string | null;
  requestId: string;
  runId: string | null;
  ipHash: string | null;
  userAgentSummary: string | null;
  occurredAt: Timestamp;
  schemaVersion: number;
};
```

Audit `changes` are built from an allowlist. Sensitive values are omitted, hashed, or summarized. Audit events never contain credentials, auth tokens, session cookies, raw email/file/chat bodies, connector payloads, or complete AI prompts.

## Authorization Policy

Every request follows this order:

```text
authenticate actor
  → load active organization membership
  → verify project assignment
  → verify role/capability
  → load target record
  → enforce record visibility
  → validate requested state transition
  → execute and audit
```

- Admins have organization-wide management access, subject to explicit platform safeguards.
- Members access assigned projects and capabilities.
- Clients access assigned projects and `client-visible` records only.
- Content visibility is checked independently for each child record.
- Search indexes, counts, notification text, file metadata, and AI context use the same filter.

## Audit Architecture

Audit logging is a domain requirement, not a best-effort console side effect.

```text
request or background invocation
  → assign request/run correlation ID
  → authenticate and authorize actor
  → execute or deny domain action
  → append normalized audit event
  → return outcome
```

- Domain commands declare their canonical namespaced action, target, and safe changed-field allowlist.
- For transactional Firestore mutations, the audit event is written in the same transaction as the domain change.
- Denied actions that make no domain mutation are still written through a restricted server path.
- External side effects produce lifecycle events such as `notification.email.sent`, `notification.email.failed`, `agent.action.approved`, and `connector.action.executed`.
- Read events are recorded for security-sensitive access such as file download, report export, client preview, audit export, admin views, and connector secret management. Ordinary list rendering is not logged once per row.
- Audit event documents are create-only. Product code has no update/delete path.
- Firestore/Storage Rules prevent browser writes to the audit collection.
- Retention and export policy are organization settings introduced before production; security-critical events must not be silently expired.
- High-volume UI telemetry such as hover, focus, keystroke, scroll, or each timer display tick is excluded. It belongs in optional analytics, not the audit trail.

The activity viewer reads audit events only through server-authorized queries. Admins may inspect organization or project history; internal members are restricted to actively assigned projects; clients have no audit access. Viewer ranges are capped at one year and use opaque timestamp/document cursors with 50 visible results. Admin-only CSV/JSON exports are audited, capped at 90 days and 5,000 matching events, and CSV text is neutralized against spreadsheet formulas.

## Storage Architecture

Binary objects live at opaque, tenant-scoped paths:

```text
organizations/{organizationId}/projects/{projectId}/files/{fileId}/{safeFilename}
```

Firestore stores metadata: original name, storage path, content type, size, checksum, uploader, visibility, scan status, and timestamps.

- Buckets are private; do not persist public download URLs.
- Reads use authenticated SDK access or short-lived server-generated URLs after authorization.
- Storage Rules validate tenant path, membership, size, and allowed content type.
- File visibility is independent from the parent task/doc.
- Executable and unsafe file types are rejected. Malware scanning is required before broader production use.

## Resend Notification Architecture

```text
domain event
  → create notification/outbox record in Firestore
  → worker/cron claims pending record transactionally
  → re-check recipient access and preferences
  → render email
  → Resend send with deterministic idempotency key
  → persist provider message ID/status
  → verified webhook updates delivery state
```

- Never send email directly inside a Firestore transaction.
- Use an outbox record so a successful domain mutation cannot lose its notification intent.
- Idempotency keys are stable for the logical message and safe for retry.
- Webhook delivery is at least once; store and deduplicate the Resend/Svix event ID.
- Webhook events can arrive out of order; compare event timestamps before moving status backward.
- Unsubscribed or disabled notification categories are suppressed before send.
- Invitation and security email are not mixed with marketing mail.
- Notification documents use a typed category payload and a five-minute transactional claim lease. Completed and suppressed records are terminal; failed records retain a bounded `nextAttemptAt` for the scheduled retry worker.
- Invitation and assignment delivery is active. Mention, reminder, announcement, and digest templates are versioned in the repository and remain dormant until their owning workflows enqueue them.
- Assignment intent is created atomically with the task mutation only for newly added internal assignees. The delivery worker re-checks active membership, project assignment, task existence, archive state, and current assignment immediately before sending.
- `/api/resend/webhook` verifies the untouched request body with `RESEND_WEBHOOK_SECRET` and the three `svix-*` headers before parsing. Operational events are deduplicated by a hashed event ID and update the separate provider delivery state only when their timestamp is newer; engagement events are ignored. Provider outcomes never make an already-submitted outbox item retryable.
- Bounce and complaint events create a deterministic, hashed-email suppression record. Non-essential mail checks this suppression plus the recipient's current category preference immediately before send; invitations bypass editable preferences and recipient suppression.
- Personal timezone and email preferences live in the server-controlled `users/{uid}/preferences/notifications` document. Legacy onboarding `digest` booleans are interpreted as `weekly` or `off` until the user saves the versioned preference record.
- Vercel invokes `GET /api/cron/notifications` once daily at 16:00 UTC with `Authorization: Bearer ${CRON_SECRET}`; authenticated `POST` remains available for manual operational verification. The route is Node-only, fails closed when the secret is absent, and never accepts browser identity. The Hobby schedule may run anywhere within the configured hour, so delivery times are approximate.
- Scheduled reminders use permanent deterministic IDs. Timed deadlines are eligible from the persisted last-completed boundary through 24 hours after the frozen cycle boundary; this includes recently due work if Vercel invokes the next daily run late. Date-only deadlines use the same recipient-local calendar range. Daily digests are eligible once per recipient-local date and weekly digests once on the recipient's local Monday. Repeated runs are safe because each logical reminder/digest has a deterministic ID.
- Scheduler work is bounded and resumes at organization/member boundaries. A cycle freezes `windowStartAt` and `windowEndAt` while cursors remain, and advances `lastCompletedAt` only after the full organization scan completes. Replaying a partially processed member is safe because notification creation is transactional and deterministic. Job state is stored under `systemJobs/notifications`, individual runs under `systemJobRuns/{runId}`, and completion/failure is also written to each processed organization's append-only audit trail.
- Retry scans select failed outbox records whose `nextAttemptAt` is due. Delivery still claims each message transactionally and re-authorizes the recipient immediately before sending.
- Automatic check-in delivery joins this scheduler after Feature 32 introduces versioned check-in definitions; until then the run count explicitly reports zero check-ins.

## AI Agent Architecture

```text
invocation
  → authorize actor and agent
  → build least-privilege project context
  → run model with structured schema
  → validate proposed tool calls
  → read-only result OR approval request
  → human approval
  → re-authorize and execute exactly once
  → audit result
```

Agents cannot access Firebase Admin, Resend, or connector credentials directly. They receive named tools that enforce authorization, schema validation, rate limits, and audit logging.

Approval records contain action type, normalized arguments, risk summary, requester, status, expiry, approver, timestamps, and execution result. Approval does not bypass authorization: permissions are checked again immediately before execution.

## Data Flow Examples

### Start Timer

```text
member selects task
  → server verifies session, membership, project, assignment, task
  → reject missing task for non-admin
  → transaction checks users/{uid}/runtime/activeTimer
  → create project active timer + global pointer + audit event
  → UI displays server-started timestamp
```

### Stop Timer

```text
user stops timer
  → transaction reads active timer
  → server calculates end and duration
  → create time entry
  → remove active timer + global pointer
  → enqueue notification only if policy requires
```

### Client Reads a Project

```text
verify client session
  → verify active organization membership and project assignment
  → query only client-visible content
  → independently authorize file URLs and nested records
```

## Migration Strategy

1. Snapshot current behavior with build and auth/task smoke tests.
2. Add Firebase Admin and server sessions without changing existing UI behavior.
3. Create organization/project collections and security rules beside legacy collections.
4. Bootstrap each existing user into a personal organization and migration project.
5. Copy or transform legacy tasks only through the preview-first, idempotent migration. Deterministic destination IDs and `migrationSource` metadata prevent duplicates; the source remains untouched. Runs are bounded and resumable, lock to the first selected target project, and record created/already-migrated/skipped/conflict/remaining reconciliation counts.
6. Keep legacy reads available behind a temporary compatibility layer.
7. Cut features to project collections one slice at a time; remove legacy writes after verification.

## Architecture Invariants

- Every collaborative record belongs to exactly one organization; project content also belongs to exactly one project.
- The server derives identity from a verified Firebase session.
- Client role and visibility are independent checks; both must pass.
- New content is internal by default.
- Non-admin active timers always reference a saved task.
- New timers may reference only unfinished, non-archived tasks. The default To-dos view hides completed work while retaining an explicit Done filter for review and reopening.
- A user has at most one active timer globally.
- Duration is calculated on the server and cannot be negative.
- Resend secrets, Firebase Admin credentials, connector tokens, and AI keys never reach the browser.
- Email and webhooks are idempotent and auditable.
- Consequential AI actions require approval and re-authorization.
- Security Rules and server authorization are tested in the Firebase Emulator Suite.
- Every meaningful action has a namespaced, correlated audit event; transactional changes and their successful audit record commit atomically.
- Audit events are append-only, redacted, server-authored, and inaccessible to clients in the initial release.
