"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Archive, Bell, Loader2, MessageSquare, Pin, PinOff, RotateCcw } from "lucide-react";
import { archiveCommentAction, changePostVisibilityAction, createCommentAction, createPostAction, setArchivedAction, setPinnedAction, updateCommentAction, updatePostAction } from "@/app/(app)/projects/[projectId]/messages/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import type { MessageBoardPost } from "@/domain/messages/schemas";
import { requireActionSuccess, useOptimisticMutations } from "@/hooks/use-optimistic-mutations";

type Viewer = { userId: string; role: "admin" | "member" | "client"; name: string };
type Comment = MessageBoardPost["comments"][number];
const transient = (error: unknown) => error instanceof Error && error.message.includes("Try again");
const sorted = (posts: MessageBoardPost[]) => [...posts].sort((a, b) => Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt)) || b.createdAt.localeCompare(a.createdAt));

export function MessageBoard({ projectId, initialPosts, viewer, canCreatePosts, canModerate, archived, nextCursor }: { projectId: string; initialPosts: MessageBoardPost[]; viewer: Viewer; canCreatePosts: boolean; canModerate: boolean; archived: boolean; nextCursor: string | null }) {
  const [posts, setPosts] = useState(initialPosts);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const mutations = useOptimisticMutations();
  const stamp = () => new Date().toISOString();
  const replacePost = (id: string, update: (post: MessageBoardPost) => MessageBoardPost) => setPosts((current) => sorted(current.map((post) => post.id === id ? update(post) : post)));
  const messageError = (error: unknown) => error instanceof Error ? error.message : "The message could not be saved. Try again.";

  function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const body = String(data.get("body") ?? "").trim();
    const visibility = data.get("visibility") === "client-visible" ? "client-visible" as const : "internal" as const;
    const announcement = data.get("emailAnnouncement") === "on";
    const createdAt = stamp();
    const temporaryId = `pending-${crypto.randomUUID()}`;
    const optimistic: MessageBoardPost = { id: temporaryId, title, body, authorId: viewer.userId, authorName: viewer.name, visibility, announcement, pinnedAt: null, pinnedBy: null, createdAt, updatedAt: createdAt, editedAt: null, archivedAt: null, comments: [] };
    void mutations.run({
      scope: "message:create", operation: "create", snapshot: () => null,
      optimistic: () => { if (!announcement) setPosts((current) => [optimistic, ...current]); },
      request: async () => requireActionSuccess(await createPostAction(projectId, { title, body, visibility, emailAnnouncement: announcement })),
      reconcile: ({ id }) => { setPosts((current) => announcement ? [{ ...optimistic, id }, ...current] : current.map((post) => post.id === temporaryId ? { ...post, id } : post)); form.reset(); },
      rollback: () => setPosts((current) => current.filter((post) => post.id !== temporaryId)), errorMessage: messageError, retry: transient,
    });
  }

  const editPost = (post: MessageBoardPost, title: string, body: string) => void mutations.run({
    scope: `message:${post.id}`, operation: "edit", snapshot: () => post,
    optimistic: () => { const editedAt = stamp(); replacePost(post.id, (current) => ({ ...current, title, body, editedAt, updatedAt: editedAt })); setEditing(null); },
    request: async () => requireActionSuccess(await updatePostAction(projectId, { postId: post.id, title, body })), reconcile: () => undefined,
    rollback: (snapshot) => replacePost(post.id, (current) => ({ ...current, title: snapshot.title, body: snapshot.body, editedAt: snapshot.editedAt, updatedAt: snapshot.updatedAt })), errorMessage: messageError, retry: transient,
  });
  const pinPost = (post: MessageBoardPost) => { const pinned = !post.pinnedAt; void mutations.run({
    scope: `message:${post.id}`, operation: pinned ? "pin" : "unpin", snapshot: () => post,
    optimistic: () => replacePost(post.id, (current) => ({ ...current, pinnedAt: pinned ? stamp() : null, pinnedBy: pinned ? viewer.userId : null })),
    request: async () => requireActionSuccess(await setPinnedAction(projectId, post.id, pinned)), reconcile: () => undefined,
    rollback: (snapshot) => replacePost(post.id, (current) => ({ ...current, pinnedAt: snapshot.pinnedAt, pinnedBy: snapshot.pinnedBy, updatedAt: snapshot.updatedAt })), errorMessage: messageError, retry: transient,
  }); };
  const archivePost = (post: MessageBoardPost) => void mutations.run({
    scope: `message:${post.id}`, operation: archived ? "restore" : "archive", snapshot: () => post,
    optimistic: () => setPosts((current) => current.filter((candidate) => candidate.id !== post.id)),
    request: async () => requireActionSuccess(await setArchivedAction(projectId, post.id, !archived)), reconcile: () => undefined,
    rollback: (snapshot) => setPosts((current) => sorted([snapshot, ...current.filter((candidate) => candidate.id !== snapshot.id)])), errorMessage: messageError, retry: transient,
  });
  const setVisibility = (post: MessageBoardPost, visibility: "internal" | "client-visible") => void mutations.run({
    scope: `message:${post.id}`, operation: "visibility", snapshot: () => post,
    optimistic: () => replacePost(post.id, (current) => ({ ...current, visibility })),
    request: async () => requireActionSuccess(await changePostVisibilityAction(projectId, post.id, visibility)), reconcile: () => undefined,
    rollback: (snapshot) => replacePost(post.id, (current) => ({ ...current, visibility: snapshot.visibility, updatedAt: snapshot.updatedAt })), errorMessage: messageError, retry: transient,
  });

  const addComment = (post: MessageBoardPost, form: HTMLFormElement, body: string) => {
    const createdAt = stamp(); const temporaryId = `pending-${crypto.randomUUID()}`;
    const comment: Comment = { id: temporaryId, postId: post.id, body, authorId: viewer.userId, authorName: viewer.name, visibility: viewer.role === "client" ? "client-visible" : "internal", createdAt, updatedAt: createdAt, editedAt: null, archivedAt: null };
    void mutations.run({
      scope: `message:${post.id}:comment:create`, operation: "create", snapshot: () => null,
      optimistic: () => { replacePost(post.id, (current) => ({ ...current, comments: [...current.comments, comment] })); form.reset(); },
      request: async () => requireActionSuccess(await createCommentAction(projectId, { postId: post.id, body })),
      reconcile: (result) => replacePost(post.id, (current) => ({ ...current, comments: current.comments.map((item) => item.id === temporaryId ? { ...item, id: result.id, visibility: result.visibility === "client-visible" ? "client-visible" : "internal" } : item) })),
      rollback: () => replacePost(post.id, (current) => ({ ...current, comments: current.comments.filter((item) => item.id !== temporaryId) })), errorMessage: messageError, retry: transient,
    });
  };
  const editComment = (post: MessageBoardPost, comment: Comment, body: string) => void mutations.run({
    scope: `comment:${comment.id}`, operation: "edit", snapshot: () => comment,
    optimistic: () => { const editedAt = stamp(); replacePost(post.id, (current) => ({ ...current, comments: current.comments.map((item) => item.id === comment.id ? { ...item, body, editedAt, updatedAt: editedAt } : item) })); setEditingComment(null); },
    request: async () => requireActionSuccess(await updateCommentAction(projectId, { postId: post.id, commentId: comment.id, body })), reconcile: () => undefined,
    rollback: (snapshot) => replacePost(post.id, (current) => ({ ...current, comments: current.comments.map((item) => item.id === snapshot.id ? snapshot : item) })), errorMessage: messageError, retry: transient,
  });
  const removeComment = (post: MessageBoardPost, comment: Comment) => void mutations.run({
    scope: `comment:${comment.id}`, operation: "archive", snapshot: () => comment,
    optimistic: () => replacePost(post.id, (current) => ({ ...current, comments: current.comments.filter((item) => item.id !== comment.id) })),
    request: async () => requireActionSuccess(await archiveCommentAction(projectId, post.id, comment.id)), reconcile: () => undefined,
    rollback: (snapshot) => replacePost(post.id, (current) => ({ ...current, comments: [...current.comments, snapshot].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) })), errorMessage: messageError, retry: transient,
  });

  const publishing = mutations.isPending("message:create");
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Message board</h2><p className="text-sm text-muted-foreground">Durable announcements and project updates.</p></div>{viewer.role !== "client" && <Button asChild variant="outline"><Link href={archived ? `/projects/${projectId}/messages` : `/projects/${projectId}/messages?archived=1`}>{archived ? <MessageSquare /> : <Archive />}{archived ? "Active posts" : "Archived"}</Link></Button>}</div>
    {canCreatePosts && !archived && <form onSubmit={submitPost} className="space-y-4 rounded-xl border bg-card p-4"><div className="grid gap-4 sm:grid-cols-[1fr_12rem]"><div className="space-y-2"><Label htmlFor="post-title">Title</Label><Input id="post-title" name="title" maxLength={180} required /></div><div className="space-y-2"><Label>Visibility</Label><Select name="visibility" defaultValue="internal"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="client-visible">Client-visible</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label htmlFor="post-body">Update</Label><Textarea id="post-body" name="body" maxLength={10000} required rows={5} /></div>{canModerate && <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"><Checkbox name="emailAnnouncement" /><span><span className="flex items-center gap-2 text-sm font-medium"><Bell className="size-4" />Email this announcement</span><span className="mt-1 block text-xs text-muted-foreground">Email announcements appear after recipient delivery has been queued.</span></span></label>}<Button disabled={publishing}>{publishing && <Loader2 className="animate-spin" />}{publishing ? "Publishing…" : "Publish update"}</Button></form>}
    {posts.length === 0 ? <div className="rounded-xl border bg-muted/20 p-10 text-center"><MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">{archived ? "No archived posts" : "No updates yet"}</p></div> : <div className="space-y-4">{posts.map((post) => { const owns = post.authorId === viewer.userId; const postPending = mutations.isPending(`message:${post.id}`); return <article id={`post-${post.id}`} key={post.id} aria-busy={postPending} className="rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{post.pinnedAt && <Pin className="size-4 text-primary" />}<h3 className="text-lg font-semibold">{post.title}</h3><VisibilityBadge visibility={post.visibility} />{post.announcement && <span className="text-xs text-muted-foreground">Announcement</span>}{post.id.startsWith("pending-") && <span className="text-xs text-muted-foreground">Saving…</span>}</div><p className="mt-1 text-xs text-muted-foreground">{post.authorName} · {new Date(post.createdAt).toLocaleString()}{post.editedAt ? " · Edited" : ""}</p></div><div className="flex flex-wrap gap-2">{!archived && canModerate && <Button size="sm" variant="ghost" disabled={postPending} onClick={() => pinPost(post)}>{post.pinnedAt ? <PinOff /> : <Pin />}{post.pinnedAt ? "Unpin" : "Pin"}</Button>}{!archived && (owns || canModerate) && <Button size="sm" variant="ghost" disabled={postPending} onClick={() => setEditing(editing === post.id ? null : post.id)}>Edit</Button>}{!archived && (owns || canModerate) && <Button size="sm" variant="ghost" disabled={postPending} onClick={() => archivePost(post)}><Archive />Archive</Button>}{archived && (owns || canModerate) && <Button size="sm" variant="outline" disabled={postPending} onClick={() => archivePost(post)}><RotateCcw />Restore</Button>}</div></div>
      {editing === post.id ? <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); editPost(post, String(data.get("title") ?? "").trim(), String(data.get("body") ?? "").trim()); }}><Input name="title" defaultValue={post.title} required maxLength={180} /><Textarea name="body" defaultValue={post.body} required maxLength={10000} rows={5} /><div className="flex gap-2"><Button size="sm">Save</Button><Button size="sm" type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div></form> : <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{post.body}</p>}
      {!archived && viewer.role !== "client" && (owns || canModerate) && <div className="mt-4 max-w-48"><Select value={post.visibility} disabled={postPending} onValueChange={(value: "internal" | "client-visible") => setVisibility(post, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="client-visible">Client-visible</SelectItem></SelectContent></Select></div>}
      {!archived && <div className="mt-5 border-t pt-4"><div className="space-y-3">{post.comments.map((comment) => { const canEdit = comment.authorId === viewer.userId || canModerate; const commentPending = mutations.isPending(`comment:${comment.id}`); return <div key={comment.id} aria-busy={commentPending} className="rounded-lg bg-muted/30 p-3"><div className="flex justify-between gap-3"><p className="text-xs text-muted-foreground">{comment.authorName} · {new Date(comment.createdAt).toLocaleString()}{comment.editedAt ? " · Edited" : ""}{comment.id.startsWith("pending-") ? " · Saving…" : ""}</p>{canEdit && <div className="flex gap-1"><Button size="xs" variant="ghost" disabled={commentPending} onClick={() => setEditingComment(editingComment === comment.id ? null : comment.id)}>Edit</Button><Button size="xs" variant="ghost" disabled={commentPending} onClick={() => removeComment(post, comment)}>Archive</Button></div>}</div>{editingComment === comment.id ? <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); editComment(post, comment, String(new FormData(event.currentTarget).get("body") ?? "").trim()); }}><Input name="body" defaultValue={comment.body} required maxLength={5000} /><Button size="sm">Save</Button></form> : <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>}</div>; })}</div><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; addComment(post, form, String(new FormData(form).get("body") ?? "").trim()); }}><Input name="body" placeholder="Write a comment" required maxLength={5000} /><Button variant="outline" disabled={mutations.isPending(`message:${post.id}:comment:create`)}>Comment</Button></form></div>}
    </article>; })}</div>}
    {nextCursor && <div className="flex justify-center"><Button asChild variant="outline"><Link href={`/projects/${projectId}/messages?${archived ? "archived=1&" : ""}before=${encodeURIComponent(nextCursor)}`}>Older posts</Link></Button></div>}
  </div>;
}
