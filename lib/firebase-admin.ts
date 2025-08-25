import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: applicationDefault(),
      });

const adminAuth = getAuth(adminApp);

export async function verifyIdToken(token?: string) {
  console.log("Verifying token:", token);
  if (!token) return null;

  try {
    return await adminAuth.verifyIdToken(token);
  } catch (err) {
    console.error("Failed to verify ID token", err);
    return null;
  }
}
