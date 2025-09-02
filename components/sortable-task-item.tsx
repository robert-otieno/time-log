"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { CSSProperties } from "react";
import TaskItem, { TaskItemProps } from "./task-item";

export default function SortableTaskItem(props: TaskItemProps) {
  const { task } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: task.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem {...props} dragHandleProps={{ attributes, listeners, setActivatorNodeRef }} />
    </div>
  );
}
