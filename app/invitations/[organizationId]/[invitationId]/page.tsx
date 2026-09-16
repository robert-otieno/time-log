import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionActor } from "@/lib/server-session";
import { acceptInvitationAction } from "./actions";

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ organizationId: string; invitationId: string }>; searchParams: Promise<{ token?: string; error?: string }> }) {
  const [{ organizationId, invitationId }, query, actor] = await Promise.all([params, searchParams, getSessionActor()]);
  const token = query.token ?? "";
  const action = acceptInvitationAction.bind(null, organizationId, invitationId, token);
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Join Time Log</CardTitle><CardDescription>{actor ? `Continue as ${actor.email ?? "your signed-in account"}.` : "Sign in with the Google account that received this invitation."}</CardDescription></CardHeader><CardContent>{query.error && <p role="alert" className="text-sm text-destructive">This invitation is invalid, expired, already used, or belongs to another account.</p>}</CardContent><CardFooter><form action={action} className="w-full"><Button className="w-full" disabled={!token}>{actor ? "Accept invitation" : "Sign in to continue"}</Button></form></CardFooter></Card></main>;
}
