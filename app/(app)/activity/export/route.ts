import { NextResponse } from "next/server";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { AuditRepository } from "@/domain/audit/repository";
import { AUDIT_SCHEMA_VERSION } from "@/domain/audit/schemas";
import { auditFiltersFromSearch, exportAuditEvents } from "@/domain/audit/viewer";
import { OrganizationRepository } from "@/domain/organizations/repository";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

const csvCell = (value: unknown) => { const raw = String(value ?? ""); const text = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw; return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };

export async function GET(request: Request) {
  const actor = await getSessionActor(); if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const organizationId = await getActiveOrganizationId(actor); const organization = await new OrganizationRepository().getOrganization(organizationId); if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const search = Object.fromEntries(new URL(request.url).searchParams); const format = search.format === "json" ? "json" : "csv"; const filters = auditFiltersFromSearch(search); const correlation = createRequestCorrelation(); const audits = new AuditRepository();
  const audit = (outcome: "succeeded" | "denied" | "failed", reasonCode: string | null) => audits.append({ organizationId, projectId: null, actor: { type: "user", id: actor.uid, role: outcome === "denied" ? null : "admin" }, action: outcome === "succeeded" ? "audit.export.succeeded" : "audit.export.failed", target: { type: "organization", id: organizationId }, outcome, changes: [{ field: "exportFormat", to: format }], reasonCode, requestId: correlation.requestId, runId: null, ipHash: null, userAgentSummary: null, schemaVersion: AUDIT_SCHEMA_VERSION });
  try {
    const events = await exportAuditEvents(actor, organizationId, filters, organization.timezone);
    if (!events) { await audit("denied", "audit_export_denied"); return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store" } }); }
    const rows = events.map((event) => ({ occurredAt: new Date(event.occurredAt.seconds * 1000).toISOString(), action: event.action, outcome: event.outcome, actorType: event.actor.type, actorId: event.actor.id, projectId: event.projectId, targetType: event.target.type, targetId: event.target.id, reasonCode: event.reasonCode, requestId: event.requestId, runId: event.runId, changes: event.changes }));
    await audit("succeeded", null);
    const body = format === "json" ? JSON.stringify(rows, null, 2) : [["Occurred at","Action","Outcome","Actor type","Actor ID","Project ID","Target type","Target ID","Reason","Request ID","Run ID"], ...rows.map((row) => [row.occurredAt,row.action,row.outcome,row.actorType,row.actorId,row.projectId ?? "",row.targetType,row.targetId ?? "",row.reasonCode ?? "",row.requestId,row.runId ?? ""])].map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(format === "csv" ? `\uFEFF${body}` : body, { headers: { "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-${filters.startDate}-${filters.endDate}.${format}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    const reason = error instanceof Error && error.message === "audit_export_range" ? "audit_export_range" : "audit_export_limit"; await audit("failed", reason);
    return NextResponse.json({ error: "Narrow the export to no more than 90 days and 5,000 matching events." }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
  }
}
