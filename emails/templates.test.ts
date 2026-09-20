import { describe, expect, it } from "vitest";
import type { Notification } from "@/domain/notifications/schemas";
import { renderNotification } from "@/emails/templates";

const timestamp = { seconds: 1, nanoseconds: 0 };
const base = { id: "n1", recipientEmail: "person@example.com", recipientUserId: null, status: "queued" as const, idempotencyKey: "key", providerMessageId: null, attemptCount: 0, lastErrorCode: null, claimId: null, claimExpiresAt: null, nextAttemptAt: null, createdAt: timestamp, updatedAt: timestamp };

describe("email templates", () => {
  it("renders escaped HTML and a plain-text invitation", () => {
    const email = renderNotification({ ...base, type: "invitation", templateData: { organizationName: "A & B", inviterName: "<Admin>", acceptUrl: "https://example.com/invite?a=1&b=2" } } satisfies Notification);
    expect(email.html).toContain("&lt;Admin&gt;");
    expect(email.html).not.toContain("<Admin>");
    expect(email.text).toContain("A & B");
  });

  it("renders every planned category", () => {
    const variants: Notification[] = [
      { ...base, type: "assignment", recipientUserId: "u1", projectId: "p1", taskId: "t1", templateData: { organizationName: "Acme", projectName: "Site", taskTitle: "Draft", assignedByName: "Casey", taskUrl: "https://example.com/task" } },
      { ...base, type: "mention", projectId: "p1", templateData: { projectName: "Site", authorName: "Casey", contextLabel: "Update", targetUrl: "https://example.com/mention" } },
      { ...base, type: "reminder", projectId: "p1", templateData: { projectName: "Site", itemTitle: "Draft", dueLabel: "tomorrow", targetUrl: "https://example.com/reminder" } },
      { ...base, type: "announcement", projectId: "p1", templateData: { projectName: "Site", announcementTitle: "Launch", authorName: "Casey", targetUrl: "https://example.com/post" } },
      { ...base, type: "digest", templateData: { organizationName: "Acme", periodLabel: "Daily", summary: "Three tasks", targetUrl: "https://example.com" } },
    ];
    expect(variants.map(renderNotification).every((email) => email.subject && email.html && email.text)).toBe(true);
  });
});
