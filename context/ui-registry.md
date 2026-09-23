# Time Log — UI Registry

Living inventory of reusable UI. Read before building a component. After creating or materially changing a reusable pattern, record its path, purpose, states, and important token/class conventions here.

## Registry Rules

1. Reuse an existing primitive before creating another.
2. Feature components may compose primitives but must not fork their styling without a product reason.
3. Record only reusable components/patterns, not every page fragment.
4. Mark legacy components that should be adapted rather than treated as the target design.
5. Exact implementation in source code remains authoritative.

## Existing UI Primitives

| Component | Path | Status / use |
| --- | --- | --- |
| Avatar | `components/ui/avatar.tsx` | Reuse for members, clients, assignees |
| Badge | `components/ui/badge.tsx` | Base for status, priority, visibility |
| Breadcrumb | `components/ui/breadcrumb.tsx` | Existing header context; reassess with project switcher |
| Button | `components/ui/button.tsx` | Canonical action styles |
| Calendar | `components/ui/calendar.tsx` | Date selection; not the complete project calendar |
| Card | `components/ui/card.tsx` | Canonical content surface |
| Checkbox | `components/ui/checkbox.tsx` | Task completion and multi-select |
| Collapsible | `components/ui/collapsible.tsx` | Expandable sidebar/sections |
| Command | `components/ui/command.tsx` | Command palette and searchable selectors |
| Dialog | `components/ui/dialog.tsx` | Confirmation and focused workflows |
| Dropdown menu | `components/ui/dropdown-menu.tsx` | Secondary row/account actions |
| Form | `components/ui/form.tsx` | React Hook Form integration |
| Input Group | `components/ui/input-group.tsx` | Preset-native compound inputs with aligned controls and addons |
| Input / Label / Textarea | `components/ui/*` | Canonical form controls |
| Popover | `components/ui/popover.tsx` | Compact selectors and date UI |
| Progress | `components/ui/progress.tsx` | Onboarding/report progress, not elapsed timer |
| Select | `components/ui/select.tsx` | Small fixed option sets |
| Separator | `components/ui/separator.tsx` | Subtle structure |
| Sheet | `components/ui/sheet.tsx` | Mobile navigation and detail panels |
| Sidebar | `components/ui/sidebar.tsx` | App/project navigation foundation |
| Skeleton | `components/ui/skeleton.tsx` | Known-layout loading state |
| Sonner | `components/ui/sonner.tsx` | Transient success/error feedback |
| Status Badge | `components/ui/status-badge.tsx` | Semantic workflow/lifecycle badge with text and status dot |
| Tabs | `components/ui/tabs.tsx` | Related subviews; not primary route replacement |
| Tooltip | `components/ui/tooltip.tsx` | Supplementary help only |

## Existing Product Components

| Component | Path | Classification | Notes |
| --- | --- | --- | --- |
| `AuthProvider` | `components/auth-provider.tsx` | Legacy foundation | Keep browser auth state; pair with server session architecture |
| `AuthGuard` | `components/auth-guard.tsx` | Legacy foundation | Replace as sole protection; server authorization is required |
| `LoginForm` | `components/login-form.tsx` | Reuse | Time Log Google sign-in card with explicit idle, pending, and safe inline error states |
| `SiteHeader` | `components/site-header.tsx` | Adapt | Contains sidebar, command, theme, logout; add project context/global timer |
| `AppSidebar` | `components/app-sidebar.tsx` | Adapt | Currently calendar-only; becomes capability-aware navigation |
| `CommandMenu` | `components/command-menu.tsx` | Adapt | Extend with project/task/timer commands subject to authorization |
| `SearchForm` | `components/search-form.tsx` | Adapt | Define tenant/project-safe search before wiring results |
| `ThemeSwitch` | `components/theme-switch.tsx` | Reuse | Existing light/dark control |
| `LogoutButton` | `components/logout-button.tsx` | Reuse | Header icon opens a confirmation dialog; supports cancel, pending, and safe error states |
| `OnboardingFlow` | `components/onboarding/onboarding-flow.tsx` | Reuse | Four-step resumable setup with progress, profile/schedule/preferences, workspace, first project, and task-first timer education |
| `TaskDashboard` | `components/task-dashboard.tsx` | Legacy | Personal dashboard; migrate into My Work/project pages |
| `TaskList` | `components/task-list.tsx` | Adapt concepts | Existing task interaction; do not reuse user-scoped data assumptions |
| `TaskItem` | `components/task-item.tsx` | Adapt concepts | Extend to assignment/status/visibility/timer pattern |
| `TaskForm` | `components/task-form.tsx` | Adapt concepts | Replace schema with project task command |
| `TaskEditDialog` | `components/task-edit-dialog.tsx` | Adapt | Candidate for task details sheet/dialog |
| `TaskDetailsDialog` | `components/task-details-dialog.tsx` | Adapt | Candidate for details/attachments/audit composition |
| `WeeklyPriorityList` | `components/weekly-priority-list.tsx` | Legacy | Not part of P0 project task model unless deliberately migrated |
| `Goals` / `HabitTracker` | `components/goals.tsx`, `components/habit-tracker.tsx` | Legacy | Preserve until product migration decision; not project tools yet |
| `NudgeBanner` | `components/nudge-banner.tsx` | Legacy | Scheduled notification patterns replace this over time |

## Planned Shared Components

Add source paths when implemented.

| Component | Planned purpose | Required states |
| --- | --- | --- |
| `OrganizationSwitcher` | Select active organization | loading, single, multiple, inaccessible |
| `ProjectSwitcher` | `components/projects/project-switcher.tsx` — select an accessible current or archived project | empty, current, archived |
| `ProjectToolNav` | `components/projects/project-tool-nav.tsx` — render only enabled and authorized tools | internal, mobile/desktop |
| `VisibilityBadge` | `components/visibility/visibility-badge.tsx` — read-only visibility label | internal, client-visible |
| `VisibilityControl` | `components/visibility/visibility-control.tsx` — controlled visibility selector with policy messaging | internal, client-visible, pending, disabled |
| `AssigneePicker` | Search/select eligible project members | empty, multiple, removed member |
| `TaskPicker` | Select or create task for timer | loading, empty, inaccessible, inline create |
| `ProjectTaskList` | `components/tasks/project-task-list.tsx` — project task creation, filters, rows, nesting, and lifecycle actions | empty, filtered-empty, editing, optimistic, rollback, read-only client |
| `GlobalTimer` | Persistent active timer | idle, selecting, starting, active, stopping, conflict, error |
| `DurationInput` | Safe manual duration entry | valid, invalid, disabled |
| `TimeEntryRow` | Display/edit auditable entry | timer/manual, internal/approved, edit denied |
| `MemberRoleBadge` | Role/status display | admin, member, client, invited, suspended |
| `InviteDialog` | Invite member/client and assign projects | pending, sent, provider failure |
| `EmailDeliveryBadge` | Admin delivery status | queued, sent, delivered, bounced, failed |
| `ApprovalCard` | Review an AI proposed action | pending, approved, rejected, expired, execution failed |
| `AuditEventRow` | Human-readable immutable action record | succeeded, denied, failed, redacted changes |
| `AuditFilters` | Filter organization/project activity | actor, action, outcome, project, target, date range |
| `AuditEventDetails` | Expand correlation and safe change metadata | loading, redacted fields, linked run/request |
| `ClientPreviewBanner` | Clearly mark preview-as-client mode | active, exit action |
| `EmptyState` | Consistent no-content guidance | icon, message, optional CTA |
| `PermissionState` | Non-destructive denied state | internal denied, client-safe not found |
| `ClientPortalBanner` | `components/projects/client-portal-banner.tsx` — identifies authenticated client mode | client mode |
| `ClientPortalEmptyState` | `components/projects/client-portal-empty-state.tsx` — non-disclosing no-shared-content state | no available client tools |

## Patterns to Preserve

- Existing shadcn variants and `cn()` composition.
- Sticky header and collapsible sidebar shell.
- Command palette keyboard access.
- Theme support through semantic tokens.
- Sonner for concise transient feedback.

### Semantic status badge

File: `components/ui/status-badge.tsx`
Last updated: 2026-09-21

| Property | Class |
| --- | --- |
| Background | `bg-status-success`, `bg-status-warning`, `bg-status-blocked`, `bg-status-info`, or `bg-muted` |
| Border | Transparent canonical Badge border |
| Border radius | Canonical Badge `rounded-4xl` pill |
| Text — primary | Matching semantic foreground token; `text-xs font-medium` inherited from Badge |
| Text — secondary | None |
| Spacing | Canonical Badge `gap-1 px-2 py-0.5`; dot `size-1.5` |
| Hover state | Static by default; linked badges retain canonical focus treatment |
| Shadow | None |
| Accent usage | Green success, amber pending/in progress, red blocked/failure, blue informational, neutral archived/internal |

**Pattern notes:** Use status color only for state-bearing metadata. Every badge includes readable text and a same-tone dot, so color is reinforcement rather than the sole signal. Roles remain neutral unless they represent a lifecycle state. Task priority uses the same tones with a separate mapping: urgent/red, high/amber, medium/blue, low/neutral.

### Shared shadcn visual foundation

Files: `app/globals.css`, `app/layout.tsx`, `components/ui/*`
Last updated: 2026-09-21

| Property | Class / token |
| --- | --- |
| Background | `bg-background`, `bg-card`, `bg-popover`; cool mist semantic neutrals |
| Border | `border-border`; controls use `border-input` or preset input tint |
| Border radius | Preset base `0.875rem`; actions use `rounded-4xl`; surfaces inherit canonical primitive radii |
| Text — primary | DM Sans via `font-sans`; `text-foreground` / `text-card-foreground` |
| Text — secondary | `text-muted-foreground`; Outfit is available through `font-heading` for deliberate display headings |
| Spacing | Primitive-owned compact spacing; feature compositions retain the registry's established gap and padding scale |
| Interactive state | Blue semantic primary; mist hover/expanded states; three-pixel `ring-ring/50` focus treatment |
| Shadow | Prefer borders and preset primitive shadows; no feature-specific heavy shadows |
| Accent usage | Saturated blue is reserved for primary actions, selected states, and focus emphasis |

**Pattern notes:** Preset `b311momZs0` (`radix-maia`, `mist`) is the canonical shared primitive foundation. Use semantic tokens rather than copying its raw OKLCH values into feature components. The application root owns `TooltipProvider`, DM Sans, Outfit, and Geist Mono. Regenerating primitives with another preset is a system-wide design change and requires compatibility checks for all composed controls.

### Logout confirmation dialog

File: `components/logout-button.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | `bg-background` inherited from `DialogContent` |
| Border | `border` inherited from `DialogContent` |
| Border radius | `rounded-lg` inherited from `DialogContent` |
| Text — primary | `text-lg font-semibold` inherited from `DialogTitle` |
| Text — secondary | `text-sm text-muted-foreground` inherited from `DialogDescription` |
| Spacing | `gap-4 p-6`; footer `gap-2` |
| Hover state | Canonical `Button` variant states |
| Shadow | `shadow-lg` inherited from `DialogContent` |
| Accent usage | Primary confirmation, outline cancel, `text-destructive` error |

**Pattern notes:** Use this compact confirmation pattern for session-ending actions. Keep cancel available, disable dismissal/actions while pending, use a spinner with explicit pending text, and show provider-safe inline errors without closing the dialog.

### Authentication form

File: `components/login-form.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | `bg-card text-card-foreground` |
| Border | `border` |
| Border radius | `rounded-xl` |
| Text — primary | `text-2xl font-semibold tracking-tight` |
| Text — secondary | `text-sm text-muted-foreground` |
| Spacing | `gap-6 p-6`; heading copy `space-y-2` |
| Hover state | Canonical outline `Button` states |
| Shadow | none |
| Accent usage | `text-destructive` inline error; semantic button tokens |

**Pattern notes:** Authentication forms use a centered bordered card, visible explanatory copy, full-width provider action, explicit spinner/pending text, and a safe inline error with `role="alert"`. Disable duplicate submission without hiding or replacing the form.

### Personalized onboarding flow

File: `components/onboarding/onboarding-flow.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Page background | `bg-muted/30` |
| Content width | `max-w-2xl` with responsive page gutters |
| Step surface | Canonical bordered `Card` |
| Progress | Canonical `Progress` plus visible “Step N of 4” text |
| Field spacing | `space-y-5`; related time fields use responsive two-column grid |
| Errors | Inline `text-destructive` with form-level `role="alert"` |
| Pending | Disabled canonical button with spinner and “Saving…” text |

**Pattern notes:** Each step persists independently and advances only after the server confirms success. Keep labels visible, preserve entered values after recoverable errors, explain mandatory notification categories, and pair checkbox state with text labels.

### Time picker

File: `components/ui/time-picker.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | Canonical transparent `SelectTrigger` |
| Border | `border-input` inherited from `SelectTrigger` |
| Border radius | `rounded-md` |
| Text — primary | `text-sm` inherited from `SelectTrigger` |
| Text — secondary | `text-muted-foreground` separator |
| Spacing | `gap-2`; canonical select padding |
| Hover state | Canonical `Select` states |
| Shadow | `shadow-xs` on triggers; `shadow-md` on menus |
| Accent usage | Semantic focus ring and selected-item accent |

**Pattern notes:** Use three accessible shadcn `Select` controls for hour, minute, and AM/PM. The public value remains canonical 24-hour `HH:mm`; do not leak display formatting into domain data.

### Timezone combobox

File: `components/ui/timezone-combobox.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | `bg-background` trigger; `bg-popover` results |
| Border | Canonical outline `Button` and `PopoverContent` border |
| Border radius | `rounded-md` |
| Text — primary | `text-sm font-normal` trigger and results |
| Text — secondary | Muted chevron and search icon |
| Spacing | Canonical command item padding; popover `p-0` |
| Hover state | `data-[selected=true]:bg-accent` |
| Shadow | `shadow-xs` trigger; `shadow-md` popover |
| Accent usage | Selected checkmark and semantic focus ring |

**Pattern notes:** Use this searchable controlled combobox for IANA timezone fields. Populate it from `Intl.supportedValuesOf("timeZone")`, retain `UTC` and the current value, close after selection, and preserve native keyboard/search behavior through `Command`.

### People administration

Files: `app/(app)/people/page.tsx`, `components/people/invite-person-form.tsx`, `components/people/membership-actions.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | Canonical `Card`; client company group `bg-muted/30` |
| Border | Canonical card border; person rows `border` |
| Border radius | `rounded-lg` rows and grouped fields |
| Text — primary | `text-3xl font-semibold tracking-tight`; row `font-medium` |
| Text — secondary | `text-sm text-muted-foreground` |
| Spacing | Page `space-y-6`; rows and form groups `gap-3` / `space-y-4` |
| Hover state | Canonical `Button`, `Select`, and sidebar link states |
| Shadow | Canonical card/dialog shadows |
| Accent usage | Semantic role/status badges, focus rings, destructive removal action |

**Pattern notes:** People management uses responsive bordered rows rather than a horizontally scrolling table. Invitations reveal client-company inputs only for the client role. Suspension and removal preserve context, use explicit actions, and surface safe inline errors; destructive removal uses the canonical confirmation dialog.

### Invitation acceptance card

File: `app/invitations/[organizationId]/[invitationId]/page.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | Page `bg-muted/30`; canonical `Card` |
| Border | Canonical card border |
| Border radius | Canonical `rounded-xl` card |
| Text — primary | Canonical `CardTitle` |
| Text — secondary | Canonical `CardDescription` |
| Spacing | Centered card with `p-4`; canonical card sections |
| Hover state | Canonical primary `Button` |
| Shadow | Canonical card styling |
| Accent usage | `text-destructive` safe invalid/mismatch message |

**Pattern notes:** Invitation acceptance never previews organization or project details before server validation. It identifies the signed-in email, uses one clear action, and collapses invalid, expired, consumed, and mismatched invitations into a non-disclosing error.

### Project index and form

Files: `app/(app)/projects/page.tsx`, `components/projects/project-form.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | Page `bg-muted/20` through project layout; canonical `Card` surfaces |
| Border | Canonical card border; tool choices `border` |
| Border radius | `rounded-md` tool choices; canonical card radius |
| Text — primary | `text-3xl font-semibold tracking-tight`; section `text-xl font-semibold` |
| Text — secondary | `text-sm text-muted-foreground` |
| Spacing | Page `space-y-8`; forms `space-y-5`; card grids `gap-4` |
| Hover state | Project cards and archived rows `hover:bg-muted/40` |
| Shadow | Canonical card/button shadows |
| Accent usage | Semantic status badges, primary create/save action, destructive archive confirmation |

**Pattern notes:** Project lists use responsive cards for current work and compact rows for archived work. Only admins receive creation and settings controls. Tool selection uses labeled bordered checkbox rows, defaults to To-dos and Time tracking, retains at least one tool, and emits canonical tool IDs.

### Project shell and switcher

Files: `app/(app)/projects/layout.tsx`, `app/(app)/projects/[projectId]/layout.tsx`, `components/projects/project-switcher.tsx`, `components/projects/project-tool-nav.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | Shell `bg-muted/20`; sticky header `bg-background` |
| Border | Header and tool navigation `border-b`; read-only banner `border` |
| Border radius | Navigation links and banners `rounded-md` / `rounded-lg` |
| Text — primary | Project `text-3xl font-semibold tracking-tight`; nav `text-sm font-medium` |
| Text — secondary | Status and read-only guidance `text-muted-foreground` |
| Spacing | Header `gap-3 px-4`; project content `space-y-6 p-4` |
| Hover state | `hover:bg-accent` navigation; canonical dropdown focus states |
| Shadow | none beyond canonical dropdown/button shadows |
| Accent usage | Project key `text-primary`; semantic status badges |

**Pattern notes:** The switcher shows only server-authorized projects and labels archived entries. The project shell repeats authorization at the route boundary, excludes clients until the client portal exists, renders only enabled tools, and returns not-found for disabled tools or inaccessible projects. Non-active projects display a visible read-only banner.

### Visibility badge and control

Files: `components/visibility/visibility-badge.tsx`, `components/visibility/visibility-control.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | Canonical `Badge` and transparent `SelectTrigger` backgrounds |
| Border | Canonical outline badge and `border-input` select border |
| Border radius | `rounded-md` inherited from Badge and Select |
| Text — primary | Canonical `text-xs font-medium` badge and `text-sm` control |
| Text — secondary | `text-sm text-muted-foreground` policy guidance |
| Spacing | Control `space-y-2`; badge icon/text `gap-1` |
| Hover state | Canonical Badge and Select interactive states |
| Shadow | `shadow-xs` trigger and `shadow-md` menu |
| Accent usage | Secondary badge for client-visible; outline badge for internal; icons reinforce labels |

**Pattern notes:** Always show the text label in addition to the icon. Keep the selector controlled so the owning feature handles its audited server mutation and rollback. Pending and denied states disable selection without hiding the current value. Guidance must state that client visibility still requires verified project access.

### Client portal shell

Files: `components/projects/client-portal-banner.tsx`, `components/projects/client-portal-empty-state.tsx`, `app/(app)/projects/layout.tsx`
Last updated: 2026-09-16

| Property | Class |
| --- | --- |
| Background | Shell `bg-muted/20`; portal surfaces `bg-muted/40`; canonical Card |
| Border | Shell `border-b`; portal banner and icon container `border` |
| Border radius | `rounded-lg` banner; `rounded-md` icon container; canonical Card radius |
| Text — primary | `font-medium`; empty-state canonical `CardTitle` |
| Text — secondary | `text-sm text-muted-foreground` |
| Spacing | Banner `gap-3 p-4`; empty state uses canonical Card spacing |
| Hover state | Canonical project card and navigation states |
| Shadow | Canonical Card shadow only |
| Accent usage | Semantic muted surface and Eye icon; no client-specific hardcoded color |

**Pattern notes:** Client mode reuses the internal project shell but removes People, settings, creation, and unsupported tool navigation. The banner explicitly identifies client context without implying preview or impersonation. Empty states never reveal internal tool names, record counts, or hidden-content existence.

### Project to-do list

Files: `components/tasks/project-task-list.tsx`, `app/(app)/projects/[projectId]/todos/page.tsx`
Last updated: 2026-09-23

| Property | Class |
| --- | --- |
| Background | List `bg-card`; expanded details `bg-muted/20`; quick-create `bg-card`; assignee options `bg-background` |
| Border | One outer `border`; task wrappers use `border-b`; expanded details use `border-t`; assignee options use semantic `border` |
| Border radius | `rounded-lg` list, empty states, and assignee options; task rows do not introduce nested radii |
| Text — primary | Collapsed title `font-medium`; description `text-sm`; page `text-xl font-semibold` |
| Text — secondary | Detail labels and metadata use `text-muted-foreground`; completed title adds `line-through` |
| Spacing | Collapsed rows `px-3 py-2`; expanded details `px-4 py-4`; assignee options `gap-2 px-3 py-2`; subtasks add `1.5rem` indentation per level |
| Hover state | Row disclosure uses `hover:text-foreground` and a visible keyboard focus ring; canonical control states |
| Shadow | Canonical control shadows; no additional row shadow |
| Accent usage | Semantic status/priority/visibility badges and destructive archive confirmation |

**Pattern notes:** Render tasks and subtasks as a single compact divided list, never as one card per record. Collapsed rows expose only the completion checkbox, title, saving feedback, and disclosure indicator. Opening a row reveals its readable description, badges, due/assignee metadata, and secondary actions; Edit is a separate state, and opening another row closes the previous one. Assignee choices identify eligible workspace members by resolved name with email as secondary context, save immutable user IDs, and render those names in task details. Saved subtasks use progressive indentation and a hierarchy icon. The default Active view hides completed tasks immediately; users can deliberately select the Done status filter to review or reopen them. Active children whose completed parent is hidden remain promoted into view rather than disappearing with the parent. Create, edit, assignment, status, archive, and restore are optimistic and scoped per task; unrelated rows stay interactive, overlapping changes to one task are serialized, canonical IDs replace temporary IDs, and failures restore only the affected snapshot. Transient save failures offer Retry, while permission and validation failures require review. Timer-driven completion broadcasts into an open list before server refresh. Archive uses confirmation and moves records into an explicit Archived view with Restore. Client mode retains disclosure for client-safe details but omits every mutation control.

### Project workspace header

File: `components/layout/app-header.tsx`
Last updated: 2026-09-23

| Property | Class |
| --- | --- |
| Background | `bg-background` over the workspace `bg-muted/20` |
| Border | `border-b` |
| Border radius | Navigation links use `rounded-md` |
| Text — primary | Brand `font-semibold`; navigation `text-sm` |
| Text — secondary | Canonical icon-button accessible labels |
| Spacing | Header `gap-3 px-4 py-2`; navigation `gap-1`; links `gap-2 px-3 py-2` |
| Hover state | `hover:bg-accent` |
| Shadow | None |
| Accent usage | Semantic accent hover only |

**Pattern notes:** The authenticated application layout owns this header; individual pages and nested layouts must not render competing navigation. Every desktop destination pairs a conventional icon with an always-visible text label and an active state. Below `xl`, one labeled menu presents the same icon map, labels, role visibility, and active state without header wrapping. Theme and Logout remain compact utilities. Onboarding intentionally suppresses application chrome. Client users omit My Work and People because their root route resolves to the restricted project portal.

### Optional date and time picker

File: `components/ui/date-time-picker.tsx`
Last updated: 2026-09-18

| Property | Class |
| --- | --- |
| Background | Canonical Popover and Calendar surfaces |
| Border | Canonical outline Button, Popover, Select, and Checkbox borders |
| Border radius | Canonical `rounded-md` controls |
| Text — primary | `text-sm` inherited from canonical controls |
| Text — secondary | Canonical muted empty-date label |
| Spacing | Container `space-y-3`; trigger/clear row `gap-2`; time picker `gap-2` |
| Hover state | Canonical Button, Calendar, Checkbox, and Select states |
| Shadow | Canonical control and popover shadows |
| Accent usage | Semantic selected calendar day and focus rings |

**Pattern notes:** Optional deadlines begin with a calendar trigger. Selecting a date reveals an explicit “Include a time” checkbox; only then does the existing three-part TimePicker appear. Keep a visible clear action with an accessible name, and preserve date-only intent separately from the stored timestamp.

### My Work grouped task list

Files: `components/tasks/my-work.tsx`, `app/(app)/page.tsx`
Last updated: 2026-09-18

| Property | Class |
| --- | --- |
| Background | Page `bg-muted/20`; task rows and empty state use canonical `bg-card` |
| Border | Canonical row and Card borders; sticky header `border-b` |
| Border radius | Task rows `rounded-lg`; canonical Card and Button radii |
| Text — primary | Page `text-2xl font-semibold tracking-tight`; group and task titles `font-semibold` / `font-medium` |
| Text — secondary | `text-sm text-muted-foreground` for group guidance and task metadata |
| Spacing | Page `space-y-8`; groups `space-y-3`; rows `p-4`; metadata `gap-3` |
| Hover state | Linked task titles underline; project links use `hover:text-foreground`; canonical Button states |
| Shadow | None beyond canonical controls and Card |
| Accent usage | `text-primary` eyebrow; semantic status and priority badges |

**Pattern notes:** Cross-project work is grouped by due state rather than project. Keep project identity visible on every row, use a secondary outline Track time action only when Time tracking is enabled, and omit empty groups. A completely empty queue uses one calm Card with a Projects action.

### Legacy task migration card

File: `components/tasks/legacy-migration-card.tsx`
Last updated: 2026-09-18

| Property | Class |
| --- | --- |
| Background | Canonical Card; icon and result surfaces `bg-muted/40` / `bg-muted/30` |
| Border | Canonical Card and summary/result `border` |
| Border radius | Summary `rounded-md`; result `rounded-lg`; canonical dialog |
| Text — primary | Canonical Card title; summary count `text-2xl font-semibold tabular-nums` |
| Text — secondary | `text-sm text-muted-foreground` for safety guidance and reconciliation |
| Spacing | Card body `space-y-4`; summary and form controls `gap-3`; inset results `p-4` |
| Hover state | Canonical Select and Button states |
| Shadow | Canonical Card, control, and dialog shadows |
| Accent usage | Semantic primary confirmation; `text-destructive` safe errors |

**Pattern notes:** Migration is preview-first and never starts from the project selector alone. Show source counts and unmapped-field summaries before confirmation, repeat the non-destructive guarantee in the dialog, disable dismissal while pending, and keep created/already-migrated/skipped/conflict/remaining reconciliation visible after every run.

### Navigation progress and loading feedback

Files: `components/navigation-feedback.tsx`, `app/(app)/loading.tsx`, `app/(app)/projects/[projectId]/loading.tsx`, `components/projects/project-switcher.tsx`
Last updated: 2026-09-20

| Property | Class |
| --- | --- |
| Background | Progress track `bg-primary/15`; skeletons use canonical muted animation |
| Border | Loading surfaces inherit canonical Skeleton/Card borders and radii |
| Border radius | Content skeletons `rounded-xl` / `rounded-lg`; canonical control radius |
| Text — primary | Existing page hierarchy is represented by proportionate skeleton bars |
| Text — secondary | Project-switch failure uses a concise Sonner message |
| Spacing | Page `space-y-6 p-4 sm:p-6`; loading grids `gap-4` |
| Interactive state | Buttons use `active:scale-[0.98]`; async switcher shows `animate-spin` and disables duplicate selection |
| Shadow | None beyond canonical controls |
| Accent usage | Fixed top progress indicator uses semantic `bg-primary` |

**Pattern notes:** Every internal route transition must acknowledge the click immediately. Use the global top progress bar for links, nested route skeletons for server-rendered content, and a local spinner plus `aria-busy` for imperative navigation or server actions. Pending controls prevent duplicate actions; reduced-motion users receive a pulse instead of translated movement.

### Shared select control

File: `components/ui/select.tsx`
Last updated: 2026-09-23

| Property | Class |
| --- | --- |
| Background | Trigger `bg-input/30`; menu `bg-popover` |
| Border | Trigger `border border-input`; menu `ring-1 ring-foreground/5` |
| Border radius | Trigger `rounded-4xl`; menu `rounded-2xl`; options `rounded-xl` |
| Text — primary | Trigger and options `text-sm`; selected value uses `text-left text-ellipsis` |
| Text — secondary | Placeholder and chevron `text-muted-foreground` |
| Spacing | Trigger `gap-1.5 px-3 py-2`; options `gap-2.5 py-2 pr-8 pl-3` |
| Hover state | Canonical focus ring; options use `focus:bg-accent focus:text-accent-foreground` |
| Shadow | Menu `shadow-2xl` |
| Accent usage | Semantic focus ring and selected-option checkmark |

**Pattern notes:** Select triggers must remain inside their parent surface. Selected values use a shrinkable flex child and single-line ellipsis; the chevron never shrinks. Menu content stays within the viewport, while long option labels wrap so users can read the full value.

### Global timer control and launcher

Files: `components/time/global-timer-control.tsx`, `components/time/timer-start-button.tsx`, `app/(app)/projects/[projectId]/time/page.tsx`
Last updated: 2026-09-23

| Property | Class |
| --- | --- |
| Background | Control `bg-background/95 backdrop-blur`; inline task surface `bg-muted/30`; canonical Dialog |
| Border | Control, status surfaces, and inline creation use semantic `border` |
| Border radius | Control `rounded-xl`; inset states `rounded-lg`; canonical form controls |
| Text — primary | Active task `text-sm font-medium`; canonical Dialog title and labels |
| Text — secondary | Project/start/note context `text-xs text-muted-foreground`; guidance `text-sm text-muted-foreground` |
| Spacing | Control `gap-3 p-3`; launcher `space-y-4`; inline creation `space-y-2 p-3`; authenticated content reserves `pb-28` |
| Interactive state | Canonical Button/Select focus and pressed states; per-transition pending buttons disable and show `animate-spin`; active timers expose labeled Pause/Resume, Stop, and supported Picture-in-Picture controls |
| Shadow | Floating control `shadow-lg`; canonical Dialog/control shadows |
| Accent usage | Semantic `bg-primary` live dot, secondary elapsed badge, destructive session badge |

**Pattern notes:** The global timer remains compact, persistent, and centered above the bottom viewport edge at every breakpoint. Authenticated content reserves `pb-28` whenever the control is available so final rows and actions remain unobscured. An active state always shows project, task or project-level label, server start time, tracked active time, optional note, and a direct Pause or Resume action; paused time remains visually frozen and explicitly labeled. The launcher resolves defaults in this order: explicit Track time context, current `/projects/[projectId]` route, then the first accessible project. Within that project it recommends assigned work first, then in-progress status, earliest deadline, highest priority, and stable task order; selectors remain editable. Timer launch choices contain only unfinished, non-archived tasks; completed tasks are neither suggested nor accepted by the server. Supported secure browsers expose “Keep timer visible,” which opens a compact Document Picture-in-Picture surface using the same semantic tokens with Pause/Resume and Stop & save actions. Unsupported browsers retain the normal timer without a disabled control, and every active timer updates the tab title with state, elapsed active time, and task as the universal fallback. Launcher failures stay inline, network loss retains the last known timer with an Offline badge, and session expiry exposes a direct Sign in action. Task creation remains internal by default and is completed before starting the timer.

**Synchronization note:** Timer start, stop, pause, and resume publish explicit cross-context invalidations through BroadcastChannel with a storage-event fallback. Picture-in-Picture closes on `timer-stopped`; other transitions reconcile the shared portal against server-authoritative state. Local Start/Pause/Resume intents are projected immediately and committed in order, so Pause remains responsive while Start is still saving; focus and polling reconciliation wait for that command queue to drain.

**Inactivity note:** Supported secure browsers expose a labeled Activity icon for the one-time device-idle permission gesture. The fallback monitors only a visible Time Log document. After two inactive minutes, use a non-dismissible Dialog with a live 30-second countdown and explicit “Pause now” / “I’m still working” actions. An automatic inactivity pause opens a separate recovery Dialog with Resume timer, Stop timer, and Keep paused actions; never hide the excluded-time behavior.

**Optimistic note:** Timer start, pause, and resume project their expected state immediately and reconcile against the canonical server timer. Pause/Resume stays interactive while earlier timer intents save, while Stop waits for the ordered timer queue to drain. Only the newest local intent may replace visible state with a canonical response. A failed command cancels dependent queued commands and reloads canonical timer state; permission and validation failures do not offer blind retry.

### Time entry stop, manual entry, and correction

Files: `components/time/global-timer-control.tsx`, `components/time/project-time-entries.tsx`, `app/(app)/projects/[projectId]/time/page.tsx`
Last updated: 2026-09-20

| Property | Class |
| --- | --- |
| Background | Canonical Card/Dialog; empty and inline guidance use `bg-muted/30` where appropriate |
| Border | Entry rows and empty states use semantic `border` |
| Border radius | Entry rows `rounded-lg`; canonical dialog and controls |
| Text — primary | Entry task `font-medium`; canonical Card/Dialog titles |
| Text — secondary | Entry metadata and policy guidance `text-sm text-muted-foreground` / `text-xs text-muted-foreground` |
| Spacing | Entry list `space-y-3`; rows `gap-3 p-4`; forms `space-y-4` |
| Interactive state | Stop/save actions use explicit pending text; optimistic manual/correction rows use item-scoped `aria-busy` and muted `Saving…`; correction uses a labeled icon button |
| Shadow | Canonical Card, Dialog, and control shadows |
| Accent usage | Semantic billable/reporting badges; primary save/stop actions; destructive inline errors |

**Pattern notes:** Stop confirmation removes the timer and closes Picture-in-Picture immediately, then shows a compact “Saving time…” state while the authoritative server transaction completes. This state synchronizes across tabs, prevents a new timer from starting, and restores the exact prior timer plus the stop dialog if saving fails. A linked-task timer includes an unchecked, inset completion choice naming the task; selecting it changes the primary label to “Stop, save & complete” and commits time plus task completion together. Project-level and Picture-in-Picture quick stops omit completion. Manual entry and correction share the same task, Shadcn date/time, note, billable, and reporting controls. Manual entries appear immediately with temporary IDs; corrections update only their row and close the dialog immediately. Both display muted `Saving…`, reconcile against the canonical server-derived duration and audit count, and restore the affected entry/dialog on failure. Corrections remain compact entry-row actions and explicitly explain audit preservation.

### Time views and client-safe reports

Files: `components/time/time-report-filters.tsx`, `components/time/time-report-view.tsx`, `app/(app)/time/page.tsx`, `app/(app)/projects/[projectId]/time/page.tsx`
Last updated: 2026-09-20

| Property | Class |
| --- | --- |
| Background | Canonical Card; filter and empty surfaces `bg-muted/20`; table header `bg-muted/40` |
| Border | Summary tiles, filter panel, table container, and rows use semantic `border` / `border-t` |
| Border radius | Filters, summaries, tables, and empty states use `rounded-lg` |
| Text — primary | Page `text-2xl font-semibold tracking-tight`; totals `text-2xl font-semibold tabular-nums`; table task `font-medium` |
| Text — secondary | Descriptions, dates, timezone notes, and empty states use `text-muted-foreground` |
| Spacing | Page and report stacks `space-y-6` / `space-y-5`; filter and summary surfaces `gap-4 p-4` |
| Interactive state | Canonical Button, Input, and Select states; filter submission disables with `animate-spin` during navigation |
| Shadow | Canonical Card and control shadows only |
| Accent usage | Primary section eyebrow and active period control; semantic secondary/outline status badges |

**Pattern notes:** Reports lead with filters, then three consistent summary tiles, then a horizontally scrollable detail table. Personal views expose day/week and previous/next navigation. Client-safe previews are visually explicit, never show internal status or notes, and place the audited CSV export in the Card header. Empty datasets retain the same report structure without revealing filtered-out counts. Oversized datasets use a semantic destructive alert, explicitly label totals as partial, and omit export until the user narrows the date range.

### Admin console

Files: `app/(app)/admin/page.tsx`, `components/admin/organization-settings-form.tsx`, `components/admin/member-admin-controls.tsx`, `components/people/membership-actions.tsx`
Last updated: 2026-09-23

| Property | Class |
| --- | --- |
| Background | Canonical Card; management rows use `bg-card`; no role-specific hardcoded colors |
| Border | People, projects, audit rows, and control separators use semantic `border` / `border-t` |
| Border radius | Management rows and summary surfaces use `rounded-lg`; canonical Dialog radius |
| Text — primary | Page `text-3xl font-semibold tracking-tight`; totals `text-2xl font-semibold tabular-nums`; entity names `font-medium` |
| Text — secondary | Descriptions and identifiers use `text-muted-foreground`; policy notes use `text-xs` / `text-sm` |
| Spacing | Page `space-y-8`; major grids `gap-6`; management rows `p-4`; compact history rows `p-3` |
| Interactive state | Canonical Button, Select, Input, and searchable TimezoneCombobox; pending mutations disable and show `animate-spin` |
| Shadow | Canonical Card, Dialog, and control shadows only |
| Accent usage | Primary administration eyebrow; semantic role/status badges; destructive confirmation actions |

**Pattern notes:** The console leads with four compact health totals, then gives people/access management the widest surface. Role and Project access share a responsive control row; project assignments use a compact checkbox dropdown with selected-count feedback instead of separate Add/Remove buttons. Role selectors distinguish Organization admin, Project admin, and Member: organization-wide access is stated explicitly, while Project admin requires one or more selected projects and is represented by administrative project assignments. Role, suspension, removal, project-access removal, and timezone changes explain consequences before consequential changes. Canonical project settings remain linked rather than duplicated. Recent administration is intentionally compact; full audit exploration belongs to the dedicated viewer.

### Administration secondary navigation

File: `components/admin/admin-nav.tsx`
Last updated: 2026-09-21

| Property | Class |
| --- | --- |
| Background | `bg-background` |
| Border | Container `border-b`; active item `border-b-2 border-primary` |
| Border radius | None; this is a section-level tab rail |
| Text — primary | Active `font-medium text-foreground` |
| Text — secondary | Inactive `text-sm text-muted-foreground` |
| Spacing | Rail `gap-1 px-4`; items `gap-2 px-3 py-3` |
| Hover state | `hover:text-foreground` |
| Shadow | None |
| Accent usage | Active underline uses semantic `border-primary` |

**Pattern notes:** People management is an Admin subsection, not a primary application destination. Overview, People, and Activity retain the secondary rail across their pages. Legacy `/people` requests redirect to `/admin/people`; focused invitation and access changes remain forms or dialogs inside the People subsection.

### Audit trail viewer

Files: `components/audit/audit-viewer.tsx`, `app/(app)/activity/page.tsx`, `app/(app)/projects/[projectId]/activity/page.tsx`
Last updated: 2026-09-20

| Property | Class |
| --- | --- |
| Background | Canonical Card; filters `bg-muted/20`; details `bg-muted/30` |
| Border | Event rows and filter surface use semantic `border` |
| Border radius | Events and filter surfaces use `rounded-lg`; details use `rounded-md` |
| Text — primary | Event summaries `font-medium`; page title `text-3xl font-semibold tracking-tight` |
| Text — secondary | Actor, project, timestamps, and support details use `text-muted-foreground` |
| Spacing | Viewer `space-y-5`; event rows `p-4`; compact details `p-3` |
| Interactive state | Canonical buttons and inputs; native selects match semantic control tokens |
| Shadow | Canonical Card and control shadows only |
| Accent usage | Outcome badges are outline by default and destructive for denied/failed events |

**Pattern notes:** Audit events remain compact until correlation details are expanded. Filters precede results, empty states never imply hidden client data, pagination uses a single Next action, and exports remain admin-only adjacent actions.

### Personal notification settings

Files: `components/settings/notification-preferences-form.tsx`, `app/(app)/settings/page.tsx`
Last updated: 2026-09-20

| Property | Class |
| --- | --- |
| Background | Canonical Card; mandatory-mail guidance uses `bg-muted/30` |
| Border | Category rows and guidance use semantic `border` |
| Border radius | Category rows and guidance use `rounded-lg`; canonical controls |
| Text — primary | Page `text-3xl font-semibold tracking-tight`; category labels `text-sm font-medium` |
| Text — secondary | Descriptions and scheduling guidance use `text-muted-foreground` |
| Spacing | Page and form `space-y-6`; category rows `gap-3 p-4` |
| Interactive state | Canonical Checkbox, Select, TimezoneCombobox, and pending Button states |
| Shadow | Canonical Card and control shadows only |
| Accent usage | Primary settings eyebrow; muted mandatory-delivery explanation |

**Pattern notes:** Personal timezone is distinct from organization reporting timezone. Non-essential email categories use explicit labeled rows, digest frequency is one mutually exclusive value, and mandatory invitation/security mail is explained but not rendered as a disabled preference.

### Project file drop zone and rows

File: `components/files/project-files.tsx`
Last updated: 2026-09-21

| Property | Class |
| --- | --- |
| Background | Empty state `bg-muted/20`; drag state `bg-primary/5`; file icon `bg-muted` |
| Border | Drop target `border border-dashed`; list and upload progress use semantic `border` |
| Border radius | Major file surfaces `rounded-xl`; compact progress rows and icon tiles `rounded-lg` |
| Text — primary | Filename and upload prompt `font-medium` |
| Text — secondary | File metadata and upload guidance `text-sm` / `text-xs text-muted-foreground` |
| Spacing | Feature stack `space-y-5`; drop zone `p-7`; file rows `p-4`; row controls `gap-2` |
| Hover state | Drop zone `hover:border-primary/60 hover:bg-muted/40`; canonical Button and Select states |
| Shadow | Canonical controls only |
| Accent usage | Active drag state uses semantic `border-primary bg-primary/5`; progress uses canonical primary indicator |

**Pattern notes:** File uploads use one discoverable drag/select surface, per-file progress appears immediately, and completed files use compact divided rows rather than cards. Destructive archive is a labeled assistive icon action; visibility remains an explicit select and is disabled with explanatory copy until the scan gate permits client sharing.

### Message board posts and comments

File: `components/messages/message-board.tsx`
Last updated: 2026-09-21

| Property | Class |
| --- | --- |
| Background | Composer and posts `bg-card`; comments `bg-muted/30`; empty state and announcement option `bg-muted/20` |
| Border | Composer, posts, and empty state use semantic `border`; comments begin after `border-t` |
| Border radius | Composer/posts/empty state `rounded-xl`; comments and announcement option `rounded-lg` |
| Text — primary | Board heading `text-xl font-semibold`; post title `text-lg font-semibold`; author body `text-sm` |
| Text — secondary | Author, timestamps, edited state, and delivery guidance use `text-xs text-muted-foreground` |
| Spacing | Board/composer `space-y-6` / `space-y-4`; posts `p-5`; comments `p-3`; comment region `pt-4` |
| Hover state | Canonical Button, Select, Checkbox, Input, and Textarea states |
| Shadow | Canonical controls only |
| Accent usage | Pinned state uses `text-primary`; visibility uses the shared semantic badge |

**Pattern notes:** Publishing is one deliberate composer surface followed by durable post cards. Metadata stays compact, bodies preserve line breaks, comments are visually subordinate, and editing expands inline without opening a competing page. Announcement email is an administrator-only explicit checkbox and never inferred from pinning or visibility. Archived posts use a separate internal view with Restore.

**Optimistic note:** Ordinary posts and comments appear immediately with temporary IDs and muted `Saving…` metadata. Editing, pinning, visibility, archive/restore, and comment archive affect only their record; unrelated posts and comments remain interactive. Failures restore only the affected snapshot and transient failures offer Retry. Email announcements are deliberately different: the post remains in a publishing state and is not shown as published until the server has durably created recipient notifications.

## Patterns to Retire

- Product name “Visio Genesis” in login, header, or metadata.
- Calendar-only sidebar labeled as project navigation.
- Browser-only auth guard as the sole protected-route mechanism.
- Root-level `text-xs` as the application typography default.
- User-scoped Firestore assumptions inside reusable project task UI.
