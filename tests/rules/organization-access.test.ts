import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

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

  it("preserves isolated legacy user data", async () => {
    await assertSucceeds(getDoc(doc(dbFor("member"), "users/member/daily_tasks/task-1")));
    await assertFails(getDoc(doc(dbFor("admin"), "users/member/daily_tasks/task-1")));
  });
});
