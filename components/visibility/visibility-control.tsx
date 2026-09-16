"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Visibility } from "@/domain/visibility/schemas";

type VisibilityControlProps = {
  id: string;
  value: Visibility;
  onValueChange: (value: Visibility) => void;
  disabled?: boolean;
  pending?: boolean;
  clientName?: string | null;
};

export function VisibilityControl({ id, value, onValueChange, disabled = false, pending = false, clientName }: VisibilityControlProps) {
  const descriptionId = `${id}-description`;
  return <div className="space-y-2">
    <Label htmlFor={id}>Visibility</Label>
    <Select value={value} onValueChange={(next) => onValueChange(next as Visibility)} disabled={disabled || pending}>
      <SelectTrigger id={id} aria-describedby={descriptionId} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="internal">Internal</SelectItem>
        <SelectItem value="client-visible">Client-visible</SelectItem>
      </SelectContent>
    </Select>
    <p id={descriptionId} className="text-sm text-muted-foreground">
      {pending
        ? "Saving visibility…"
        : value === "client-visible"
          ? `${clientName ?? "Assigned clients"} can view this item after project access is verified.`
          : "Only authorized internal members can view this item."}
    </p>
  </div>;
}

