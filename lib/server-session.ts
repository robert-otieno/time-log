import "server-only";

import { cookies } from "next/headers";

import { AuthenticationError, verifyFirebaseSessionCookie } from "@/lib/auth-server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { activeOrganizationSelectionSchema, organizationMemberSchema } from "@/domain/organizations/schemas";
import { personalOrganizationId } from "@/domain/organizations/bootstrap";
import { getAdminDb } from "@/lib/firebase-admin";

export async function getSessionActor() {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!value) return null;
  try { return await verifyFirebaseSessionCookie(value); }
  catch (error) {
    if (error instanceof AuthenticationError) return null;
    throw error;
  }
}

export async function getActiveOrganizationId(actor: { uid: string }) {
  const db = getAdminDb();
  const selectionSnapshot = await db.doc(`users/${actor.uid}/preferences/workspace`).get();
  if (selectionSnapshot.exists) {
    const selection = activeOrganizationSelectionSchema.safeParse(selectionSnapshot.data());
    if (selection.success) {
      const membership = await db.doc(`organizations/${selection.data.activeOrganizationId}/members/${actor.uid}`).get();
      if (membership.exists && organizationMemberSchema.parse(membership.data()).status === "active") return selection.data.activeOrganizationId;
    }
  }
  return personalOrganizationId(actor.uid);
}
