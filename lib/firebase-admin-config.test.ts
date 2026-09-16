import { describe, expect, it } from "vitest";

import {
  FirebaseAdminConfigurationError,
  parseFirebaseAdminEnvironment,
} from "@/lib/firebase-admin-config";

describe("parseFirebaseAdminEnvironment", () => {
  it("normalizes an escaped private key", () => {
    expect(
      parseFirebaseAdminEnvironment({
        FIREBASE_ADMIN_PROJECT_ID: "time-log",
        FIREBASE_ADMIN_CLIENT_EMAIL: "firebase@example.com",
        FIREBASE_ADMIN_PRIVATE_KEY: "line-one\\nline-two",
      }),
    ).toEqual({
      projectId: "time-log",
      clientEmail: "firebase@example.com",
      privateKey: "line-one\nline-two",
    });
  });

  it("reports canonical field names without exposing values", () => {
    expect(() => parseFirebaseAdminEnvironment({})).toThrowError(
      new FirebaseAdminConfigurationError([
        "FIREBASE_ADMIN_PROJECT_ID",
        "FIREBASE_ADMIN_CLIENT_EMAIL",
        "FIREBASE_ADMIN_PRIVATE_KEY",
      ]),
    );
  });
});
