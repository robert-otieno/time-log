import { NextResponse } from "next/server";

import {
  isSameOriginJsonRequest,
  SESSION_COOKIE_NAME,
} from "@/lib/auth-session";

export async function DELETE(request: Request) {
  if (!isSameOriginJsonRequest(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
  response.cookies.set("token", "", {
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
