# Time Log — Library Docs

This file records project-specific usage, not a substitute for upstream documentation. APIs and platform behavior change; verify the official documentation immediately before implementation.

## Authority Order

1. Explicit product and architecture decisions in `context/`
2. Installed project skills or connected documentation tools
3. Current official vendor documentation
4. This project's pinned-version patterns
5. General knowledge

## Next.js

**Installed:** Next.js 16.3.5 with React and React DOM 19.3.0.

Official references:

- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [App Router documentation](https://nextjs.org/docs/app)

Project rules:

- Next.js 16 requires Node.js 20.9+ and TypeScript 5.1+.
- Use the official upgrade codemod for the 15 → 16 transition.
- Next.js 16 uses Turbopack by default for development and builds.
- Remove the obsolete `next lint` script and configure ESLint CLI.
- ESLint uses the flat configuration in `eslint.config.mjs`; run it with `npm run lint`.
- `react-hooks/set-state-in-effect` remains a warning for legacy editable components. Refactor those flows as their domains move to the project model; do not add new violations.
- Keep App Router. Do not introduce Pages Router.
- Confirm current request/cookie APIs while implementing secure sessions.

## Firebase Client SDK

**Used for:** browser sign-in state, permitted client-side reads/realtime listeners, and authenticated Storage transfers.

```typescript
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const app = getApps().length ? getApps()[0] : initializeApp(config);

export const clientAuth = getAuth(app);
export const clientDb = getFirestore(app);
export const clientStorage = getStorage(app);
```

Rules:

- Browser Firebase configuration is not a secret; access control lives in authentication and Security Rules.
- Do not use `currentUser` as a server identity source.
- Client listeners must unsubscribe on cleanup.
- Prefer server/domain mutations for collaborative data even if Firestore permits direct browser SDK writes.

Official references:

- [Firebase web setup](https://firebase.google.com/docs/web/setup)
- [Firestore web documentation](https://firebase.google.com/docs/firestore)

## Firebase Admin SDK

**Used for:** server session verification, privileged Firestore operations, user/invitation administration, and short-lived file access.

```typescript
import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function getAdminApp() {
  return getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
}

export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp());
```

Rules:

- Module is server-only.
- `server-only` is installed as a runtime boundary marker for privileged modules.
- The canonical three-variable service-account configuration is validated lazily on first privileged use so builds do not require production secrets.
- All three `FIREBASE_ADMIN_*` variables are required together. Application Default Credentials and the legacy `FIREBASE_*` names are not fallback paths.
- Use `getAdminAuth()` and `getAdminDb()`; do not initialize another Admin app or export eagerly constructed services.
- Verify Firebase ID tokens or session cookies before trusting a `uid`.
- Session-cookie verification checks revocation by default. ID-token verification does not add the revocation network request unless the caller explicitly requests it.
- Convert decoded credentials into the minimal `AuthActor`; organization/project roles are loaded from Firestore and are never accepted from browser input.
- Exchange only a recently authenticated ID token (five-minute maximum age) for the `time_log_session` cookie.
- The session cookie lasts five days and is `httpOnly`, `SameSite=Lax`, path-wide, high priority, and `Secure` outside local development.
- Session exchange and clearing accept same-origin JSON requests only. Never place ID tokens or session values in URLs, logs, or audit metadata.
- Normal logout is current-browser only: expire the application cookies, sign out the Firebase browser client, then use full document replacement to reset user-scoped memory. Account-wide refresh-token revocation requires a separate explicit “Log out everywhere” action.
- `/api/auth/logout` is idempotent. A retry after cookies are already absent still succeeds.
- Next.js 16 `cookies()` is asynchronous. Read or mutate cookies only through awaited server APIs in Server Components, Server Functions, or Route Handlers.
- `proxy.ts` may redirect when the cookie is absent, but protected layouts and mutations must still perform cryptographic verification.
- Admin SDK bypasses Firestore/Storage Rules; every domain operation must enforce authorization itself.
- Keep organization/project membership in Firestore. Use custom claims only for coarse, stable platform-level privileges.

Official references:

- [Verify Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Manage Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Firebase Admin authentication](https://firebase.google.com/docs/auth/admin)
- [Custom claims guidance](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Next.js cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

## Cloud Firestore

Collaborative records use these paths:

```text
organizations/{organizationId}
organizations/{organizationId}/members/{uid}
organizations/{organizationId}/clients/{clientId}
organizations/{organizationId}/invitations/{invitationId}
organizations/{organizationId}/projects/{projectId}
organizations/{organizationId}/projects/{projectId}/projectMembers/{uid}
```

Membership and project-assignment document IDs are Firebase UIDs. Client companies are separate records, and a membership with role `client` must reference a `clientId`.

Personal organization bootstrap:

- Runs from the verified protected layout through `ensurePersonalOrganization`.
- Derives a stable opaque organization ID from a SHA-256 digest of the Firebase UID; never expose the UID in a slug.
- Creates the personal organization, active admin membership, `migrations/legacy-user-v1` marker, missing `users/{uid}/preferences/workspace` selection, and audit event in one transaction.
- Reads every conditional record before issuing writes because Firestore may retry transaction callbacks.
- Repairs missing records only. Ownership, membership, or migration conflicts fail safely and are audited; existing active selection is preserved.
- Defaults organization timezone to UTC and onboarding state to `not_started`; personalized onboarding replaces those defaults later.
- Treats `activeOrganizationId` as navigation state only. Every read and mutation must independently load and validate membership.

Personalized onboarding:

- Store resumable state at `organizations/{organizationId}/onboarding/{uid}`, not under the browser-writable legacy user tree.
- Server Actions re-verify the httpOnly session, validate commands with step-specific Zod schemas, and execute mutations with the audited transaction boundary.
- Profile defaults are browser timezone, weekdays, and 09:00–17:00; the server independently validates IANA timezone and time ordering.
- Security and invitation mail are mandatory and therefore absent from editable preference fields.
- The first project uses deterministic ID `onboarding-first`, key `FIRST`, `internal` default visibility, and enabled tools `todos` and `time`.
- Dashboard routing checks organization onboarding state server-side. Active selection is never an authorization input.

Transactions protect business invariants:

```typescript
await adminDb.runTransaction(async (transaction) => {
  const activeSnapshot = await transaction.get(activePointerRef);
  if (activeSnapshot.exists) {
    throw new ActiveTimerConflictError();
  }

  transaction.create(projectTimerRef, timerRecord);
  transaction.create(activePointerRef, pointerRecord);
});
```

Rules:

- A transaction callback may run more than once; do not send email, call AI, upload files, or invoke connectors inside it.
- Use `FieldValue.serverTimestamp()` for audit timestamps.
- Use deterministic document IDs where idempotent create semantics help.
- Add pagination and index definitions with any collection query.
- Test Security Rules in the Emulator Suite before deployment.
- Collaborative browser writes are denied. Mutations go through authenticated server operations, which must apply the same domain capability checks because the Admin SDK bypasses Rules.
- Active admins have organization-wide project access. Active members and clients require an active `projectMembers/{uid}` assignment. Suspended users are denied.
- Client users may read only their linked client company and assigned projects. Content visibility remains an independent `internal` / `client-visible` policy for later project resources.
- Legacy owner access under `users/{uid}` remains in place until the explicit migration feature.

Project visibility pattern:

- Use `domain/visibility/schemas.ts` for the canonical values and `DEFAULT_VISIBILITY`; never duplicate visibility string unions in feature domains.
- Apply the explicit `deny` / `all` / `client-visible` result from `visibilityForQuery` before reading project collections. Firestore Rules are not filters: client list queries must include `where("visibility", "==", "client-visible")`, while `deny` must not issue a query.
- Check active membership and project assignment independently with `canReadVisibleRecord`; a client-visible value never grants project access.
- Pass client responses through `serializeVisibleRecordForClient` with a feature-owned Zod allowlist schema. Do not serialize a complete Firestore record and remove fields afterward.
- Feature repositories provide a server-only `VisibilityRecordAdapter` to `changeRecordVisibility`; the shared service re-authorizes project access, rejects clients and read-only projects, and atomically records `visibility.record.changed` without storing content.

Client portal project access pattern:

- Client project discovery starts from active `projectMembers` assignments using the `projectMembers` collection-group index on `userId` and `status`; discard references outside the verified active organization before loading projects.
- Direct project routes independently re-read active membership and the exact project assignment. Project-list membership never substitutes for route authorization.
- Client tool navigation is allowlisted in `domain/projects/client-tools.ts`. A tool appears only after its client-safe repository is implemented and a server query confirms client-visible content.
- Unsupported, disabled, empty, internal-only, and inaccessible tool routes use the same non-disclosing not-found behavior for clients.
- Internal users continue to see every enabled tool. Client availability checks must not change internal navigation or expose internal record counts.

Project task persistence pattern:

- Canonical task documents and commands live in `domain/tasks/schemas.ts`; collaborative task code must not import legacy daily-task types.
- `TaskRepository.list` requires an explicit visibility query scope, defaults to non-archived tasks, orders by `sortOrder`, and caps every request at 100 records.
- Task writes run through `domain/tasks/service.ts`, which re-authorizes the actor and active project, validates every assignee, checks parent ancestry, and writes the audit event transactionally.
- Assignees must be active internal admins/members with project access. Clients cannot be assigned in the initial release.
- Use `taskVisibilityAdapter` for standalone visibility controls so visibility changes reuse the shared audited visibility service.
- Client task queries constrain both `visibility == "client-visible"` and `archivedAt == null`; Firestore Rules are not filters.
- Task server actions live beside the `/todos` route, accept plain structured values, derive actor and organization from the verified session, generate correlation IDs server-side, revalidate only the project task route, and return provider-safe errors.
- Convert task timestamps and redact client-ineligible fields with `domain/tasks/form-data.ts` before crossing the Server/Client Component boundary.
- Use `components/ui/date-time-picker.tsx` for optional task deadlines. It composes the shadcn Calendar, Popover, Checkbox, and project TimePicker; `dueTimeSet` preserves whether the user intentionally supplied a clock time.
- Project task creation uses an optimistic client row with a temporary ID. Reconcile it with the server-returned task ID after the audited transaction succeeds; remove it and preserve a safe error when persistence fails.
- Internal task reads may request archived records for the explicit Archived view. Client queries must continue to constrain `archivedAt == null` and never disclose archived counts.
- My Work starts from `listAccessibleProjects`, retains only active projects with To-dos enabled, then issues bounded per-project task queries constrained by the current user's `assigneeIds`. Completed and archived tasks are removed before grouping; never use a collection-group task query without independently preserving project authorization.
- Group My Work deadlines with the organization's configured timezone. Prefer the timezone-free `dueDate` field; only derive a calendar date from `dueAt` for compatibility with older timed deadlines.
- Legacy task migration reads only the authenticated user's `users/{uid}/daily_tasks` and `daily_subtasks`, validates records with permissive source/strict supported-field schemas, and never mutates those collections.
- Destination IDs are deterministic SHA-256-derived IDs scoped by user, source collection, and source document ID. Every migrated task stores `migrationSource`; retries verify this metadata before treating an existing destination as already migrated.
- Migration transactions are capped at 350 task writes so the destination records, migration marker, and correlated audit event remain within Firestore transaction limits. Large migrations return `pending` and continue safely in another run.
- The first successful run locks the marker to its target project. Conflicting destination IDs and malformed/orphaned source records are skipped and reported; they are never overwritten or silently described as reconciled.

Official references:

- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)

## Audit Events

**Path:** `organizations/{organizationId}/auditEvents/{eventId}`

Project pattern:

- Use the closed action registry in `domain/audit/actions.ts`; do not persist ad hoc action strings.
- Generate request and run IDs on the server with `domain/audit/correlation.ts`. Never trust a browser-provided correlation ID.
- Pass untrusted change candidates through `redactAuditChanges`. The event schema independently enforces the same per-action field allowlist and safe value types.
- Successful Firestore mutations use `executeAuditedCommand`, which creates the audit document in the same transaction.
- Denied and failed actions are appended through the server-only repository before returning. If that audit write fails, return a safe internal error rather than claiming the action was completely handled.
- `AuditRepository` exposes create operations only. Browser reads and all browser writes remain denied; the later activity viewer must use an authorized server query.
- Use `FieldValue.serverTimestamp()` for `occurredAt`. Event schema version 1 is immutable after release; incompatible changes require a new version.
- Authentication action names exist in the registry, but events remain organization-scoped. Wire them only after the command has a verified organization context.

Never include free text, email addresses, filenames, URLs, request bodies, authorization material, session values, raw provider payloads, chat/file content, or prompts in an event. The initial safe-value set is limited to enumerated roles/statuses/visibility values and booleans.

## Cloud Storage for Firebase

**Path:** `organizations/{organizationId}/projects/{projectId}/files/{fileId}/{safeFilename}`

Rules:

- Keep the bucket private.
- Store authorization metadata in Firestore and validate access before download.
- Security Rules must restrict path, membership, size, and content type.
- Never rely solely on a filename extension or browser-provided MIME type.
- Do not store permanent public URLs for project files.
- File metadata has its own visibility value.

Official references:

- [Cloud Storage for Firebase](https://firebase.google.com/docs/storage/)
- [Storage Security Rules](https://firebase.google.com/docs/storage/security)

## Resend

**Used for:** transactional invitations, assignments, mentions, reminders, announcements, check-ins, and digests.

**Installed:** `resend` 6.28.1.

```typescript
import "server-only";
import { Resend } from "resend";

export const resend = new Resend(env.RESEND_API_KEY);
```

Sending happens through the outbox worker:

```typescript
const { data, error } = await resend.emails.send(
  {
    from: env.RESEND_FROM_EMAIL,
    to: [recipient.email],
    subject,
    html,
  },
  { idempotencyKey },
);

if (error) {
  return { ok: false, code: "provider_error" as const };
}
```

Confirm the exact SDK call signature against the installed version before coding.

Rules:

- API key and webhook secret are server-only.
- Verify the sending domain before production.
- Use deterministic idempotency keys. Resend documents a 24-hour idempotency window, so the application also stores logical send state permanently.
- Webhooks are at least once and not ordered. Deduplicate `svix-id` and compare event timestamps.
- Verify the webhook from the raw body before parsing or processing.
- Store provider message IDs and delivery status; never expose them to ordinary users.
- Resend is selected for outbound notification mail. Verify inbound-email requirements before implementing Email Forwards.
- Invitation creation writes `organizations/{organizationId}/notifications/{invitationId}` in the same transaction as the hashed invitation. Provider delivery happens afterward through `deliverNotification`; failures retain durable retry state.
- Invitation mail uses deterministic key `invitation/{invitationId}` and stores provider identifiers only in the server-only notification record.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are validated lazily on the server. `NEXT_PUBLIC_APP_URL` is mandatory in production and defaults to `http://localhost:3000` only in development. The API key never enters a client module.

Official references:

- [Send email API](https://resend.com/docs/api-reference/emails/send-email)
- [Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Webhooks](https://resend.com/docs/webhooks/introduction)

## Zod

**Used for:** all untrusted input and typed environment validation.

```typescript
import { z } from "zod";

export const startTimerSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  taskId: z.string().min(1).nullable(),
  note: z.string().trim().max(500).nullable(),
}).strict();
```

The schema validates shape only. Authorization and the non-admin task rule remain domain policy because they depend on the actor and stored records.

## React Hook Form

- Use with `@hookform/resolvers/zod` for interactive client forms.
- The server validates again with the same or stricter command schema.
- Map stable domain error codes to field/form errors.
- Disable duplicate submits while pending; retain user input on recoverable errors.

## Tailwind CSS v4 and shadcn/ui

- Tokens live in `app/globals.css` using CSS custom properties and `@theme inline`.
- Reuse existing `components/ui` primitives.
- Use `cn()` from `lib/utils.ts` for conditional class composition.
- Do not add a Tailwind config solely for colors.
- Follow `ui-tokens.md`, `ui-rules.md`, and `ui-registry.md`.
- Use the project `TimezoneCombobox` composition (`Popover` + `Command`) for searchable IANA timezone selection; native `datalist` behavior is not consistent enough for this workflow.
- Use the project `TimePicker` composition for standalone working-hour values. It displays hour, minute, and AM/PM shadcn `Select` controls while emitting the domain's canonical 24-hour `HH:mm` value.

## date-fns

- Use for display and calendar arithmetic.
- Store Firestore timestamps as absolute instants and explicit user/organization timezone preferences separately.
- A date-only task deadline must remain a date concept; do not accidentally convert it through the server's local timezone.
- Scheduled notifications must evaluate in the recipient or configured organization timezone.

## AI Provider

No provider/model is selected yet. At implementation time:

- choose a provider behind a project-owned adapter;
- use structured output validated by Zod;
- record provider, model, prompt version, usage, and run status;
- enforce timeouts, rate limits, and bounded retries;
- never give the model credentials or raw database access;
- keep consequential tool calls behind the approval workflow.

Do not add a hard-coded model name to context or production code until the provider decision is recorded.

## Testing Libraries

- Vitest 4.1.11 for domain/unit tests. It is pinned during the Next.js 15 baseline because Vitest 5 requires newer Node type definitions than the repository currently declares.
- React Testing Library for component behavior.
- Playwright for core browser journeys. `npm run test:e2e` starts or reuses the local Next.js server, uses installed Chrome locally, and uses Playwright Chromium in CI.
- Firebase Emulator Suite for Firestore and Storage Rules.
- Firestore Rules tests use `@firebase/rules-unit-testing` and run with `npm run test:rules` against the demo project `demo-time-log`. The local Firebase emulator requires Java on `PATH`; use Java 21 to satisfy the current/future emulator requirement.

The initial Vitest configuration uses the Node environment and `@/` alias. Add DOM/browser dependencies only when the first component test requires them.

The initial Playwright authentication suite covers signed-out protected redirects, hostile return-path containment, and current-browser cookie expiration. Google popup authentication remains a manual smoke test until a dedicated Firebase test environment is available; never place production credentials or captured session state in test fixtures.
