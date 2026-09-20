"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateOrganizationSettingsAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";

export function OrganizationSettingsForm({ initialName, initialTimezone }: { initialName: string; initialTimezone: string }) {
  const [name, setName] = useState(initialName); const [timezone, setTimezone] = useState(initialTimezone); const [confirmOpen, setConfirmOpen] = useState(false); const [pending, startTransition] = useTransition(); const [error, setError] = useState<string | null>(null); const timezoneChanged = timezone !== initialTimezone;
  const save = () => startTransition(async () => { setError(null); const result = await updateOrganizationSettingsAction({ name, timezone }); if (result.ok) setConfirmOpen(false); else setError(result.error); });
  const submit = () => timezoneChanged ? setConfirmOpen(true) : save();
  return <><div className="space-y-4"><div className="space-y-2"><Label htmlFor="organization-name">Organization name</Label><Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} disabled={pending} /></div><div className="space-y-2"><Label>Timezone</Label><TimezoneCombobox value={timezone} onValueChange={setTimezone} disabled={pending} /><p className="text-xs text-muted-foreground">Controls report day boundaries and future scheduling.</p></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending || !name.trim() || (name === initialName && timezone === initialTimezone)} onClick={submit}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : "Save settings"}</Button></div><Dialog open={confirmOpen} onOpenChange={(next) => !pending && setConfirmOpen(next)}><DialogContent><DialogHeader><DialogTitle>Change organization timezone?</DialogTitle><DialogDescription>Existing timestamps will not be rewritten, but dates and report day boundaries may display differently in {timezone.replaceAll("_", " ")}.</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={pending} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button disabled={pending} onClick={save}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : "Confirm timezone"}</Button></DialogFooter></DialogContent></Dialog></>;
}
