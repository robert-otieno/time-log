import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import type { ProjectTool } from "@/domain/projects/schemas";
import { getAdminDb } from "@/lib/firebase-admin";

type ClientToolDefinition = {
  collection: string;
  visibilityField: string;
  visibleValue: string;
};

const CLIENT_TOOL_DEFINITIONS: Partial<Record<ProjectTool, ClientToolDefinition>> = {
  todos: { collection: "tasks", visibilityField: "visibility", visibleValue: "client-visible" },
};

export function isClientCapableTool(tool: ProjectTool): boolean {
  return tool in CLIENT_TOOL_DEFINITIONS;
}

export async function listAvailableClientTools(
  organizationId: string,
  projectId: string,
  enabledTools: readonly ProjectTool[],
  db: Firestore = getAdminDb(),
): Promise<ProjectTool[]> {
  const candidates = enabledTools.filter(isClientCapableTool);
  const available = await Promise.all(candidates.map(async (tool) => {
    const definition = CLIENT_TOOL_DEFINITIONS[tool]!;
    const snapshot = await db
      .collection(`organizations/${organizationId}/projects/${projectId}/${definition.collection}`)
      .where(definition.visibilityField, "==", definition.visibleValue)
      .where("archivedAt", "==", null)
      .limit(1)
      .get();
    return snapshot.empty ? null : tool;
  }));
  return available.filter((tool): tool is ProjectTool => tool !== null);
}
