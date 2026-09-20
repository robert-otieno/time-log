import { NextResponse } from "next/server";
import { processResendWebhook } from "@/domain/notifications/webhook";
import { getResendClient } from "@/lib/resend";
import { parseResendWebhookSecret } from "@/lib/resend-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const id = request.headers.get("svix-id"); const timestamp = request.headers.get("svix-timestamp"); const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  let webhookSecret: string; let resend: ReturnType<typeof getResendClient>;
  try { webhookSecret = parseResendWebhookSecret(process.env); resend = getResendClient(); }
  catch { return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 }); }
  let event: unknown;
  try {
    const payload = await request.text();
    event = resend.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret });
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
  try { const result = await processResendWebhook(id, event); return NextResponse.json({ received: true, outcome: result.outcome }); }
  catch { return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 }); }
}
