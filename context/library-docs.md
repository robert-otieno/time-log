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
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const adminApp =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
```

Rules:

- Module is server-only.
- Verify Firebase ID tokens or session cookies before trusting a `uid`.
- Admin SDK bypasses Firestore/Storage Rules; every domain operation must enforce authorization itself.
- Keep organization/project membership in Firestore. Use custom claims only for coarse, stable platform-level privileges.

Official references:

- [Verify Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase Admin authentication](https://firebase.google.com/docs/auth/admin)
- [Custom claims guidance](https://firebase.google.com/docs/auth/admin/custom-claims)

## Cloud Firestore

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

Official references:

- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)

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

## Testing Libraries (Planned)

- Vitest 4.1.11 for domain/unit tests. It is pinned during the Next.js 15 baseline because Vitest 5 requires newer Node type definitions than the repository currently declares.
- React Testing Library for component behavior.
- Playwright for core user journeys.
- Firebase Emulator Suite for Firestore and Storage Rules.

The initial Vitest configuration uses the Node environment and `@/` alias. Add DOM/browser dependencies only when the first component test requires them.
