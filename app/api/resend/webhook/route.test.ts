import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), process: vi.fn(), secret: vi.fn(() => "whsec_test") }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/resend", () => ({ getResendClient: () => ({ webhooks: { verify: mocks.verify } }) }));
vi.mock("@/lib/resend-config", () => ({ parseResendWebhookSecret: mocks.secret }));
vi.mock("@/domain/notifications/webhook", () => ({ processResendWebhook: mocks.process }));
import { POST } from "@/app/api/resend/webhook/route";

const request = (body: string, headers = true) => new Request("https://example.com/api/resend/webhook", { method: "POST", body, headers: headers ? { "svix-id": "evt-1", "svix-timestamp": "1", "svix-signature": "sig" } : {} });

describe("Resend webhook route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.verify.mockReturnValue({ type: "email.sent" }); mocks.process.mockResolvedValue({ outcome: "applied" }); });
  it("passes the untouched raw body and signature headers to Resend", async () => {
    const body = "{ \"type\": \"email.sent\" }"; const response = await POST(request(body));
    expect(response.status).toBe(200); expect(mocks.verify).toHaveBeenCalledWith({ payload: body, headers: { id: "evt-1", timestamp: "1", signature: "sig" }, webhookSecret: "whsec_test" });
  });
  it("rejects missing or invalid signatures", async () => {
    expect((await POST(request("{}", false))).status).toBe(400); mocks.verify.mockImplementation(() => { throw new Error("invalid"); }); expect((await POST(request("{}"))).status).toBe(400);
  });
  it("returns 500 so Resend retries processing failures", async () => {
    mocks.process.mockRejectedValue(new Error("offline")); expect((await POST(request("{}"))).status).toBe(500);
  });
});
