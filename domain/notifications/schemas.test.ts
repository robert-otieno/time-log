import { describe, expect, it } from "vitest";
import { notificationSchema } from "@/domain/notifications/schemas";

const timestamp = { seconds: 1, nanoseconds: 0 };
const common = { id: "n1", recipientEmail: "person@example.com", recipientUserId: null, status: "queued", idempotencyKey: "invitation/i1", providerMessageId: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: timestamp, updatedAt: timestamp };

describe("notification schema", () => {
  it("parses a typed invitation and defaults lease fields for older records", () => {
    const { recipientUserId: _, claimId: __, claimExpiresAt: ___, nextAttemptAt: ____, ...legacy } = common; void _; void __; void ___; void ____;
    const parsed = notificationSchema.parse({ ...legacy, type: "invitation", templateData: { organizationName: "Acme", inviterName: "Casey", acceptUrl: "https://example.com/invite" } });
    expect(parsed).toMatchObject({ type: "invitation", recipientUserId: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null });
  });

  it("rejects template fields that do not belong to the category", () => {
    expect(() => notificationSchema.parse({ ...common, type: "digest", templateData: { organizationName: "Acme", periodLabel: "Daily", summary: "Three tasks", targetUrl: "https://example.com", secret: "no" } })).toThrow();
  });
});
