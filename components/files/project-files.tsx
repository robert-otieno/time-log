"use client";

import { useRef, useState, useTransition } from "react";
import { Archive, Download, FileIcon, LoaderCircle, UploadCloud } from "lucide-react";
import { ref, uploadBytesResumable } from "firebase/storage";
import { toast } from "sonner";
import { archiveFileAction, changeFileVisibilityAction, createFileUploadIntentAction, finalizeFileUploadAction } from "@/app/(app)/projects/[projectId]/docs/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contentTypeForFile, MAX_FILE_SIZE_BYTES, type FileListItem } from "@/domain/files/schemas";
import { clientStorage } from "@/lib/firebase-client";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const sizes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ProjectFiles({ projectId, initialFiles, canUpload }: { projectId: string; initialFiles: FileListItem[]; canUpload: boolean }) {
  const input = useRef<HTMLInputElement>(null); const [files, setFiles] = useState(initialFiles); const [dragging, setDragging] = useState(false); const [progress, setProgress] = useState<Record<string, number>>({}); const [pending, startTransition] = useTransition();
  async function upload(file: File) {
    const contentType = contentTypeForFile(file.name, file.type);
    if (!contentType || file.size > MAX_FILE_SIZE_BYTES) { toast.error(file.size > MAX_FILE_SIZE_BYTES ? "Files must be 25 MB or smaller." : "This file type is not supported."); return; }
    setProgress((value) => ({ ...value, [file.name]: 0 }));
    const intent = await createFileUploadIntentAction(projectId, { originalName: file.name, contentType, sizeBytes: file.size });
    if (!intent.ok) { toast.error(intent.error); setProgress((value) => { const next = { ...value }; delete next[file.name]; return next; }); return; }
    const task = uploadBytesResumable(ref(clientStorage, intent.data.storagePath), file, { contentType, customMetadata: intent.data.metadata });
    task.on("state_changed", (snapshot) => setProgress((value) => ({ ...value, [file.name]: Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100) })),
      () => { toast.error(`Could not upload ${file.name}.`); setProgress((value) => { const next = { ...value }; delete next[file.name]; return next; }); },
      async () => { const result = await finalizeFileUploadAction(projectId, intent.data.fileId); if (!result.ok) toast.error(result.error); else { toast.success(`${file.name} uploaded.`); window.location.reload(); } });
  }
  const choose = (list: FileList | null) => { if (list) Array.from(list).forEach(upload); };
  function mutate(operation: () => Promise<{ ok: true; data: void } | { ok: false; error: string }>, success: () => void) { startTransition(async () => { const result = await operation(); if (!result.ok) toast.error(result.error); else success(); }); }
  return <div className="space-y-5">
    {canUpload && <div role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") input.current?.click(); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); }} className={cn("cursor-pointer rounded-xl border border-dashed p-7 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "hover:border-primary/60 hover:bg-muted/40")}>
      <UploadCloud className="mx-auto mb-3 size-7 text-muted-foreground" /><p className="font-medium">Drop files here or choose files</p><p className="mt-1 text-sm text-muted-foreground">PDF, images, text, CSV, Markdown, and Office files up to 25 MB.</p><input ref={input} type="file" className="sr-only" accept={ACCEPT} multiple onChange={(event) => choose(event.target.files)} />
    </div>}
    {Object.entries(progress).map(([name, value]) => <div key={name} className="space-y-2 rounded-lg border p-3"><div className="flex justify-between gap-3 text-sm"><span className="truncate">{name}</span><span>{value}%</span></div><Progress value={value} className="h-2" /></div>)}
    {files.length === 0 ? <div className="rounded-xl border bg-muted/20 px-6 py-12 text-center"><FileIcon className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">No files yet</p><p className="mt-1 text-sm text-muted-foreground">Project documents and images will appear here.</p></div> : <div className="divide-y rounded-xl border">{files.map((file) => <div key={file.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3"><div className="rounded-lg bg-muted p-2"><FileIcon className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{file.originalName}</p><p className="text-xs text-muted-foreground">{sizes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleDateString()}</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="capitalize">{file.scanStatus}</Badge>{canUpload && <Select value={file.visibility} disabled={pending || file.scanStatus !== "clean"} onValueChange={(value) => mutate(() => changeFileVisibilityAction(projectId, file.id, value), () => { setFiles((items) => items.map((item) => item.id === file.id ? { ...item, visibility: value as FileListItem["visibility"] } : item)); toast.success("Visibility updated."); })}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="client-visible">Client-visible</SelectItem></SelectContent></Select>}
      <Button asChild size="sm" variant="outline"><a href={`/api/projects/${projectId}/files/${file.id}/download`}><Download />Download</a></Button>{canUpload && <Button size="icon-sm" variant="ghost" aria-label={`Archive ${file.originalName}`} disabled={pending} onClick={() => mutate(() => archiveFileAction(projectId, file.id), () => { setFiles((items) => items.filter((item) => item.id !== file.id)); toast.success("File archived."); })}>{pending ? <LoaderCircle className="animate-spin" /> : <Archive />}</Button>}</div>
    </div>)}</div>}
    {canUpload && files.some((file) => file.scanStatus !== "clean") && <p className="text-sm text-muted-foreground">Client sharing remains unavailable until a malware scanner marks a file clean.</p>}
  </div>;
}
