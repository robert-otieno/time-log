"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateNotificationPreferencesAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import type { z } from "zod";
import type { updateNotificationPreferencesSchema } from "@/domain/notifications/preferences";

type Values = z.infer<typeof updateNotificationPreferencesSchema>;
const choices = [{ key: "assignments", label: "Task assignments", description: "When someone assigns you new work." }, { key: "mentions", label: "Mentions", description: "When a teammate mentions you." }, { key: "reminders", label: "Reminders", description: "Upcoming deadlines and scheduled reminders." }, { key: "announcements", label: "Announcements", description: "Project announcements you are allowed to view." }] as const;

export function NotificationPreferencesForm({ initial }: { initial: Values }) {
  const [values, setValues] = useState(initial); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  const save = () => startTransition(async () => { setMessage(null); const result = await updateNotificationPreferencesAction(values); setMessage(result.ok ? "Preferences saved." : result.error); });
  return <div className="space-y-6"><div className="space-y-2"><Label>Personal timezone</Label><TimezoneCombobox value={values.timezone} onValueChange={(timezone) => setValues({ ...values, timezone })} disabled={pending} /><p className="text-xs text-muted-foreground">Used for reminder and digest schedules; it does not rewrite stored timestamps.</p></div><div className="space-y-3"><div><h2 className="font-medium">Email categories</h2><p className="text-sm text-muted-foreground">Turn off non-essential messages individually.</p></div>{choices.map((choice) => <label key={choice.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4"><Checkbox checked={values.email[choice.key]} onCheckedChange={(checked) => setValues({ ...values, email: { ...values.email, [choice.key]: checked === true } })} disabled={pending} /><span><span className="block text-sm font-medium">{choice.label}</span><span className="block text-sm text-muted-foreground">{choice.description}</span></span></label>)}</div><div className="space-y-2"><Label>Digest frequency</Label><Select value={values.email.digestFrequency} onValueChange={(digestFrequency: Values["email"]["digestFrequency"]) => setValues({ ...values, email: { ...values.email, digestFrequency } })} disabled={pending}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></div><div className="rounded-lg border bg-muted/30 p-4"><p className="text-sm font-medium">Always delivered</p><p className="text-sm text-muted-foreground">Account security and organization invitations cannot be disabled here.</p></div>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<Button onClick={save} disabled={pending}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : "Save preferences"}</Button></div>;
}
