import { collection } from "firebase/firestore";
import { firestore } from "./firebase-client";

export function userCol(uid: string, col: string) {
  return collection(firestore, "users", uid, col);
}
