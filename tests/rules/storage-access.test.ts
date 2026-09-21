import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

let environment: RulesTestEnvironment;
const path = "organizations/org-a/projects/project-1/files/file-1/report.pdf";
const metadata = { contentType: "application/pdf", customMetadata: { organizationId: "org-a", projectId: "project-1", fileId: "file-1", uploaderId: "member" } };
const upload = (uid: string, uploadMetadata = metadata) => new Promise((resolve, reject) => {
  environment.authenticatedContext(uid).storage().ref(path).put(new Uint8Array([1, 2, 3]), uploadMetadata).then(resolve, reject);
});

beforeAll(async () => {
  environment = await initializeTestEnvironment({ projectId: "demo-time-log", firestore: { rules: readFileSync("firestore.rules", "utf8") }, storage: { rules: readFileSync("storage.rules", "utf8") } });
});
beforeEach(async () => {
  await Promise.all([environment.clearFirestore(), environment.clearStorage()]);
  await environment.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "organizations/org-a/projects/project-1/files/file-1"), {
    status: "pending", uploaderId: "member", safeName: "report.pdf", sizeBytes: 3, contentType: "application/pdf", uploadExpiresAt: new Date(Date.now() + 60_000),
  }));
});
afterAll(async () => environment.cleanup());

describe("project file Storage rules", () => {
  it("allows only the intended uploader to create the exact pending object", async () => {
    await assertSucceeds(upload("member"));
  });
  it("rejects another user, unsafe types, oversized metadata, and direct reads", async () => {
    await assertFails(upload("other"));
    await assertFails(upload("member", { ...metadata, contentType: "application/x-msdownload" }));
    await assertFails(environment.authenticatedContext("member").storage().ref(path).getDownloadURL());
  });
});
