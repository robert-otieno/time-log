import { z } from "zod";

const schema = z.object({
  RESEND_API_KEY: z.string().trim().min(1),
  RESEND_FROM_EMAIL: z.string().trim().min(1),
});
const webhookSchema = z.object({ RESEND_WEBHOOK_SECRET: z.string().trim().regex(/^whsec_/).min(12) });

export type ResendEnvironment = {
  apiKey: string;
  fromEmail: string;
  appUrl: string;
};

export function parseResendEnvironment(environment: Record<string, string | undefined>): ResendEnvironment {
  const result = schema.safeParse(environment);
  if (!result.success) throw new Error("Email delivery is not configured.");
  return {
    apiKey: result.data.RESEND_API_KEY,
    fromEmail: result.data.RESEND_FROM_EMAIL,
    appUrl: parseApplicationUrl(environment),
  };
}

export function parseApplicationUrl(environment: Record<string, string | undefined>): string {
  const configured = environment.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return z.string().url().parse(configured).replace(/\/$/, "");
  if (environment.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("Application URL is not configured.");
}

export function parseResendWebhookSecret(environment: Record<string, string | undefined>) {
  const result = webhookSchema.safeParse(environment);
  if (!result.success) throw new Error("Resend webhook verification is not configured.");
  return result.data.RESEND_WEBHOOK_SECRET;
}
