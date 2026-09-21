import { LockKeyhole, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Visibility } from "@/domain/visibility/schemas";

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return visibility === "client-visible"
    ? <StatusBadge tone="info"><Users aria-hidden="true" />Client-visible</StatusBadge>
    : <StatusBadge tone="neutral"><LockKeyhole aria-hidden="true" />Internal</StatusBadge>;
}
