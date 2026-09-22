# Memory — Storage Hold and Message Board

Last updated: 2026-09-21 15:25 America/Los_Angeles

## What was built

- Feature 26 Firebase Storage and File Metadata was implemented, tested, and then disabled because the Firebase project requires a pricing-plan upgrade. The implementation remains in `domain/files/`, `components/files/`, the project Docs route, Storage/Firestore Rules, and Firebase configuration.
- A centralized unavailable-tool policy in `domain/projects/tools.ts` now hides Docs & Files from project navigation, overview, settings, and client discovery. Direct Docs access, file mutations, and downloads fail closed while existing project configuration is preserved.
- Feature 27 Message Board was implemented under `domain/messages/`, `components/messages/`, and `app/(app)/projects/[projectId]/messages/`.
- Message Board includes project posts, nested comments, author editing, edited markers, administrator moderation and pinning, soft archive/restore, explicit post visibility, internal-default internal comments, client-visible client comments, client-safe discovery, archived view, and bounded older-post pagination.
- Announcement publishing queues deterministic per-recipient Resend notifications transactionally. Delivery reauthorizes membership, project assignment, post lifecycle, and visibility immediately before sending.
- Audit actions and targets, activity filters, Firestore Rules, composite indexes, notification schemas/tests, project client-tool discovery, context documentation, and the UI registry were updated for Message Board.

## Decisions made

- Keep Storage code intact but inaccessible until a Firebase pricing upgrade is approved; do not deploy or expose the Storage workflow yet.
- Message Board attachments are deferred with Storage.
- Internal members may publish posts and comments. Clients may read and comment only on client-visible posts and cannot publish top-level posts.
- Organization/project administrators may pin content and send announcement email. Authors edit their own content; administrators moderate project content.
- Announcement email is an explicit publish-time action and is never resent by editing, pinning, or changing visibility.
- Posts and internal comments default to internal. Client comments on client-visible posts are client-visible.
- Removal uses soft archival. Archived content is internal-only.

## Problems solved

- Disabled Storage at navigation, route, client-discovery, and domain-operation boundaries rather than merely hiding controls.
- Added send-time announcement reauthorization so access or visibility changes suppress stale client email safely.
- Added isolated Firestore/Storage Rules test ports because the normal local Firestore emulator uses port 8080.
- Converted all exported Message Board server actions to explicit `async` functions to satisfy Next.js 16 production compilation.
- Added message/comment audit targets to the activity viewer and safe audit registry.

## Current state

- Feature 26 is implemented but paused and disabled.
- Feature 27 is implemented and awaiting authenticated browser verification.
- Automated verification: 204 unit tests, 23 Rules tests, TypeScript, production build, and lint with 28 pre-existing warnings pass.
- Message attachments are unavailable by design.
- The working tree contains the uncommitted Feature 26 hold and Feature 27 changes; preserve them.
- Firestore Rules and indexes for Message Board have not yet been deployed.

## Next session starts with

1. Run `/remember restore` and confirm this state.
2. Deploy only Message Board Firestore changes with `npx firebase deploy --only firestore:rules,firestore:indexes`.
3. Enable Message Board for a test project.
4. Browser-test organization admin, project admin, member, and client behavior: publish, comment, edit, pin/unpin, visibility, archive/restore, pagination, and direct-route denial.
5. Publish one test announcement and verify eligible recipients, preference suppression, client visibility, idempotency, delivery state, and audit events.
6. After successful verification, mark Feature 27 complete and begin Feature 28 Calendar.

## Open questions

- When, if ever, should the Firebase project be upgraded so Storage and Message Board attachments can be enabled?
- Browser verification may reveal whether the Message Board composer and inline controls need compactness or mobile-layout refinement.
