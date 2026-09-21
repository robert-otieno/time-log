# Time Log — UI Rules

## Experience Principles

- Make the current project, task, timer, and visibility state obvious.
- Keep frequent actions fast; keep consequential actions deliberate.
- Show clients a calm, intentionally shared portal—not an internal UI with hidden buttons.
- Prefer progressive disclosure over displaying every project tool at once.
- Preserve keyboard access and responsive usability from the first implementation.

## Application Shell

- Desktop uses a sticky top header and collapsible left sidebar.
- Header contains organization/project context, global search/command access, active timer, theme/profile, and logout.
- Sidebar contains My Work, Projects, People/Admin when permitted, and the selected project's enabled tools.
- Mobile uses the existing sheet/sidebar primitive; the active timer must remain reachable without opening multiple layers.
- The project shell is shared by internal and client experiences, but navigation is built from authorization-aware capabilities.

## Page Layout

- Main content is centered with responsive gutters and an appropriate max width.
- List-heavy pages may use full available width; reading-heavy docs/messages remain narrower.
- Page header: title and context on the left, primary action on the right, filters below when needed.
- Use one clear primary action per view.
- Use right-side sheets for quick task/time details when the user should retain list context; use full pages for complex tools.

## Authentication

- Login presents Time Log branding and one clear Google sign-in action initially.
- Show explicit pending state while popup/token/session exchange completes.
- Preserve only validated internal return paths.
- On logout, immediately disable protected actions and show a neutral transition to `/login`.
- Auth errors are actionable and do not reveal provider internals.

## Onboarding

- Use a short resumable sequence with progress: profile → organization → first project → first task/timer.
- Pre-fill known Firebase profile information.
- Explain why timezone and notification choices matter.
- Invitations are optional during onboarding; “do this later” must be visible.

## Projects

- Always show project name near tool navigation.
- Archived/on-hold states are visible and disable inappropriate mutations.
- Enabled tools determine navigation; disabled tools do not show empty placeholders.
- Project creation starts with a blank project or a template, then reviews name/client/tools before creation.

## To-Dos

- Optimize the collapsed row for completion and title only; disclose description, metadata, and secondary actions when the row is opened.
- Render tasks as one divided list, with subtasks indented beneath their parent rather than placed in nested cards.
- Only one task row is expanded at a time. Expansion is a readable details state; editing is a separate explicit action.
- Inline editing is appropriate for low-risk fields. Use a sheet/dialog for attachments, audit, and complex destructive workflows.
- Task create supports keyboard submit and preserves input on recoverable errors.
- Completed tasks are visually quieter but remain readable.
- Filters have visible active state and a one-action reset.
- Empty state points to creating the first task or clearing filters, whichever applies.

## Time Tracking

- Starting a timer is a two-step compact interaction: choose project/task, then confirm start. Inline task creation may satisfy task selection.
- For non-admins, disable start until a saved task is selected and explain why.
- Admin project-only tracking is labeled clearly so it is not mistaken for task-linked work.
- Show one global active timer with task, project, elapsed time, stop, and optional note.
- Use server `startedAt` as the source; do not increment persisted state every second.
- When another tab owns an active timer, show that timer rather than a generic conflict.
- Stopping opens a lightweight review only when required fields remain; it should not risk losing the recorded interval.
- Manual entry clearly distinguishes duration entry from start/end entry and prevents contradictory values.

## Visibility and Client Safety

- Use exact labels `Internal` and `Client visible` everywhere.
- The control includes a lock/users icon and text; color is supplementary.
- New records show `Internal` by default.
- Changing to client-visible may show a concise confirmation when nested/internal content could remain hidden.
- Client users never see internal placeholders, redacted counts, locked rows, disabled internal controls, or gaps suggesting hidden content.
- Preview-as-client is useful for admins but never replaces server authorization tests.

## People and Roles

- Distinguish member and client invitations before collecting project access.
- Show role, status, assigned projects, and last invitation/delivery state.
- Role changes explain impact before save.
- Suspension/removal uses confirmation and identifies affected access; prevent removal of the last admin.

## Notifications and Email

- Preferences group categories by purpose and identify mandatory security/invitation messages.
- Delivery status is admin-only operational metadata unless the user needs action.
- Do not display raw provider errors; use retry/contact-admin guidance.
- Email previews use the same client-safe serialization as actual sends.

## Activity and Audit Trail

- Organization admins receive a dedicated Activity page with filters for date, actor, action, outcome, project, and target type.
- Use human-readable summaries while preserving a canonical action code in expandable technical details.
- Show actor, action, target, outcome, project, and timestamp in each row; display changed field names without revealing redacted values.
- Successful, denied, and failed outcomes must be distinguishable by icon and text, not color alone.
- Use cursor pagination; never load the full organization history into the browser.
- Audit exports require confirmation, explain their sensitivity, and show an export-in-progress state.
- Members may see filtered project activity only when authorized. Clients do not see the internal audit trail in the initial release.
- Do not describe raw console output or product analytics as an audit log.

## AI Agents and Approvals

- Separate drafts/read-only output from proposed actions.
- Approval cards state: agent, requester, exact action, target, important arguments, external effect, expiry, and risk.
- Approve and reject are explicit; bulk approval is excluded initially.
- AI-created content starts internal and carries an “AI draft” label until reviewed.
- Never imply an action occurred until the audited execution succeeded.

## Forms

- Labels remain visible; placeholders are examples, not labels.
- Required fields are indicated consistently.
- Validate on submit and on blur only when correction is helpful.
- Place field errors near fields and a summary near the submit action for multi-field failures.
- Disable duplicate submission but do not erase values.

## Loading, Empty, Error, and Permission States

- Use skeletons when structure is known and a spinner only for compact actions.
- Empty states explain why the area is empty and offer one logical next action.
- Error states preserve context and offer retry when safe.
- Permission denial uses a dedicated message and navigation path; do not masquerade it as a missing record for internal users. For clients, use non-disclosing not-found behavior when appropriate.

## Tables and Lists

- Use sticky headers only when they materially improve long lists.
- Keep row actions in a predictable trailing position.
- Support pagination/cursor loading before lists become unbounded.
- On mobile, convert dense tables to structured cards rather than horizontal scrolling for primary workflows.

## Accessibility

- Meet WCAG 2.2 AA contrast and keyboard expectations.
- Maintain logical heading order and landmark regions.
- Dialogs/sheets trap focus and return it to the trigger.
- Live timer text should not announce every second. Announce start, stop, and conflict state changes politely.
- Drag-and-drop card movement has keyboard alternatives.
- Icons never stand alone without an accessible name.

## Content Style

- Use direct verbs: Create task, Start timer, Stop timer, Invite client.
- Use “client-visible,” not public/shared/external interchangeably.
- Use “to-do” for the product tool and “task” for an individual record.
- Use sentence case for headings and actions.
- Avoid celebratory or judgmental copy around time worked and overdue tasks.

## Do Nots

- Do not expose a feature because the client knows its URL.
- Do not show all tools when a project has disabled them.
- Do not make users re-enter a task description when a saved task exists.
- Do not use modal dialogs for routine navigation.
- Do not add hard-coded colors or one-off component styling.
- Do not hide critical actions behind hover-only controls.
- Do not display raw Firebase, Resend, AI, or connector errors.
- Do not let client-visible styling imply a record is accessible before the server confirms it.
