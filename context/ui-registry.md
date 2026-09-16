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
| `SiteHeader` | `components/site-header.tsx` | Adapt | Contains sidebar, command, theme, logout; add project context/global timer |
| `AppSidebar` | `components/app-sidebar.tsx` | Adapt | Currently calendar-only; becomes capability-aware navigation |
| `CommandMenu` | `components/command-menu.tsx` | Adapt | Extend with project/task/timer commands subject to authorization |
| `SearchForm` | `components/search-form.tsx` | Adapt | Define tenant/project-safe search before wiring results |
| `ThemeSwitch` | `components/theme-switch.tsx` | Reuse | Existing light/dark control |
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
| `ProjectSwitcher` | Select/create accessible project | loading, empty, search, archived |
| `ProjectToolNav` | Render enabled and authorized tools | internal/client, mobile/desktop |
| `VisibilityBadge` | Read-only visibility label | internal, client-visible |
| `VisibilityControl` | Change visibility with policy messaging | pending, denied, nested-content warning |
| `AssigneePicker` | Search/select eligible project members | empty, multiple, removed member |
| `TaskPicker` | Select or create task for timer | loading, empty, inaccessible, inline create |
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

## Patterns to Preserve

- Existing shadcn variants and `cn()` composition.
- Sticky header and collapsible sidebar shell.
- Command palette keyboard access.
- Theme support through semantic tokens.
- Sonner for concise transient feedback.

## Patterns to Retire

- Product name “Visio Genesis” in login, header, or metadata.
- Calendar-only sidebar labeled as project navigation.
- Browser-only auth guard as the sole protected-route mechanism.
- Root-level `text-xs` as the application typography default.
- User-scoped Firestore assumptions inside reusable project task UI.
