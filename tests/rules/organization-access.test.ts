import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-time-log",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const active = { status: "active", clientId: null };
    await Promise.all([
      setDoc(doc(db, "organizations/org-a"), { name: "Org A" }),
      setDoc(doc(db, "organizations/org-b"), { name: "Org B" }),
      setDoc(doc(db, "organizations/org-a/members/admin"), { ...active, userId: "admin", role: "admin" }),
      setDoc(doc(db, "organizations/org-a/members/member"), { ...active, userId: "member", role: "member" }),
      setDoc(doc(db, "organizations/org-a/members/client-user"), { ...active, userId: "client-user", role: "client", clientId: "client-1" }),
      setDoc(doc(db, "organizations/org-a/members/suspended"), { status: "suspended", userId: "suspended", role: "member", clientId: null }),
      setDoc(doc(db, "organizations/org-b/members/other"), { ...active, userId: "other", role: "admin" }),
      setDoc(doc(db, "organizations/org-a/clients/client-1"), { name: "Client One" }),
      setDoc(doc(db, "organizations/org-a/projects/project-1"), { name: "Project One" }),
      setDoc(doc(db, "organizations/org-a/projects/project-1/projectMembers/member"), { userId: "member", status: "active" }),
      setDoc(doc(db, "organizations/org-a/projects/project-1/projectMembers/client-user"), { userId: "client-user", status: "active" }),
      setDoc(doc(db, "organizations/org-a/auditEvents/audit-1"), { action: "project.record.created" }),
      setDoc(doc(db, "users/member/daily_tasks/task-1"), { title: "Legacy" }),
    ]);
  });
});

afterAll(async () => environment.cleanup());

const dbFor = (uid: string) => environment.authenticatedContext(uid).firestore();

describe("organization Firestore rules", () => {
  it("allows admins to read organization projects without assignment", async () => {
    await assertSucceeds(getDoc(doc(dbFor("admin"), "organizations/org-a/projects/project-1")));
  });

  it("allows only admins to list all organization projects", async () => {
    const { getDocs, collection } = await import("firebase/firestore");
    await assertSucceeds(getDocs(collection(dbFor("admin"), "organizations/org-a/projects")));
    await assertFails(getDocs(collection(dbFor("member"), "organizations/org-a/projects")));
    await assertFails(getDocs(collection(dbFor("client-user"), "organizations/org-a/projects")));
  });

  it("allows explicitly assigned members and clients", async () => {
    await assertSucceeds(getDoc(doc(dbFor("member"), "organizations/org-a/projects/project-1")));
    await assertSucceeds(getDoc(doc(dbFor("client-user"), "organizations/org-a/projects/project-1")));
    await assertSucceeds(getDoc(doc(dbFor("client-user"), "organizations/org-a/clients/client-1")));
  });

  it("denies unassigned, suspended, and cross-tenant users", async () => {
    await assertFails(getDoc(doc(dbFor("unassigned"), "organizations/org-a/projects/project-1")));
    await assertFails(getDoc(doc(dbFor("suspended"), "organizations/org-a/projects/project-1")));
    await assertFails(getDoc(doc(dbFor("other"), "organizations/org-a/projects/project-1")));
  });

  it("prevents clients from reading another client record", async () => {
    await assertFails(getDoc(doc(dbFor("client-user"), "organizations/org-a/clients/client-2")));
  });

  it("denies browser writes to collaborative records", async () => {
    await assertFails(setDoc(doc(dbFor("admin"), "organizations/org-a/projects/project-2"), { name: "No" }));
  });

  it("denies audit creation to every browser actor", async () => {
    const path = "organizations/org-a/auditEvents/browser-write";

    await assertFails(setDoc(doc(environment.unauthenticatedContext().firestore(), path), { action: "fake" }));
    await assertFails(setDoc(doc(dbFor("admin"), path), { action: "fake" }));
    await assertFails(setDoc(doc(dbFor("member"), path), { action: "fake" }));
    await assertFails(setDoc(doc(dbFor("client-user"), path), { action: "fake" }));
  });

  it("denies audit updates and deletes to browser admins", async () => {
    const reference = doc(dbFor("admin"), "organizations/org-a/auditEvents/audit-1");

    await assertFails(updateDoc(reference, { action: "fake" }));
    await assertFails(deleteDoc(reference));
  });

  it("does not expose the internal audit collection to browser roles", async () => {
    const path = "organizations/org-a/auditEvents/audit-1";

    await assertFails(getDoc(doc(dbFor("admin"), path)));
    await assertFails(getDoc(doc(dbFor("member"), path)));
    await assertFails(getDoc(doc(dbFor("client-user"), path)));
  });

  it("does not treat the active organization preference as authorization", async () => {
    const memberDb = dbFor("member");
    await assertSucceeds(setDoc(doc(memberDb, "users/member/preferences/workspace"), {
      activeOrganizationId: "org-b",
      source: "user",
    }));
    await assertFails(getDoc(doc(memberDb, "organizations/org-b")));
  });

  it("denies browser writes to migration markers", async () => {
    await assertFails(setDoc(
      doc(dbFor("admin"), "organizations/org-a/migrations/legacy-user-v1"),
      { status: "completed" },
    ));
  });

  it("denies browser writes to onboarding state", async () => {
    await assertFails(setDoc(
      doc(dbFor("admin"), "organizations/org-a/onboarding/admin"),
      { currentStep: "complete" },
    ));
  });

  it("keeps notification outbox records server-only", async () => {
    const path = "organizations/org-a/notifications/notification-1";
    await assertFails(getDoc(doc(dbFor("admin"), path)));
    await assertFails(setDoc(doc(dbFor("admin"), path), { status: "sent" }));
  });

  it("preserves isolated legacy user data", async () => {
    await assertSucceeds(getDoc(doc(dbFor("member"), "users/member/daily_tasks/task-1")));
    await assertFails(getDoc(doc(dbFor("admin"), "users/member/daily_tasks/task-1")));
  });
});
