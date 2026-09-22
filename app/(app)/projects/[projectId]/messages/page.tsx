import { notFound, redirect } from "next/navigation";
import { MessageBoard } from "@/components/messages/message-board";
import { readMessageBoard } from "@/domain/messages/read";
import { getAccessibleProject } from "@/domain/projects/service";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function MessagesPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ archived?: string; before?: string }> }) { const actor = await getSessionActor(); if (!actor) redirect("/login?next=/projects"); const { projectId } = await params; const query = await searchParams; const org = await getActiveOrganizationId(actor); const access = await getAccessibleProject(actor, org, projectId); if (!access || !access.project.enabledTools.includes("messages")) notFound(); const archived = query.archived === "1"; if (archived && access.role === "client") notFound(); const board = await readMessageBoard(actor, org, projectId, archived, query.before ?? null); if (!board) notFound(); return <MessageBoard projectId={projectId} initialPosts={board.posts} viewer={board.member} canCreatePosts={board.canCreatePosts && access.project.status === "active"} canModerate={board.canModerate} archived={archived} nextCursor={board.nextCursor} />; }
