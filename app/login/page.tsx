import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { AuthenticationError, verifyFirebaseSessionCookie } from "@/lib/auth-server";
import { safeReturnPath, SESSION_COOKIE_NAME } from "@/lib/auth-session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const nextValue = (await searchParams).next;
  const returnPath = safeReturnPath(
    Array.isArray(nextValue) ? nextValue[0] : nextValue,
  );
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      await verifyFirebaseSessionCookie(sessionCookie);
      redirect(returnPath);
    } catch (error) {
      if (!(error instanceof AuthenticationError)) throw error;
    }
  }

  return <LoginForm returnPath={returnPath} />;
}
