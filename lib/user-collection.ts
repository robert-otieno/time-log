import { adminDb } from "@/db";

export function userCol(uid: string, col: string) {
  return adminDb.collection("users").doc(uid).collection(col);
}
