import "server-only";

import { FieldPath, Timestamp, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/domain/audit/actions";
import { auditEventSchema, type AuditEvent } from "@/domain/audit/schemas";
import { organizationMemberSchema } from "@/domain/organizations/schemas";
import { getAccessibleProject } from "@/domain/projects/service";
import type { AuthActor } from "@/lib/auth-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { zonedDateBoundary } from "@/domain/time/reporting";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const auditFiltersSchema = z.object({ startDate: date, endDate: date, actorId: z.string().trim().max(128).optional(), action: z.enum(AUDIT_ACTIONS).optional(), outcome: z.enum(["succeeded", "denied", "failed"]).optional(), projectId: z.string().trim().max(128).optional(), targetType: z.enum(["session", "organization", "membership", "invitation", "client", "project", "task", "migration", "timer", "time-entry", "file", "notification", "approval", "connector", "agent-run"]).optional(), cursor: z.string().max(512).optional() }).strict().refine((value) => value.endDate >= value.startDate && Date.parse(`${value.endDate}T00:00:00Z`) - Date.parse(`${value.startDate}T00:00:00Z`) <= 366 * 86_400_000, { message: "Choose a valid range of at most one year" });
export type AuditFilters = z.infer<typeof auditFiltersSchema>;

function cursorEncode(event: AuditEvent) { return Buffer.from(JSON.stringify([event.occurredAt.seconds, event.occurredAt.nanoseconds, event.id])).toString("base64url"); }
function cursorDecode(value?: string) { if (!value) return null; try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as unknown; return z.tuple([z.number().int(), z.number().int(), z.string().min(1)]).parse(parsed); } catch { return null; } }
function matches(event: AuditEvent, filters: AuditFilters, forcedProjectId?: string) { return (!filters.actorId || event.actor.id === filters.actorId) && (!filters.action || event.action === filters.action) && (!filters.outcome || event.outcome === filters.outcome) && (!(forcedProjectId ?? filters.projectId) || event.projectId === (forcedProjectId ?? filters.projectId)) && (!filters.targetType || event.target.type === filters.targetType); }

export async function authorizeAuditView(actor: AuthActor, organizationId: string, projectId: string | undefined, db: Firestore) {
  const memberSnapshot = await db.doc(`organizations/${organizationId}/members/${actor.uid}`).get(); const member = memberSnapshot.exists ? organizationMemberSchema.parse(memberSnapshot.data()) : null;
  if (!member || member.status !== "active" || member.role === "client") return null;
  if (!projectId) return member.role === "admin" ? { role: member.role, projectId: undefined } : null;
  const access = await getAccessibleProject(actor, organizationId, projectId, db); return access && access.role !== "client" ? { role: access.role, projectId } : null;
}

export async function listAuditEvents(actor: AuthActor, organizationId: string, raw: unknown, timezone: string, db: Firestore = getAdminDb()) {
  const filters = auditFiltersSchema.parse(raw); const access = await authorizeAuditView(actor, organizationId, filters.projectId, db); if (!access) return null;
  const start = Timestamp.fromDate(zonedDateBoundary(filters.startDate, timezone)); const end = Timestamp.fromMillis(zonedDateBoundary(filters.endDate, timezone, true).getTime() - 1); const decoded = cursorDecode(filters.cursor);
  let query = db.collection(`organizations/${organizationId}/auditEvents`).where("occurredAt", ">=", start).where("occurredAt", "<=", end).orderBy("occurredAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (decoded) query = query.startAfter(new Timestamp(decoded[0], decoded[1]), decoded[2]);
  const events: AuditEvent[] = []; let last: QueryDocumentSnapshot | null = null; let scanned = 0;
  while (events.length < 51 && scanned < 1000) { const batchSize = Math.min(200, 1000 - scanned); const page = await query.limit(batchSize).get(); if (page.empty) break; for (const document of page.docs) { last = document; scanned++; const event = auditEventSchema.parse({ id: document.id, ...document.data() }); if (matches(event, filters, access.projectId)) events.push(event); if (events.length >= 51 || scanned >= 1000) break; } if (page.size < batchSize || events.length >= 51 || scanned >= 1000) break; query = db.collection(`organizations/${organizationId}/auditEvents`).where("occurredAt", ">=", start).where("occurredAt", "<=", end).orderBy("occurredAt", "desc").orderBy(FieldPath.documentId(), "desc").startAfter(last!); }
  const hasMore = events.length > 50 || scanned >= 1000; const visible = events.slice(0, 50); return { role: access.role, events: visible, nextCursor: hasMore && visible.length ? cursorEncode(visible.at(-1)!) : null, scanLimited: scanned >= 1000 };
}

export function auditSummary(event: AuditEvent) { const subject = event.target.id ? `${event.target.type} ${event.target.id}` : event.target.type; return `${event.action.split(".").join(" ")} ${subject} (${event.outcome})`; }

export async function exportAuditEvents(actor: AuthActor, organizationId: string, raw: unknown, timezone: string, db: Firestore = getAdminDb()) { const filters = auditFiltersSchema.omit({ cursor: true }).parse(raw); const access = await authorizeAuditView(actor, organizationId, undefined, db); if (!access || access.role !== "admin") return null; const span = (Date.parse(`${filters.endDate}T00:00:00Z`) - Date.parse(`${filters.startDate}T00:00:00Z`)) / 86_400_000; if (span > 89) throw new Error("audit_export_range"); const start = Timestamp.fromDate(zonedDateBoundary(filters.startDate, timezone)); const end = Timestamp.fromMillis(zonedDateBoundary(filters.endDate, timezone, true).getTime() - 1); let query = db.collection(`organizations/${organizationId}/auditEvents`).where("occurredAt", ">=", start).where("occurredAt", "<=", end).orderBy("occurredAt", "desc").orderBy(FieldPath.documentId(), "desc"); const events: AuditEvent[] = []; let scanned = 0; while (events.length <= 5000 && scanned < 50_000) { const page = await query.limit(500).get(); if (page.empty) break; for (const document of page.docs) { scanned++; const event = auditEventSchema.parse({ id: document.id, ...document.data() }); if (matches(event, filters)) events.push(event); if (events.length > 5000) break; } if (page.size < 500 || events.length > 5000) break; query = db.collection(`organizations/${organizationId}/auditEvents`).where("occurredAt", ">=", start).where("occurredAt", "<=", end).orderBy("occurredAt", "desc").orderBy(FieldPath.documentId(), "desc").startAfter(page.docs.at(-1)!); } if (events.length > 5000 || scanned >= 50_000) throw new Error("audit_export_limit"); return events; }

export function auditFiltersFromSearch(search: Record<string, string | string[] | undefined>, projectId?: string, now = new Date()) { const value = (key: string) => typeof search[key] === "string" && search[key] ? search[key] as string : undefined; const endDate = now.toISOString().slice(0, 10); const start = new Date(`${endDate}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 29); const parsed = auditFiltersSchema.safeParse({ startDate: value("startDate") ?? start.toISOString().slice(0, 10), endDate: value("endDate") ?? endDate, actorId: value("actorId"), action: value("action"), outcome: value("outcome"), projectId: projectId ?? value("projectId"), targetType: value("targetType"), cursor: value("cursor") }); return parsed.success ? parsed.data : auditFiltersSchema.parse({ startDate: start.toISOString().slice(0, 10), endDate, projectId }); }
