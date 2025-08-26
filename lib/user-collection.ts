import { db } from "@/db";
import { doc, collection } from "firebase/firestore";

export function userCol(uid: string, col: string) {
  return collection(doc(db, "users", uid), col);
}
