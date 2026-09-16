import "server-only";

import { cookies } from "next/headers";

import { AuthenticationError, verifyFirebaseSessionCookie } from "@/lib/auth-server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

export async function getSessionActor() {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!value) return null;
  try { return await verifyFirebaseSessionCookie(value); }
  catch (error) {
    if (error instanceof AuthenticationError) return null;
    throw error;
  }
}

