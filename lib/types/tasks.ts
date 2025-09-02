import type { FieldValue, Timestamp } from "firebase/firestore";

export interface WeeklyPriority {
  id: string;
  title: string;
  weekStart: string;
  tag?: string | null;
  level?: string | null;
  progress?: number;
  completed?: boolean;
  createdAt?: Timestamp | FieldValue | null;
  updatedAt?: Timestamp | FieldValue | null;
}

export interface DailyTask {
  id: string;
  title: string;
  date: string;
  tag: string;
  position: number;
  deadline?: string | null;
  reminderTime?: string | null;
  notes?: string | null;
  linkRefs?: string | null;
  fileRefs?: string | null;
  weeklyPriorityId?: string | null;
  done: boolean;
  createdAt?: Timestamp | FieldValue | null;
  updatedAt?: Timestamp | FieldValue | null;
}

export interface DailySubtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt?: Timestamp | FieldValue | null;
  updatedAt?: Timestamp | FieldValue | null;
}

export type TaskWithSubtasks = DailyTask & {
  subtasks: DailySubtask[];
  priority?: WeeklyPriority;
};
