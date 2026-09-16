# Time Log — Agent Instructions

These instructions apply to the entire repository.

## Required Context Review

Before planning, editing code, installing dependencies, changing configuration, or running a migration, read every file in `context/` in this order:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/build-plan.md`
4. `context/progress-tracker.md`
5. `context/code-standards.md`
6. `context/library-docs.md`
7. `context/ui-tokens.md`
8. `context/ui-rules.md`
9. `context/ui-registry.md`

Do not rely on a previous session's memory of these files. Re-read them at the start of each implementation session because they are living project documents.

The files in `context/` are the project source of truth. Existing code may reflect the legacy personal productivity application and must not override the documented Time Log architecture.

## Before Implementing

- Inspect the current repository and Git status before making changes.
- Identify the active numbered feature from `context/progress-tracker.md` and its requirements in `context/build-plan.md`.
- Confirm the work respects the product vocabulary, role model, client visibility rules, audit requirements, and architecture invariants.
- Read the relevant section of `context/library-docs.md` before using a third-party library, then verify unstable APIs against current official documentation.
- Check `context/ui-registry.md` before creating or styling a component. Reuse existing patterns where appropriate.
- Do not begin a later phase when an unfinished prerequisite would make the implementation insecure or disposable.

## Implementation Rules

- Work on one numbered build-plan feature at a time unless the user explicitly changes the scope.
- Preserve unrelated user changes and legacy behavior unless the active feature deliberately migrates it.
- Treat authentication, organization/project scoping, client visibility, and audit logging as mandatory domain rules—not optional UI behavior.
- New collaborative data must use the organization/project architecture. Do not extend legacy `users/{uid}` collections for new team features.
- Every meaningful application action must produce the redacted, append-only audit event described in the context files.
- New and AI-generated content defaults to `internal` visibility.
- Consequential AI actions require approval and re-authorization.
- Never expose Firebase Admin credentials, Resend secrets, connector tokens, AI keys, or other server-only values to the browser.
- Follow `context/code-standards.md` for validation, errors, tests, dependencies, and file conventions.

## Verification and Documentation

Before marking a feature complete:

- Verify its success, failure, permission-denied, and relevant client-visibility behavior.
- Run the smallest relevant checks during development and all applicable lint, typecheck, test, rules-test, and build commands before handoff.
- Update `context/progress-tracker.md` with the completed feature, verification summary, decisions, blockers, and next action.
- Update `context/ui-registry.md` after adding or materially changing reusable UI patterns.
- Update `context/library-docs.md` when introducing a dependency or establishing a project-specific integration pattern.
- Update architecture or product context when implementation reveals an approved change to those decisions.

If the requested work conflicts with the context files, stop and explain the conflict before implementing. The user's explicit current instruction may change project direction, but the corresponding context files must be updated as part of that change.
