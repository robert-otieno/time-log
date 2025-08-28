import { firestore } from "@/lib/firebase-client";
import { getUserIdFromRequest } from "@/lib/get-authenticated-user";
import { doc, updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({ status: z.enum(["acknowledged", "snoozed"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserIdFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const parsedParams = paramsSchema.safeParse({ id });
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const body = await req.json();
    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ref = doc(firestore, "users", user.uid, "nudge_events", parsedParams.data.id);
    await updateDoc(ref, { status: parsedBody.data.status });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH /api/nudges/[id]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
