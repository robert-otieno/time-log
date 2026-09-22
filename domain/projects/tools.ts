import type { ProjectTool } from "@/domain/projects/schemas";

export const PROJECT_TOOLS: readonly { id: ProjectTool; label: string; path: string }[] = [
  { id: "todos", label: "To-dos", path: "todos" },
  { id: "time", label: "Time tracking", path: "time" },
  { id: "messages", label: "Message board", path: "messages" },
  { id: "docs", label: "Docs and files", path: "docs" },
  { id: "calendar", label: "Calendar", path: "calendar" },
  { id: "chat", label: "Chat", path: "chat" },
  { id: "board", label: "Card table", path: "board" },
  { id: "check-ins", label: "Automatic check-ins", path: "check-ins" },
  { id: "email-forwards", label: "Email forwards", path: "email-forwards" },
  { id: "links", label: "External links", path: "links" },
] as const;

// Firebase Storage requires a paid Firebase plan for this deployment. Keep the
// implementation intact while removing the tool from every application entry point.
const DISABLED_PROJECT_TOOLS: ReadonlySet<ProjectTool> = new Set(["docs"]);

export const AVAILABLE_PROJECT_TOOLS = PROJECT_TOOLS.filter(
  (tool) => !DISABLED_PROJECT_TOOLS.has(tool.id),
);

export function isProjectToolAvailable(tool: ProjectTool): boolean {
  return !DISABLED_PROJECT_TOOLS.has(tool);
}

export function projectToolFromPath(path: string) {
  return PROJECT_TOOLS.find((tool) => tool.path === path)?.id ?? null;
}
