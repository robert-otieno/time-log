import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { hasCapability } from "@/domain/organizations/policy";
import { clientSchema, invitationSchema, organizationMemberSchema, projectSchema } from "@/domain/organizations/schemas";
import { getAdminDb } from "@/lib/firebase-admin";

export async function listPeopleAdminData(organizationId: string, userId: string, db: Firestore = getAdminDb()) {
  const membershipSnapshot = await db.doc(`organizations/${organizationId}/members/${userId}`).get();
  const actor = membershipSnapshot.exists ? organizationMemberSchema.parse(membershipSnapshot.data()) : null;
  if (!hasCapability(actor, "members.manage")) return null;
  const [members, clients, invitations, projects] = await Promise.all([
    db.collection(`organizations/${organizationId}/members`).get(),
    db.collection(`organizations/${organizationId}/clients`).get(),
    db.collection(`organizations/${organizationId}/invitations`).orderBy("createdAt", "desc").limit(100).get(),
    db.collection(`organizations/${organizationId}/projects`).where("status", "==", "active").get(),
  ]);
  return {
    members: members.docs.map((document) => organizationMemberSchema.parse(document.data())),
    clients: clients.docs.map((document) => clientSchema.parse({ id: document.id, ...document.data() })),
    invitations: invitations.docs.map((document) => invitationSchema.parse({ id: document.id, ...document.data() })),
    projects: projects.docs.map((document) => projectSchema.parse({ id: document.id, ...document.data() })),
  };
}
