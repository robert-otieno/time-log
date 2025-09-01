"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
}

interface LabeledSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: Option[];
  includeNone?: boolean; // optional prop for cases like priority
  noneLabel?: string; // label for "none" option
}

export default function LabeledSelect({ label, value, onChange, placeholder, options, includeNone = false, noneLabel = "None" }: LabeledSelectProps) {
  return (
    <div className="flex items-center">
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="border-0 shadow-none" aria-label={`Select ${label.toLowerCase()}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {includeNone && <SelectItem value="none">{noneLabel}</SelectItem>}
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
