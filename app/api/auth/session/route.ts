import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authActorFromClaims,
  AuthenticationError,
  verifyFirebaseIdTokenClaims,
} from "@/lib/auth-server";
import { createRequestCorrelation } from "@/domain/audit/correlation";
import { ensurePersonalOrganization } from "@/domain/organizations/bootstrap";
import {
  isRecentSignIn,
  isSameOriginJsonRequest,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/auth-session";
import { getAdminAuth } from "@/lib/firebase-admin";

const requestSchema = z.object({ idToken: z.string().min(1) }).strict();

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    priority: "high" as const,
  };
}

export async function POST(request: Request) {
  if (!isSameOriginJsonRequest(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const claims = await verifyFirebaseIdTokenClaims(parsed.data.idToken, {
      checkRevoked: true,
    });
    if (!isRecentSignIn(claims.auth_time)) {
      return NextResponse.json(
        { error: "Please sign in again before continuing." },
        { status: 401 },
      );
    }

    // Bootstrap once when the authenticated session is established. Running this
    // transaction from the protected layout made every navigation pay four reads.
    await ensurePersonalOrganization(
      authActorFromClaims(claims),
      createRequestCorrelation(),
    );

    const sessionCookie = await getAdminAuth().createSessionCookie(
      parsed.data.idToken,
      { expiresIn: SESSION_DURATION_MS },
    );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, sessionCookieOptions());
    response.cookies.set("token", "", { path: "/", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Your sign-in could not be verified. Please try again." },
        { status: 401 },
      );
    }
    console.error("POST /api/auth/session", { outcome: "failed" });
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}
