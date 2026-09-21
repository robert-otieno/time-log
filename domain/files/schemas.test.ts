import { describe, expect, it } from "vitest";
import { contentTypeForFile, createFileIntentSchema, hasSupportedFileSignature, MAX_FILE_SIZE_BYTES, safeStoredFilename } from "@/domain/files/schemas";

describe("file schemas", () => {
  it("sanitizes names while preserving a useful extension", () => {
    expect(safeStoredFilename("../../Quarter 1 report.pdf")).toBe("Quarter-1-report.pdf");
  });
  it("rejects unsupported and oversized uploads", () => {
    expect(createFileIntentSchema.safeParse({ projectId: "p", originalName: "run.exe", contentType: "application/x-msdownload", sizeBytes: 3 }).success).toBe(false);
    expect(createFileIntentSchema.safeParse({ projectId: "p", originalName: "large.pdf", contentType: "application/pdf", sizeBytes: MAX_FILE_SIZE_BYTES + 1 }).success).toBe(false);
  });
  it("requires the declared file family signature", () => {
    expect(hasSupportedFileSignature("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
    expect(hasSupportedFileSignature("application/pdf", new Uint8Array([0x4d, 0x5a]))).toBe(false);
  });
  it("infers a safe MIME type when a browser omits it", () => {
    expect(contentTypeForFile("notes.md", "")).toBe("text/markdown");
    expect(contentTypeForFile("payload.exe", "")).toBeNull();
  });
});
