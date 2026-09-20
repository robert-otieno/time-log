import { describe, expect, it } from "vitest";
import { parseApplicationUrl, parseCronSecret, parseResendEnvironment, parseResendWebhookSecret } from "@/lib/resend-config";

describe("Resend configuration", () => {
  it("parses server email configuration and normalizes the app URL", () => {
    expect(parseResendEnvironment({ RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "Time Log <hello@example.com>", NEXT_PUBLIC_APP_URL: "https://time.example.com/" })).toEqual({ apiKey: "re_test", fromEmail: "Time Log <hello@example.com>", appUrl: "https://time.example.com" });
  });
  it("fails closed when configuration is incomplete", () => {
    expect(() => parseResendEnvironment({})).toThrow("Email delivery is not configured");
  });
  it("uses localhost only outside production when the public URL is absent", () => {
    expect(parseApplicationUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(() => parseApplicationUrl({ NODE_ENV: "production" })).toThrow("Application URL is not configured");
  });
  it("validates the server-only webhook signing secret", () => {
    expect(parseResendWebhookSecret({ RESEND_WEBHOOK_SECRET: "whsec_test_secret" })).toBe("whsec_test_secret");
    expect(() => parseResendWebhookSecret({ RESEND_WEBHOOK_SECRET: "invalid" })).toThrow("not configured");
  });
  it("requires a strong server-only cron secret", () => {
    const secret = "a-secure-cron-secret-that-is-long-enough";
    expect(parseCronSecret({ CRON_SECRET: secret })).toBe(secret);
    expect(() => parseCronSecret({ CRON_SECRET: "too-short" })).toThrow("not configured");
  });
});
