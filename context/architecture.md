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

Onboarding persists a versioned, organization-scoped record per user. Each step is an authenticated, validated, audited transaction. The deterministic `onboarding-first` project prevents duplicate first projects, and completing education atomically changes the organization onboarding state to `complete`.

#### Membership

```typescript
type OrganizationMember = {
  userId: string;
  role: "admin" | "member" | "client";
  status: "invited" | "active" | "suspended";
  clientId: string | null;
  joinedAt: Timestamp | null;
};
```

Project assignment is explicit. Organization membership alone does not grant a client access to every project.

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
  dueAt: Timestamp | null;
  visibility: "internal" | "client-visible";
  boardColumnId: string | null;
  sortOrder: number;
  completedAt: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

#### Active Timer and Time Entry

```typescript
type ActiveTimer = {
  userId: string;
  organizationId: string;
  projectId: string;
  taskId: string | null; // null only when actor was an admin at start
  startedAt: Timestamp;
  note: string | null;
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
  note: string | null;
  billable: boolean;
  clientReportingStatus: "internal" | "approved";
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

One-active-timer enforcement requires a transaction and a global pointer at `users/{uid}/runtime/activeTimer` referencing the project timer. Do not rely on a UI check; concurrent tabs must not create two timers.

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
5. Copy or transform legacy tasks only through an idempotent migration with reconciliation counts.
6. Keep legacy reads available behind a temporary compatibility layer.
7. Cut features to project collections one slice at a time; remove legacy writes after verification.

## Architecture Invariants

- Every collaborative record belongs to exactly one organization; project content also belongs to exactly one project.
- The server derives identity from a verified Firebase session.
- Client role and visibility are independent checks; both must pass.
- New content is internal by default.
- Non-admin active timers always reference a saved task.
- A user has at most one active timer globally.
- Duration is calculated on the server and cannot be negative.
- Resend secrets, Firebase Admin credentials, connector tokens, and AI keys never reach the browser.
- Email and webhooks are idempotent and auditable.
- Consequential AI actions require approval and re-authorization.
- Security Rules and server authorization are tested in the Firebase Emulator Suite.
- Every meaningful action has a namespaced, correlated audit event; transactional changes and their successful audit record commit atomically.
- Audit events are append-only, redacted, server-authored, and inaccessible to clients in the initial release.
