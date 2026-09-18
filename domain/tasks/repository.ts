import "server-only";
import type { DocumentSnapshot, Firestore, Query } from "firebase-admin/firestore";
import { projectTaskSchema, taskQuerySchema, type ProjectTask } from "@/domain/tasks/schemas";
import type { VisibilityQueryScope } from "@/domain/visibility/policy";
import type { VisibilityRecordAdapter } from "@/domain/visibility/service";
import { getAdminDb } from "@/lib/firebase-admin";

export class TaskRepository {
  constructor(private readonly db: Firestore = getAdminDb()) {}
  path(organizationId: string, projectId: string) { return `organizations/${organizationId}/projects/${projectId}/tasks`; }
  reference(organizationId: string, projectId: string, taskId: string) { return this.db.doc(`${this.path(organizationId, projectId)}/${taskId}`); }
  newReference(organizationId: string, projectId: string) { return this.db.collection(this.path(organizationId, projectId)).doc(); }
  parse(snapshot: DocumentSnapshot): ProjectTask | null { return snapshot.exists ? projectTaskSchema.parse({ id: snapshot.id, ...snapshot.data() }) : null; }
  async get(organizationId: string, projectId: string, taskId: string) { return this.parse(await this.reference(organizationId, projectId, taskId).get()); }
  async list(organizationId: string, projectId: string, raw: unknown, scope: VisibilityQueryScope): Promise<ProjectTask[]> {
    const command = taskQuerySchema.parse(raw); if (scope.kind === "deny") return [];
    let query: Query = this.db.collection(this.path(organizationId, projectId));
    if (!command.includeArchived) query = query.where("archivedAt", "==", null);
    if (scope.kind === "visibility") query = query.where("visibility", "==", scope.visibility);
    else if (command.visibility) query = query.where("visibility", "==", command.visibility);
    if (command.assigneeId) query = query.where("assigneeIds", "array-contains", command.assigneeId);
    if (command.statuses?.length === 1) query = query.where("status", "==", command.statuses[0]);
    else if (command.statuses && command.statuses.length > 1) query = query.where("status", "in", command.statuses);
    const snapshot = await query.orderBy("sortOrder", "asc").limit(command.limit).get();
    return snapshot.docs.map((document) => projectTaskSchema.parse({ id: document.id, ...document.data() }));
  }
}

export function taskVisibilityAdapter(repository: TaskRepository, organizationId: string, projectId: string): VisibilityRecordAdapter<ProjectTask> {
  return {
    targetType: "task",
    read: async (transaction, taskId) => repository.parse(await transaction.get(repository.reference(organizationId, projectId, taskId))),
    update: (transaction, task, values) => transaction.update(repository.reference(organizationId, projectId, task.id), values),
  };
}
