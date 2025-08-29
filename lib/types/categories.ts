import type { FieldValue, Timestamp } from "firebase/firestore";

export interface Category {
  id: string;
  name: string;
  color?: string | null;
  createdAt?: Timestamp | FieldValue | null;
  updatedAt?: Timestamp | FieldValue | null;
}

