import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runScheduledNotifications } from "@/domain/notifications/scheduler";
import { parseCronSecret } from "@/lib/resend-config";

export const runtime = "nodejs";
function authorized(request: Request, secret: string) { const value = request.headers.get("authorization") ?? ""; const expected = `Bearer ${secret}`; const left = Buffer.from(value); const right = Buffer.from(expected); return left.length === right.length && timingSafeEqual(left, right); }
export async function POST(request: Request) { let secret: string; try { secret = parseCronSecret(process.env); } catch { return NextResponse.json({ error: "Cron is not configured" }, { status: 500 }); } if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); try { const result = await runScheduledNotifications(); return NextResponse.json({ ok: true, ...result }); } catch { return NextResponse.json({ error: "Scheduled notification job failed" }, { status: 500 }); } }
