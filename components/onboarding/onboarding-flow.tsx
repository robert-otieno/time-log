"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { saveOnboardingAction } from "@/app/(app)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { TimePicker } from "@/components/ui/time-picker";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import { educationStepSchema, organizationStepSchema, profileStepSchema, projectStepSchema, type OnboardingState } from "@/domain/onboarding/schemas";

type Step = OnboardingState["currentStep"];
type Initial = {
  step: Step; displayName: string; timezone: string;
  workingHours: { days: Array<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun">; start: string; end: string };
  emailPreferences: { assignments: boolean; mentions: boolean; reminders: boolean; digest: boolean };
  organizationName: string; projectName: string;
};

const steps: Exclude<Step, "complete">[] = ["profile", "organization", "project", "education"];
const labels = { profile: "Your profile", organization: "Your workspace", project: "First project", education: "Ready to work" };

export function OnboardingFlow({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initial.step);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const index = Math.max(0, steps.indexOf(step as Exclude<Step, "complete">));

  function submit(input: unknown) {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingAction(input);
      if (!result.ok) { setError(result.error); return; }
      if (result.currentStep === "complete") { router.replace("/"); router.refresh(); return; }
      setStep(result.currentStep);
    });
  }

  return <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16">
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-primary">Time Log setup</p>
        <div className="flex items-end justify-between gap-4"><h1 className="text-3xl font-semibold tracking-tight">Set up your workspace</h1><span className="text-sm text-muted-foreground">Step {index + 1} of 4</span></div>
        <Progress value={(index + 1) * 25} aria-label={`Onboarding progress: step ${index + 1} of 4`} />
      </div>
      {step === "profile" && <ProfileStep initial={initial} pending={pending} error={error} submit={submit} />}
      {step === "organization" && <NameStep kind="organization" initialName={initial.organizationName} pending={pending} error={error} submit={submit} />}
      {step === "project" && <NameStep kind="project" initialName={initial.projectName} pending={pending} error={error} submit={submit} />}
      {step === "education" && <EducationStep pending={pending} error={error} submit={submit} />}
    </div>
  </main>;
}

function Submit({ pending, children }: { pending: boolean; children: string }) {
  return <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving…" : children}</Button>;
}

function ProfileStep({ initial, pending, error, submit }: { initial: Initial; pending: boolean; error: string | null; submit(input: unknown): void }) {
  const timezone = useMemo(() => initial.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", [initial.timezone]);
  const form = useForm({ resolver: zodResolver(profileStepSchema), defaultValues: { step: "profile" as const, displayName: initial.displayName, timezone, workingHours: initial.workingHours, emailPreferences: initial.emailPreferences } });
  const days = useWatch({ control: form.control, name: "workingHours.days" });
  const preferences = useWatch({ control: form.control, name: "emailPreferences" });
  return <Card><CardHeader><CardTitle>{labels.profile}</CardTitle><CardDescription>Set your local schedule so dates, reminders, and future reports use the right context.</CardDescription></CardHeader>
    <form onSubmit={form.handleSubmit(submit)}><CardContent className="space-y-5">
      <Field label="Display name" error={form.formState.errors.displayName?.message}><Input {...form.register("displayName")} /></Field>
      <Field label="Timezone" error={form.formState.errors.timezone?.message}><Controller control={form.control} name="timezone" render={({ field, fieldState }) => <TimezoneCombobox value={field.value} onValueChange={field.onChange} disabled={pending} aria-invalid={fieldState.invalid} />} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Work starts" error={form.formState.errors.workingHours?.start?.message}><Controller control={form.control} name="workingHours.start" render={({ field, fieldState }) => <TimePicker label="Work starts" value={field.value} onValueChange={field.onChange} disabled={pending} aria-invalid={fieldState.invalid} />} /></Field><Field label="Work ends" error={form.formState.errors.workingHours?.end?.message}><Controller control={form.control} name="workingHours.end" render={({ field, fieldState }) => <TimePicker label="Work ends" value={field.value} onValueChange={field.onChange} disabled={pending} aria-invalid={fieldState.invalid} />} /></Field></div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Working days</legend><div className="flex flex-wrap gap-3">{(["mon","tue","wed","thu","fri","sat","sun"] as const).map((day)=><label key={day} className="flex items-center gap-2 text-sm capitalize"><Checkbox checked={days.includes(day)} onCheckedChange={(checked)=>form.setValue("workingHours.days", checked ? [...days,day] : days.filter((value)=>value!==day), { shouldValidate:true })}/>{day}</label>)}</div></fieldset>
      <fieldset className="space-y-3"><legend className="text-sm font-medium">Email preferences</legend>{(["assignments","mentions","reminders","digest"] as const).map((key)=><label key={key} className="flex items-center gap-2 text-sm capitalize"><Checkbox checked={preferences[key]} onCheckedChange={(checked)=>form.setValue(`emailPreferences.${key}`, checked === true)}/>{key}</label>)}<p className="text-sm text-muted-foreground">Security and invitation emails are always enabled.</p></fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent><CardFooter className="justify-end pt-6"><Submit pending={pending}>Continue</Submit></CardFooter></form></Card>;
}

function NameStep({ kind, initialName, pending, error, submit }: { kind: "organization"|"project"; initialName: string; pending: boolean; error: string|null; submit(input: unknown): void }) {
  const schema = kind === "organization" ? organizationStepSchema : projectStepSchema;
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { step: kind, name: initialName } });
  return <Card><CardHeader><CardTitle>{labels[kind]}</CardTitle><CardDescription>{kind === "organization" ? "Choose the name your team will see. You can change it later." : "Start with To-dos and Time tracking. More tools can be enabled later."}</CardDescription></CardHeader>
    <form onSubmit={form.handleSubmit((value)=>submit(value))}><CardContent className="space-y-4"><Field label={kind === "organization" ? "Workspace name" : "Project name"} error={form.formState.errors.name?.message}><Input {...form.register("name")} /></Field>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</CardContent><CardFooter className="justify-end pt-6"><Submit pending={pending}>Continue</Submit></CardFooter></form></Card>;
}

function EducationStep({ pending, error, submit }: { pending: boolean; error: string|null; submit(input: unknown): void }) {
  const form = useForm({ resolver: zodResolver(educationStepSchema), defaultValues: { step: "education" as const, acknowledged: false } });
  const acknowledged = useWatch({ control: form.control, name: "acknowledged" });
  return <Card><CardHeader><CardTitle>{labels.education}</CardTitle><CardDescription>Time Log keeps tracked work clear and accountable.</CardDescription></CardHeader><form onSubmit={form.handleSubmit(submit)}><CardContent className="space-y-5"><div className="rounded-lg border bg-muted/40 p-4"><p className="font-medium">Choose the task before starting the timer</p><p className="mt-1 text-sm text-muted-foreground">Members clearly identify what they are working on. Organization admins may track project-level work when needed.</p></div><label className="flex items-start gap-3 text-sm"><Checkbox checked={acknowledged} onCheckedChange={(checked)=>form.setValue("acknowledged", checked === true, { shouldValidate:true })}/><span>I understand the task-first timer workflow.</span></label>{form.formState.errors.acknowledged && <p className="text-sm text-destructive">Confirm this guidance to finish.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</CardContent><CardFooter className="justify-end pt-6"><Submit pending={pending}>Finish setup</Submit></CardFooter></form></Card>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}{error && <p className="text-sm text-destructive">{error}</p>}</div>; }
