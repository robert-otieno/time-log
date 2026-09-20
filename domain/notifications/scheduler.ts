import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { FieldPath, FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { executeAuditedCommand, type AuditWriter } from "@/domain/audit/command";
import { AuditRepository } from "@/domain/audit/repository";
import { AUDIT_SCHEMA_VERSION, auditEventDraftSchema } from "@/domain/audit/schemas";
import { organizationMemberSchema, organizationSchema, projectAssignmentSchema, projectSchema } from "@/domain/organizations/schemas";
import { getEffectiveNotificationPreferences } from "@/domain/notifications/preferences";
import { deliverNotification } from "@/domain/notifications/outbox";
import { projectTaskSchema } from "@/domain/tasks/schemas";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseApplicationUrl } from "@/lib/resend-config";

const ORG_LIMIT = 10; const MEMBER_LIMIT = 100; const PROJECT_LIMIT = 100; const TASK_LIMIT = 100; const RETRY_LIMIT = 100; const ENQUEUE_LIMIT = 100;
const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 40);
export const localParts = (date: Date, timeZone: string) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const dateKey = (parts: Record<string, string>) => `${parts.year}-${parts.month}-${parts.day}`;
export const timedReminderDue = (dueAt: { seconds: number; nanoseconds: number }, now: Date) => { const target = dueAt.seconds * 1000 + dueAt.nanoseconds / 1e6 - 86_400_000; return target >= now.getTime() - 3_600_000 && target < now.getTime(); };

type Counts = { organizations: number; members: number; remindersQueued: number; digestsQueued: number; retriesAttempted: number; checkInsQueued: number };

function jobAudit(organizationId: string, runId: string, outcome: "succeeded" | "failed") {
  return auditEventDraftSchema.parse({ organizationId, projectId: null, actor: { type: "system", id: "notification-scheduler", role: null }, action: outcome === "succeeded" ? "notification.job.completed" : "notification.job.failed", target: { type: "job-run", id: runId }, outcome, changes: [{ field: "outcome", to: outcome }], reasonCode: outcome === "failed" ? "job_failed" : null, requestId: randomUUID(), runId, ipHash: null, userAgentSummary: null, schemaVersion: AUDIT_SCHEMA_VERSION });
}

async function enqueue(db: Firestore, auditRepository: AuditWriter | undefined, organizationId: string, projectId: string | null, id: string, data: Record<string, unknown>, runId: string) {
  const reference = db.doc(`organizations/${organizationId}/notifications/${id}`);
  return executeAuditedCommand<{ created: boolean }>({ db, auditRepository, organizationId, projectId, actor: { type: "system", id: "notification-scheduler", role: null }, action: "notification.email.queued", target: { type: "notification", id }, correlation: createRequestCorrelation(runId), changes: [{ field: "deliveryStatus", to: "queued" }], shouldAuditSuccess: (result) => result.created, execute: async (transaction) => { const existing = await transaction.get(reference); if (existing.exists) return { created: false }; transaction.create(reference, data); return { created: true }; } });
}

export async function runScheduledNotifications(dependencies: { db?: Firestore; auditRepository?: AuditWriter; now?: Date; deliver?: typeof deliverNotification } = {}) {
  const db = dependencies.db ?? getAdminDb(); const nowDate = dependencies.now ?? new Date(); const now = Timestamp.fromDate(nowDate); const runId = randomUUID(); const stateRef = db.doc("systemJobs/notifications"); const runRef = db.doc(`systemJobRuns/${runId}`); const state = await stateRef.get(); const organizationCursor = state.data()?.organizationCursor as string | undefined; const memberCursor = state.data()?.memberCursor as string | undefined;
  await runRef.create({ type: "notifications", status: "running", startedAt: FieldValue.serverTimestamp(), organizationCursor: organizationCursor ?? null, memberCursor: memberCursor ?? null });
  const counts: Counts = { organizations: 0, members: 0, remindersQueued: 0, digestsQueued: 0, retriesAttempted: 0, checkInsQueued: 0 }; const processedOrganizationIds = new Set<string>(); const auditRepository = dependencies.auditRepository ?? new AuditRepository(db);
  try {
    let organizationQuery = db.collection("organizations").orderBy(FieldPath.documentId()).limit(ORG_LIMIT); if (organizationCursor) organizationQuery = memberCursor ? organizationQuery.startAt(organizationCursor) : organizationQuery.startAfter(organizationCursor); const organizations = await organizationQuery.get(); let queued = 0; let nextOrganizationCursor: string | null = null; let nextMemberCursor: string | null = null; let capped = false;
    for (const organizationDocument of organizations.docs) {
      const organization = organizationSchema.parse({ id: organizationDocument.id, ...organizationDocument.data() }); counts.organizations++; processedOrganizationIds.add(organization.id);
      let memberQuery = db.collection(`organizations/${organization.id}/members`).orderBy(FieldPath.documentId()).limit(MEMBER_LIMIT); if (organization.id === organizationCursor && memberCursor) memberQuery = memberQuery.startAfter(memberCursor); const [members, projects] = await Promise.all([memberQuery.get(), db.collection(`organizations/${organization.id}/projects`).where("status", "==", "active").limit(PROJECT_LIMIT).get()]); let lastCompletedMember: string | null = memberCursor ?? null;
      for (const memberDocument of members.docs) {
        if (queued >= ENQUEUE_LIMIT) { capped = true; nextOrganizationCursor = organization.id; nextMemberCursor = lastCompletedMember; break; } const member = organizationMemberSchema.parse(memberDocument.data()); if (member.status !== "active" || member.role === "client" || !member.email) { lastCompletedMember = memberDocument.id; continue; } counts.members++;
        const preferences = await getEffectiveNotificationPreferences(member.userId, organization.id, db); if (!preferences) continue; const parts = localParts(nowDate, preferences.timezone); const today = dateKey(parts); const taskRows: Array<{ task: ReturnType<typeof projectTaskSchema.parse>; projectName: string }> = [];
        let memberIncomplete = false; projectLoop: for (const projectDocument of projects.docs) {
          const project = projectSchema.parse({ id: projectDocument.id, ...projectDocument.data() }); if (!project.enabledTools.includes("todos")) continue;
          if (member.role !== "admin") { const assignment = await db.doc(`organizations/${organization.id}/projects/${project.id}/projectMembers/${member.userId}`).get(); if (!assignment.exists || projectAssignmentSchema.parse(assignment.data()).status !== "active") continue; }
          const tasks = await db.collection(`organizations/${organization.id}/projects/${project.id}/tasks`).where("assigneeIds", "array-contains", member.userId).where("archivedAt", "==", null).limit(TASK_LIMIT).get();
          for (const taskDocument of tasks.docs) { const task = projectTaskSchema.parse({ id: taskDocument.id, ...taskDocument.data() }); if (task.status === "done") continue; taskRows.push({ task, projectName: project.name });
            const eligible = preferences.email.reminders && ((task.dueTimeSet && task.dueAt && timedReminderDue(task.dueAt, nowDate)) || (!task.dueTimeSet && task.dueDate === today && parts.hour === "09")); if (!eligible || queued >= ENQUEUE_LIMIT) continue;
            const dueToken = task.dueAt ? `${task.dueAt.seconds}` : task.dueDate!; const id = `reminder-${digest(`${organization.id}/${project.id}/${task.id}/${member.userId}/${dueToken}`)}`; const result = await enqueue(db, auditRepository, organization.id, project.id, id, { type: "reminder", recipientEmail: member.email, recipientUserId: member.userId, projectId: project.id, taskId: task.id, templateData: { projectName: project.name, itemTitle: task.title, dueLabel: task.dueTimeSet ? "in about 24 hours" : "today", targetUrl: `${parseApplicationUrl(process.env)}/projects/${project.id}/todos?task=${task.id}` }, status: "queued", idempotencyKey: `reminder/${id}`, providerMessageId: null, providerStatus: null, providerEventAt: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, runId); if (result.created) { counts.remindersQueued++; queued++; await (dependencies.deliver ?? deliverNotification)(organization.id, id, { db }); if (queued >= ENQUEUE_LIMIT) { memberIncomplete = true; break projectLoop; } }
          }
        }
        if (memberIncomplete) { capped = true; nextOrganizationCursor = organization.id; nextMemberCursor = lastCompletedMember; break; }
        const digestDue = parts.hour === "08" && (preferences.email.digestFrequency === "daily" || (preferences.email.digestFrequency === "weekly" && parts.weekday === "Mon"));
        if (digestDue && taskRows.length && queued < ENQUEUE_LIMIT) { const period = preferences.email.digestFrequency === "daily" ? today : `${today}-weekly`; const id = `digest-${digest(`${organization.id}/${member.userId}/${period}`)}`; const result = await enqueue(db, auditRepository, organization.id, null, id, { type: "digest", recipientEmail: member.email, recipientUserId: member.userId, templateData: { organizationName: organization.name, periodLabel: preferences.email.digestFrequency === "daily" ? "daily" : "weekly", summary: `${taskRows.length} unfinished assigned ${taskRows.length === 1 ? "task" : "tasks"} across ${new Set(taskRows.map((row) => row.projectName)).size} active ${new Set(taskRows.map((row) => row.projectName)).size === 1 ? "project" : "projects"}.`, targetUrl: `${parseApplicationUrl(process.env)}/` }, status: "queued", idempotencyKey: `digest/${id}`, providerMessageId: null, providerStatus: null, providerEventAt: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, runId); if (result.created) { counts.digestsQueued++; queued++; await (dependencies.deliver ?? deliverNotification)(organization.id, id, { db }); } }
        lastCompletedMember = memberDocument.id;
      }
      if (capped) break;
    }
    const retrySnapshot = await db.collectionGroup("notifications").where("status", "==", "failed").where("nextAttemptAt", "<=", now).orderBy("nextAttemptAt").limit(RETRY_LIMIT).get(); for (const document of retrySnapshot.docs) { const parts = document.ref.path.split("/"); counts.retriesAttempted++; await (dependencies.deliver ?? deliverNotification)(parts[1], document.id, { db }); }
    if (!capped) { const last = organizations.docs.at(-1)?.id ?? null; nextOrganizationCursor = organizations.size === ORG_LIMIT ? last : null; nextMemberCursor = null; } await db.runTransaction(async (transaction) => { transaction.set(stateRef, { organizationCursor: nextOrganizationCursor, memberCursor: nextMemberCursor, updatedAt: FieldValue.serverTimestamp(), lastRunId: runId }, { merge: true }); transaction.update(runRef, { status: "completed", counts, organizationCursor: nextOrganizationCursor, memberCursor: nextMemberCursor, completedAt: FieldValue.serverTimestamp() }); for (const organizationId of processedOrganizationIds) auditRepository.appendInTransaction(transaction, jobAudit(organizationId, runId, "succeeded")); }); return { runId, counts, cursor: { organizationId: nextOrganizationCursor, memberId: nextMemberCursor } };
  } catch (error) { await db.runTransaction(async (transaction) => { transaction.update(runRef, { status: "failed", counts, errorCode: "job_failed", completedAt: FieldValue.serverTimestamp() }); for (const organizationId of processedOrganizationIds) auditRepository.appendInTransaction(transaction, jobAudit(organizationId, runId, "failed")); }); throw error; }
}
