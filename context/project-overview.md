# Time Log — Project Overview

## About the Project

Time Log is a collaborative project workspace for planning work, assigning tasks, tracking time, sharing client-safe updates, and coordinating people and AI. A project is the primary work container. Each project can enable only the tools it needs: to-dos, time tracking, message board, docs and files, calendar, chat, card table, automatic check-ins, email forwards, and external links.

The existing application is a personal task, habit, goal, and priority tracker built with Next.js and Firebase. The new product keeps the useful task-management foundation but changes the ownership model from user-only collections to organization and project-scoped collaboration.

## Problem It Solves

Small teams often split work across a task manager, timer, chat app, file drive, calendar, and client email. That makes it difficult to answer basic questions: what is being worked on, how long it took, what the client can see, and what needs attention next.

Time Log creates one project record for the work and its history. It emphasizes three habits first:

1. Securely enter and leave the product.
2. Clearly define the task before work starts.
3. Capture trustworthy time against that task.

## Product Vocabulary

- **Organization** — the tenant and billing/security boundary containing members, clients, projects, templates, and organization settings.
- **Project** — a collaborative workspace containing enabled tools and project-scoped content.
- **Member** — an internal organization user. A member may be an admin or standard member.
- **Client** — a restricted guest who can access only assigned projects and only content explicitly marked client-visible.
- **Visibility** — `internal` or `client-visible`. New content defaults to `internal`. Visibility never grants access to a person who is not assigned to the project.
- **Task** — a saved unit of work. In the initial release, every non-admin live timer must reference a task.
- **Time entry** — an immutable-duration record created by stopping a timer or entering time manually. Corrections are audited.
- **AI agent** — a project-scoped assistant operating through approved tools and permissions.
- **AI connector** — an organization or project authorization to an external service used by an agent or workflow.
- **Audit event** — an append-only record of a meaningful action attempted or completed by a user, administrator, system job, integration, or AI agent.

## Roles and Access

| Role | Intended access |
| --- | --- |
| Organization admin | Manage organization, people, clients, projects, templates, settings, integrations, and all internal content. May start a project-level timer without a task. |
| Member | Work in assigned projects, create and complete tasks, track time, and use enabled project tools. Must select or create a task before starting a timer. |
| Client | Enter assigned projects as a guest and access only items marked `client-visible`. No access to internal chat, private notes, admin, AI configuration, connectors, or unrelated projects. |

Authorization is enforced on the server and in Firebase Security Rules. Hiding a control in the interface is not authorization.

## Product Areas and Routes

```text
/login                         Sign in
/onboarding                    Personalized first-run setup
/                              Authenticated dashboard / My Work
/projects                      Projects index
/projects/[projectId]          Project home
/projects/[projectId]/todos    List and assignment view
/projects/[projectId]/time     Timers, entries, and reports
/projects/[projectId]/board    Card table
/projects/[projectId]/messages Announcements and updates
/projects/[projectId]/docs     Docs, files, and images
/projects/[projectId]/calendar Events, milestones, and deadlines
/projects/[projectId]/chat     Project chat
/projects/[projectId]/check-ins Automatic check-ins and responses
/projects/[projectId]/links    External links
/templates                     Project templates
/people                        Members and clients
/agents                        AI agents, runs, and approvals
/connectors                    External service connections
/activity                      Organization audit trail
/admin                         Organization administration
```

Only routes for enabled tools appear in a project. A compact project switcher and global timer remain available across authenticated pages.

## Core User Flows

### Authentication and Session Exit

- User signs in with Google through Firebase Authentication.
- The server verifies the Firebase ID token and creates or refreshes a secure session.
- First-time users enter personalized onboarding; returning users land on My Work.
- Logout revokes the application session, clears the session cookie, signs out of Firebase, and returns to `/login`.
- Protected pages and mutations reject missing, expired, or unauthorized sessions.

### Personalized Onboarding

- Capture display name, timezone, preferred working hours, and notification preferences.
- Create or join an organization.
- For a new organization, create the first project or select a template.
- Invite internal members and clients later; onboarding must not block a solo user from reaching their first task.
- End with a short guided action: create a task and start/stop a timer.

### To-Dos

- Create a task in a project with title, description, assignee, status, priority, due date, visibility, and optional parent/card relationship.
- Filter My Work by assignment, due date, status, and project.
- Reorder or move tasks when the project uses a card table.
- Complete, reopen, archive, and audit meaningful changes.
- Existing daily tasks, subtasks, weekly priorities, goals, and habits are legacy functionality. Reuse concepts deliberately; do not silently mix legacy user collections with collaborative project data.

### Live Time Tracking

- A standard member selects an assigned project task or creates a task inline before starting.
- The system allows at most one active timer per user across all organizations.
- The timer persists across navigation and page refreshes.
- Stopping the timer creates a time entry containing project, task, user, start, end, duration, notes, billable flag, and audit timestamps.
- When a timer references a task, the stop confirmation can optionally mark that task complete in the same atomic operation. It defaults off to prevent accidental completion.
- Admins may start a project-level timer without a task; the UI should still encourage task selection.
- Manual entries require project, task for non-admins, date, duration or start/end, and optional notes.
- Internal entries are not exposed to clients by default. Client reports include only entries explicitly approved or included by an authorized member.

### Client Visibility

- Supported project records expose an explicit `internal` / `client-visible` control.
- New records default to `internal`, including AI-generated records and copied template content.
- Changing visibility is an audited action.
- Parent visibility does not automatically override a more restrictive child. A client-visible task with an internal attachment does not expose that attachment.
- Client users never see the existence, count, title, search result, notification, or URL metadata of internal records.

### Resend Email Notifications

- Transactional email supports invitations, assignment notifications, mentions, due/reminder notices, check-ins, announcements, and daily/weekly digests.
- Users control non-essential notification preferences; security and invitation mail remains transactional.
- Every queued email has a durable notification record, deterministic idempotency key, delivery status, and retry history.
- Resend webhooks update delivery state and are deduplicated.
- Email content obeys project access and visibility. Internal details must never be included in client email.

### AI Agents and Connectors

- Admins configure agents and connectors; project members may invoke only allowed agents.
- Agents read only data available within their organization, project, role, connector, and visibility scope.
- Read-only analysis and drafting may run automatically.
- Sending email, changing shared records, assigning work, deleting data, or invoking a write-capable connector creates an approval request.
- Approved actions execute once, record the approver, and leave an audit trail. Rejected or expired actions do nothing.
- Agent output is untrusted until validated. AI never decides authorization.

### Activity and Audit Trail

- Every meaningful application action produces an audit event, whether it succeeds or fails.
- Actors include users, administrators, clients, scheduled system jobs, email/webhook integrations, connectors, and AI agents.
- Audited actions include authentication, invitations, membership and role changes, project and tool changes, record creation/update/archive/delete, visibility changes, file access, timer operations, manual time corrections, notification sends, connector use, approvals, and AI tool execution.
- Audit events record who acted, what action was attempted, the organization/project and target record, outcome, timestamp, request/run correlation ID, and a safe summary of changed fields.
- Secrets, tokens, session values, email/file bodies, chat content, prompts, and sensitive field values are never copied wholesale into the audit trail.
- Organization admins can search and filter the organization audit trail. Project members may see project activity relevant to content they are authorized to access. Clients do not receive the internal audit trail in the initial release.
- Audit events are append-only. Corrections create additional events rather than editing or deleting history.
- Audit logging is separate from product analytics: audit answers who changed what and when; analytics measures aggregate product usage.

## Project Tools

| Tool | Initial purpose | Client visibility |
| --- | --- | --- |
| To-dos | Lists, assignments, priority, status, deadlines, subtasks | Per task/subtask |
| Time tracking | Live timer, manual entries, reports | Reports/entries explicitly shared |
| Message board | Broadcast announcements and durable updates | Per post |
| Docs, files, images | Project knowledge and attachments in Firebase Storage | Per document/file |
| Calendar | Events, milestones, and deadlines | Per event |
| Chat | Real-time project conversation | Separate internal and client-visible rooms; internal by default |
| Card table | Tasks represented in configurable columns | Follows task visibility |
| Automatic check-ins | Scheduled questions and structured responses | Per check-in and response |
| Email forwards | Project-specific inbound address creates a controlled record | Internal until reviewed |
| External links | Curated project links with labels and access controls | Per link |

## Project Templates

A template defines project defaults: name pattern, description, enabled tools, task lists/cards, milestones, check-ins, roles, and default visibility. Applying a template copies versioned configuration into a new project. Updating the source template never silently mutates existing projects.

## Initial Release Scope

### P0 — Build First

- Reliable login, protected routes, server-verified sessions, and logout
- Organization bootstrap, memberships, roles, and project assignment
- Personalized onboarding sufficient to reach a first project
- Projects and project navigation
- To-dos with assignment, priority, due dates, status, and visibility
- Live and manual time tracking with one-active-timer enforcement
- Non-admin timer-to-task requirement
- Basic admin for people, clients, projects, and roles
- Append-only audit logging and an admin activity viewer
- Resend invitations and essential task/time notifications

### P1 — Collaboration Foundation

- File storage and attachments
- Client portal and visibility review
- Message board
- Calendar
- Project templates
- Time reports and client-safe exports
- Notification preferences and digests

### P2 — Extended Tools

- Card table
- Chat
- Automatic check-ins
- External links
- Email forwards
- AI agents, approval inbox, and initial connectors

### Later / Not in Initial Release

- Billing and subscriptions
- Payroll or invoicing
- Offline-native mobile applications
- Fully autonomous AI writes
- Arbitrary custom roles or field-level permission builders
- Public file buckets or anonymous project sharing
- Cross-organization reporting

## Success Criteria

- A new user can sign in, finish onboarding, create a project and task, start a compliant timer, and record time in under five minutes.
- Logout terminates access on both client and server paths.
- A member can never run two active timers.
- A non-admin cannot start a timer without a saved task.
- A client cannot discover any internal record through pages, APIs, search, files, notifications, or direct URLs.
- An admin can invite a member or client and see email delivery status.
- Retried email jobs do not produce duplicate mail.
- Consequential AI actions cannot execute without recorded human approval.
- Every collaborative query and mutation is organization- and project-scoped.
- Every meaningful application action has a correlated, redacted audit event that cannot be edited through the product UI.
