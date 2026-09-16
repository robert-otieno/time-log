import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { parseFirebaseAdminEnvironment } from "@/lib/firebase-admin-config";

let adminApp: App | undefined;

export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApp = getApps()[0];
  if (existingApp) {
    adminApp = existingApp;
    return adminApp;
  }

  const environment = parseFirebaseAdminEnvironment(process.env);
  adminApp = initializeApp({
    credential: cert({
      projectId: environment.projectId,
      clientEmail: environment.clientEmail,
      privateKey: environment.privateKey,
    }),
  });

  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
