import { redirect } from "next/navigation";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadNotificationPreferences } from "@/domain/notifications/preferences";
import { getActiveOrganizationId, getSessionActor } from "@/lib/server-session";

export default async function SettingsPage() {
  const actor = await getSessionActor(); if (!actor) redirect("/login?next=/settings"); const organizationId = await getActiveOrganizationId(actor); const preferences = await loadNotificationPreferences(actor, organizationId); if (!preferences) redirect("/");
  return <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6"><header><p className="text-sm font-medium text-primary">Personal settings</p><h1 className="text-3xl font-semibold tracking-tight">Notifications</h1><p className="mt-1 text-muted-foreground">Choose when Time Log emails you. These settings apply to your account.</p></header><Card><CardHeader><CardTitle>Email and timezone</CardTitle><CardDescription>Timezone controls when scheduled summaries and reminders are delivered.</CardDescription></CardHeader><CardContent><NotificationPreferencesForm initial={{ timezone: preferences.timezone, email: preferences.email }} /></CardContent></Card></main>;
}
