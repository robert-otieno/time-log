import { app } from "@/db";
import { getAuth } from "firebase-admin/auth";

const adminAuth = getAuth(app);

export async function verifyIdToken(token?: string) {
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (err) {
    console.error("Failed to verify ID token", err);
    return null;
  }
}
