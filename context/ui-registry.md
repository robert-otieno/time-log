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
| Input / Label / Textarea | `components/ui/*` | Canonical form controls |
| Popover | `components/ui/popover.tsx` | Compact selectors and date UI |
| Progress | `components/ui/progress.tsx` | Onboarding/report progress, not elapsed timer |
| Select | `components/ui/select.tsx` | Small fixed option sets |
| Separator | `components/ui/separator.tsx` | Subtle structure |
| Sheet | `components/ui/sheet.tsx` | Mobile navigation and detail panels |
| Sidebar | `components/ui/sidebar.tsx` | App/project navigation foundation |
| Skeleton | `components/ui/skeleton.tsx` | Known-layout loading state |
| Sonner | `components/ui/sonner.tsx` | Transient success/error feedback |
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
Last updated: 2026-09-18

| Property | Class |
| --- | --- |
| Background | Canonical `bg-card` task rows and quick-create surface |
| Border | `border` rows; `border-t` expanded edit separator; `border-l` subtask nesting |
| Border radius | `rounded-lg` rows and empty states; canonical controls |
| Text — primary | Row `font-medium`; page `text-xl font-semibold` |
| Text — secondary | `text-sm text-muted-foreground`; completed title adds `line-through` |
| Spacing | Surfaces `p-4`; list `space-y-3`; metadata `gap-2` / `gap-3` |
| Hover state | Canonical Button, Select, Checkbox, and input states |
| Shadow | Canonical control shadows; no additional row shadow |
| Accent usage | Semantic status/priority/visibility badges and destructive archive confirmation |

**Pattern notes:** Keep rows compact until explicitly expanded for inline editing. Creation and completion are optimistic; pending creation uses an outline Saving badge and rolls back on failure. Archive uses confirmation and moves records into an explicit Archived view with Restore. Direct subtask creation appears beneath the parent on a `bg-muted/30` inset surface; saved subtasks use indentation plus a left border. Client mode is read-only and omits archived counts, assignees, visibility filters, and every mutation control.

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

## Patterns to Retire

- Product name “Visio Genesis” in login, header, or metadata.
- Calendar-only sidebar labeled as project navigation.
- Browser-only auth guard as the sole protected-route mechanism.
- Root-level `text-xs` as the application typography default.
- User-scoped Firestore assumptions inside reusable project task UI.
