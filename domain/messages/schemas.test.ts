import { describe, expect, it } from "vitest";
import { createCommentCommandSchema, createPostCommandSchema } from "@/domain/messages/schemas";

describe("message board schemas", () => {
  it("defaults new posts to internal without email", () => {
    expect(createPostCommandSchema.parse({ title: " Update ", body: " Details " })).toEqual({ title: "Update", body: "Details", visibility: "internal", emailAnnouncement: false });
  });
  it("rejects empty and oversized content", () => {
    expect(createPostCommandSchema.safeParse({ title: "", body: "Details" }).success).toBe(false);
    expect(createCommentCommandSchema.safeParse({ postId: "p", body: "x".repeat(5001) }).success).toBe(false);
  });
});
