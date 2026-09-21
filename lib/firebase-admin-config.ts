import { z } from "zod";

const firebaseAdminEnvironmentSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().trim().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().trim().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().trim().min(1),
});

export interface FirebaseAdminEnvironment {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const storageBucketSchema = z.string().trim().min(3).regex(/^[a-z0-9._-]+$/i);

export function parseFirebaseStorageBucketEnvironment(
  environment: Record<string, string | undefined>,
): string {
  const result = storageBucketSchema.safeParse(
    environment.FIREBASE_ADMIN_STORAGE_BUCKET ?? environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  );
  if (!result.success) throw new FirebaseAdminConfigurationError(["FIREBASE_ADMIN_STORAGE_BUCKET"]);
  return result.data;
}

export class FirebaseAdminConfigurationError extends Error {
  readonly code = "firebase_admin_configuration_invalid";

  constructor(readonly fields: string[]) {
    super(`Firebase Admin configuration is missing or invalid: ${fields.join(", ")}`);
    this.name = "FirebaseAdminConfigurationError";
  }
}

export function parseFirebaseAdminEnvironment(
  environment: Record<string, string | undefined>,
): FirebaseAdminEnvironment {
  const result = firebaseAdminEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const fields = Array.from(
      new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    );
    throw new FirebaseAdminConfigurationError(fields);
  }

  return {
    projectId: result.data.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: result.data.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: result.data.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}
