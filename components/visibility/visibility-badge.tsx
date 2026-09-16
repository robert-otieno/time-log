import { LockKeyhole, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Visibility } from "@/domain/visibility/schemas";

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return visibility === "client-visible"
    ? <Badge variant="secondary"><Users aria-hidden="true" />Client-visible</Badge>
    : <Badge variant="outline"><LockKeyhole aria-hidden="true" />Internal</Badge>;
}

