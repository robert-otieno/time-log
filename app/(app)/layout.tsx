import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthenticationError, verifyFirebaseSessionCookie } from "@/lib/auth-server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) redirect("/login?next=/");

  try {
    await verifyFirebaseSessionCookie(sessionCookie);
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login?next=/");
    throw error;
  }

  return children;
}
