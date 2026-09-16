# Time Log — Code Standards

These standards apply to new work and touched code. Do not perform unrelated rewrites solely to make legacy files conform.

## Engineering Rules

- Read `project-overview.md`, `architecture.md`, the active build-plan feature, and `progress-tracker.md` before implementing.
- Preserve security boundaries even when a client-side shortcut appears easier.
- Build one verified vertical slice at a time.
- Prefer simple domain functions and explicit policy over generic frameworks.
- Treat email, webhooks, cron, AI, connectors, and uploaded files as untrusted boundaries.
- Never mark a feature complete without testing its denied/failed states.

## TypeScript

- Keep `strict: true`.
- Do not use `any`; accept `unknown` and validate/narrow it.
- Prefer `type` for domain shapes and unions; use `interface` for extendable public/component contracts.
- Give exported functions explicit parameter and return types.
- Use discriminated unions for states such as result, role, visibility, notification, and approval status.
- Keep timestamps consistent. Domain persistence uses Firestore `Timestamp`; UI view models may use ISO strings after deliberate serialization.
- Do not use non-null assertions for environment variables, session actors, Firestore results, or external responses.

```typescript
export type Result<T, Code extends string = string> =
  | { ok: true; data: T }
  | { ok: false; code: Code; message: string };
```

## Naming and Files

- Folders and non-component files: kebab-case.
- React component files and exported components: PascalCase.
- Hooks begin with `use`.
- Server-only modules end in `.server.ts` when their location does not already make that obvious.
- Use `@/` imports instead of deep parent-relative paths.
- One primary component per file. Small private render helpers may remain local.
- Avoid barrel exports outside stable library boundaries.

## Next.js App Router

- Default to Server Components. Add `"use client"` only for state, effects, browser APIs, event handlers, or client-only SDKs.
- Route handlers parse and validate requests, call domain use cases, and map results to HTTP. They do not contain the workflow itself.
- Server Actions follow the same boundary and return typed results; do not throw raw errors into the client.
- Validate redirect targets and never accept arbitrary external `next` URLs.
- Keep Firebase Admin, Resend, AI provider clients, connector secrets, and service credentials in server-only modules.
- After a Next.js upgrade, follow the installed version's official documentation rather than recalled APIs.

## Components

```typescript
// external imports
// internal imports
// local types
// component
// small private helpers when needed
```

- Components render view models and emit user intent; they do not construct authorization policy.
- Use existing shadcn primitives before introducing a new primitive.
- Every interactive control has an accessible name, keyboard behavior, visible focus, disabled state, and pending state.
- Never communicate priority, role, status, or visibility by color alone.
- Destructive actions require explicit confirmation and explain their scope.
- Optimistic updates must have rollback and error feedback.

## Validation

- Zod schemas define every form command, route body, query string, webhook payload, AI structured output, and connector response used by the domain.
- Normalize strings, email addresses, URLs, dates, and optional empty fields in one place.
- Reject unknown fields for security-sensitive commands when practical.
- File validation covers server-observed size, content type, extension, and storage policy; browser checks are convenience only.

## Authentication and Authorization

- Derive the actor from a server-verified Firebase session.
- Never accept role, user ID, organization ID, or membership truth from component state.
- Every domain command takes an actor and organization/project scope.
- Load and verify the target record before mutation.
- Centralize reusable policy functions such as `canReadProject`, `canManageMembers`, and `canExposeToClient`.
- Admin capability does not bypass tenant scoping.
- Never log session cookies, ID tokens, authorization headers, invite tokens, or credentials.

## Firestore

- Use converter/repository boundaries so raw snapshots do not leak across the application.
- Use server timestamps for persisted audit fields.
- Use transactions for invariants: timer uniqueness, invitation acceptance, approval execution, counters, and state transitions.
- Keep transactions free of email, network, AI, Storage upload, or other external side effects.
- Paginate unbounded collections; do not fetch an entire organization collection to filter in memory.
- Define required composite indexes with the feature that needs them.
- Prefer archive/soft delete for collaborative records and audit changes.
- Never recursively delete tenant/project content from an ordinary UI action without a reviewed retention/export workflow.

## Visibility

- Use only the canonical values `internal` and `client-visible`.
- New and AI-generated content defaults to `internal`.
- Enforce visibility in reads, writes, searches, counts, notifications, exports, files, and AI context.
- Do not infer file/comment visibility only from the parent.
- Record actor, previous value, new value, and timestamp when visibility changes.

## Time Tracking

- Non-admin timers and manual entries require a saved task.
- One active timer per user is a transactional invariant, not UI state.
- Use the server start/end timestamps to calculate authoritative duration.
- Store duration in integer seconds.
- Reject end times before start, unreasonable duration, inaccessible task, archived project, or unauthorized user edits.
- Corrections preserve an audit trail; never silently rewrite history.

## Resend and Notifications

- Domain mutations create outbox records; workers send email after commit.
- Use deterministic idempotency keys per logical email.
- Re-check authorization, visibility, invitation state, and preferences immediately before rendering/sending.
- Keep recipient calculation out of email templates.
- Verify webhook signatures against the raw request body.
- Deduplicate webhook event IDs and tolerate events arriving out of order.
- User-facing errors never expose Resend responses or internal IDs.

## AI and Connectors

- Models receive the smallest authorized context needed for the task.
- Validate structured model output before use.
- Treat generated text and tool arguments as untrusted input.
- Models never read credentials or call provider SDKs directly.
- Consequential calls create approval requests; execution re-checks permissions and approval expiry.
- Tool execution is idempotent and audited.
- Connector OAuth scopes must be the minimum needed. Encrypt refresh/access tokens at rest and support revocation.
- Never place secrets, client data, or internal records in prompts unless the approved use case requires them.

## Errors and Logging

- Catch errors at boundaries where they can be handled, enriched, retried, or mapped; avoid catch-and-ignore.
- Log a stable context prefix, request/run ID, organization/project identifiers when safe, error category, and outcome.
- Do not log file contents, email bodies, chat bodies, prompts, tokens, or sensitive personal data by default.
- Return human-readable messages and stable error codes; do not expose raw exceptions.
- Retry only transient failures, with bounded exponential backoff and idempotency.

## Audit Events

- Audit logging is separate from diagnostic logging and analytics.
- Every meaningful domain command declares a canonical namespaced action such as `task.created`, `time.timer.started`, or `membership.role.changed`.
- Record attempts by users, admins, clients, system jobs, agents, and connectors with `succeeded`, `denied`, or `failed` outcome.
- Successful Firestore mutations write their audit event in the same transaction whenever possible.
- Audit events are append-only and server-authored. Never expose update/delete methods for them.
- Build changed-field summaries from explicit allowlists. Never serialize arbitrary request bodies or full before/after documents.
- Never audit secrets, credentials, tokens, cookies, raw email/file/chat bodies, full prompts, or connector payloads.
- Correlate events with request IDs and agent/connector/job run IDs.
- Do not create audit events for hover, focus, scroll, every keystroke, timer display ticks, or each row rendered.
- Audit access to sensitive reads and exports, including file downloads, report exports, audit exports, client preview, and credential-management screens.
- Adding a new domain command is incomplete until its audit action and redaction policy are defined and tested.

## Environment Variables

Validate environment variables once in a server-only module. Variables with `NEXT_PUBLIC_` are considered browser-visible.

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_WEBHOOK_SECRET
CRON_SECRET
APP_URL
AI_PROVIDER_API_KEY           # only after a provider is selected
CONNECTOR_ENCRYPTION_KEY      # only before connectors are enabled
```

- Never commit `.env*` secrets.
- Normalize escaped newlines in private keys only inside the validated config module.
- Fail fast on the server when a required feature configuration is absent.

## Testing

- Unit: policy, validation, time math, state transitions, idempotency key generation.
- Firebase emulator: Firestore and Storage Rules allow and deny matrices.
- Integration: session exchange, timer transactions, outbox claiming, webhook dedupe, approval execution.
- Audit: action coverage, atomic writes, denied/failed events, redaction, immutable rules, pagination, and export auditing.
- Component: forms, visibility control, timer states, accessibility behavior.
- E2E: login/logout, onboarding, task creation, timer start/stop, client isolation, invitation acceptance.
- Use deterministic clocks and IDs in tests. Do not call production Firebase, Resend, connectors, or AI.

## Commands Required Before Handoff

The repository must expose scripts for:

```text
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run build
```

Run the smallest relevant checks during development and the full applicable set before phase completion.

## Dependency Policy

- Check existing dependencies and platform APIs first.
- Add a dependency only when it removes meaningful complexity or security risk.
- Verify current official documentation and framework compatibility.
- Record approved runtime dependencies and project-specific usage in `library-docs.md`.
- Commit the lockfile change with the feature; do not modify it accidentally.
