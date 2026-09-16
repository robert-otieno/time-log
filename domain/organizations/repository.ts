import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  organizationMemberSchema,
  organizationSchema,
  projectAssignmentSchema,
  projectSchema,
  type Organization,
  type OrganizationMember,
  type Project,
  type ProjectAssignment,
} from "@/domain/organizations/schemas";

export class OrganizationRepository {
  constructor(private readonly db: Firestore = getAdminDb()) {}

  async getOrganization(organizationId: string): Promise<Organization | null> {
    const snapshot = await this.db.doc(`organizations/${organizationId}`).get();
    return snapshot.exists ? organizationSchema.parse({ id: snapshot.id, ...snapshot.data() }) : null;
  }

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const snapshot = await this.db.doc(`organizations/${organizationId}/members/${userId}`).get();
    return snapshot.exists ? organizationMemberSchema.parse(snapshot.data()) : null;
  }

  async getProject(organizationId: string, projectId: string): Promise<Project | null> {
    const snapshot = await this.db.doc(`organizations/${organizationId}/projects/${projectId}`).get();
    return snapshot.exists ? projectSchema.parse({ id: snapshot.id, ...snapshot.data() }) : null;
  }

  async getProjectAssignment(organizationId: string, projectId: string, userId: string): Promise<ProjectAssignment | null> {
    const snapshot = await this.db.doc(`organizations/${organizationId}/projects/${projectId}/projectMembers/${userId}`).get();
    return snapshot.exists ? projectAssignmentSchema.parse(snapshot.data()) : null;
  }
}
