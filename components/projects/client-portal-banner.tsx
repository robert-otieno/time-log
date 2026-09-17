import { Eye } from "lucide-react";

export function ClientPortalBanner() {
  return <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
    <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div><p className="font-medium">Client portal</p><p className="text-muted-foreground">You are viewing content that has been shared with your client account.</p></div>
  </div>;
}

