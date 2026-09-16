import { describe, expect, it } from "vitest";

import { redactAuditChanges } from "@/domain/audit/redaction";

describe("audit redaction", () => {
  it("retains only action-approved fields and typed safe values", () => {
    expect(redactAuditChanges("visibility.record.changed", [
      { field: "visibility", from: "internal", to: "client-visible" },
      { field: "title", from: "old secret", to: "new secret" },
      { field: "visibility", from: "private notes", to: "internal" },
    ])).toEqual([
      { field: "visibility", from: "internal", to: "client-visible" },
      { field: "visibility", to: "internal" },
    ]);
  });

  it("drops all changes for actions with an empty allowlist", () => {
    expect(redactAuditChanges("auth.login.succeeded", [
      { field: "email", to: "person@example.com" },
      { field: "token", to: "secret" },
    ])).toEqual([]);
  });
});

