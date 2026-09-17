import { Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ClientPortalEmptyState() {
  return <Card>
    <CardHeader>
      <div className="mb-2 flex size-10 items-center justify-center rounded-md border bg-muted/40"><Eye className="size-5" aria-hidden="true" /></div>
      <CardTitle>Nothing has been shared with you yet</CardTitle>
      <CardDescription>Client-visible project updates and tools will appear here when they are ready.</CardDescription>
    </CardHeader>
    <CardContent><p className="text-sm text-muted-foreground">You do not need to take any action.</p></CardContent>
  </Card>;
}

