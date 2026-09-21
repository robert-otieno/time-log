import { NextResponse } from "next/server";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { authorizeFileDownload } from "@/domain/files/service";
import { getAdminStorageBucket } from "@/lib/firebase-admin";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; fileId: string }> }) {
  const actor = await getSessionActor(); if (!actor) return NextResponse.redirect(new URL("/login", _request.url));
  try {
    const { projectId, fileId } = await params; const organizationId = await getActiveOrganizationId(actor); const file = await authorizeFileDownload(actor, organizationId, projectId, fileId, createRequestCorrelation());
    const [url] = await getAdminStorageBucket().file(file.storagePath).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000, responseDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}` });
    return NextResponse.redirect(url, 303);
  } catch { return NextResponse.json({ error: "File download denied" }, { status: 403 }); }
}
