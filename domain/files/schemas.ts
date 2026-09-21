import { z } from "zod";
import { visibilitySchema } from "@/domain/visibility/schemas";

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp",
  "text/plain", "text/csv", "text/markdown",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

const EXTENSIONS_BY_TYPE: Record<(typeof ALLOWED_FILE_TYPES)[number], readonly string[]> = {
  "application/pdf": ["pdf"], "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/gif": ["gif"], "image/webp": ["webp"],
  "text/plain": ["txt"], "text/csv": ["csv"], "text/markdown": ["md", "markdown"],
  "application/msword": ["doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-powerpoint": ["ppt"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
};

const timestampSchema = z.custom<{ seconds: number; nanoseconds: number }>(
  (value) => typeof value === "object" && value !== null && "seconds" in value && "nanoseconds" in value,
);

export const createFileIntentSchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  originalName: z.string().trim().min(1).max(240),
  contentType: z.enum(ALLOWED_FILE_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
}).strict().superRefine((value, context) => {
  const extension = value.originalName.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS_BY_TYPE[value.contentType].includes(extension)) context.addIssue({ code: "custom", path: ["originalName"], message: "The filename extension does not match its file type" });
});

export const fileRecordSchema = z.object({
  id: z.string().min(1), organizationId: z.string().min(1), projectId: z.string().min(1),
  originalName: z.string(), safeName: z.string(), storagePath: z.string(),
  contentType: z.string(), sizeBytes: z.number().int().nonnegative(),
  checksum: z.object({ algorithm: z.enum(["md5", "crc32c"]), value: z.string().min(1) }).nullable(),
  uploaderId: z.string(), visibility: visibilitySchema,
  status: z.enum(["pending", "ready", "failed", "archived"]),
  scanStatus: z.enum(["unscanned", "clean", "rejected"]),
  createdAt: timestampSchema, updatedAt: timestampSchema,
  uploadExpiresAt: timestampSchema.nullable(), finalizedAt: timestampSchema.nullable(), archivedAt: timestampSchema.nullable(),
}).strict();

export type FileRecord = z.infer<typeof fileRecordSchema>;
export type FileListItem = Omit<FileRecord, "createdAt" | "updatedAt" | "uploadExpiresAt" | "finalizedAt" | "archivedAt"> & {
  createdAt: string; updatedAt: string; uploadExpiresAt: string | null; finalizedAt: string | null; archivedAt: string | null;
};

export function safeStoredFilename(originalName: string): string {
  const pieces = originalName.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "");
  return (pieces || "file").slice(-160);
}

export function contentTypeForFile(originalName: string, browserType: string): (typeof ALLOWED_FILE_TYPES)[number] | null {
  if ((ALLOWED_FILE_TYPES as readonly string[]).includes(browserType)) return browserType as (typeof ALLOWED_FILE_TYPES)[number];
  const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
  return (Object.entries(EXTENSIONS_BY_TYPE).find(([, extensions]) => extensions.includes(extension))?.[0] as (typeof ALLOWED_FILE_TYPES)[number] | undefined) ?? null;
}

export function hasSupportedFileSignature(contentType: string, bytes: Uint8Array): boolean {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (contentType === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46);
  if (contentType === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (contentType === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (contentType === "image/gif") return starts(0x47, 0x49, 0x46, 0x38);
  if (contentType === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (contentType.includes("openxmlformats")) return starts(0x50, 0x4b, 0x03, 0x04);
  if (["application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint"].includes(contentType)) return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  if (contentType.startsWith("text/")) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return !bytes.includes(0); } catch { return false; }
  }
  return false;
}
