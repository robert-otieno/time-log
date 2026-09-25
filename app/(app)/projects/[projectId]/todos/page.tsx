import { notFound, redirect } from "next/navigation";
import { ProjectTaskList } from "@/components/tasks/project-task-list";
import { getAccessibleProject } from "@/domain/projects/service";
import { toTaskListItem } from "@/domain/tasks/form-data";
import {
  listEligibleTaskAssignees,
  listTasksForViewer,
} from "@/domain/tasks/read";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function ProjectTodosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const actor = await getSessionActor();
  if (!actor) redirect("/login?next=/projects");
  const { projectId } = await params;
  const organizationId = await getActiveOrganizationId(actor);
  const [access, result] = await Promise.all([
    getAccessibleProject(actor, organizationId, projectId),
    listTasksForViewer(actor, organizationId, projectId),
  ]);
  if (!access || !result || !access.project.enabledTools.includes("todos"))
    notFound();
  const readOnly =
    access.role === "client" || access.project.status !== "active";
  const assignees = readOnly
    ? []
    : await listEligibleTaskAssignees(
        actor,
        organizationId,
        projectId,
        result.member,
      );
  const taskVersion = result.tasks
    .map(
      (task) =>
        `${task.id}:${task.updatedAt.seconds}:${task.updatedAt.nanoseconds}`,
    )
    .join("|");
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">To-dos</h2>
        <p className="text-muted-foreground">
          {access.role === "client"
            ? "Tasks shared with your client account."
            : "Plan, assign, and complete project work."}
        </p>
      </div>
      <ProjectTaskList
        key={taskVersion}
        projectId={projectId}
        initialTasks={result.tasks.map((task) =>
          toTaskListItem(task, access.role === "client"),
        )}
        assignees={assignees}
        readOnly={readOnly}
        clientView={access.role === "client"}
        discussionWritable={access.project.status === "active"}
      />
    </section>
  );
}
