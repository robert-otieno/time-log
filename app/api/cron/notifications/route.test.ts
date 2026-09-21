import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), secret: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/domain/notifications/scheduler", () => ({
  runScheduledNotifications: mocks.run,
}));
vi.mock("@/lib/resend-config", () => ({ parseCronSecret: mocks.secret }));
import { GET, POST } from "@/app/api/cron/notifications/route";

const SECRET = "a-secure-cron-secret-that-is-long-enough";
const request = (authorization?: string, method = "POST") =>
  new Request("https://example.com/api/cron/notifications", {
    method,
    headers: authorization ? { authorization } : {},
  });

describe("scheduled notifications cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secret.mockReturnValue(SECRET);
    mocks.run.mockResolvedValue({ runId: "run-1", counts: {}, cursor: null });
  });

  it("rejects missing and invalid credentials", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("Bearer wrong"))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs the scheduler for the configured bearer secret", async () => {
    const response = await POST(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledOnce();
  });

  it("accepts Vercel's authenticated GET cron invocation", async () => {
    const response = await GET(request(`Bearer ${SECRET}`, "GET"));
    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledOnce();
  });

  it("fails closed when configuration is missing and permits scheduler retries on failure", async () => {
    mocks.secret.mockImplementationOnce(() => {
      throw new Error("missing");
    });
    expect((await POST(request(`Bearer ${SECRET}`))).status).toBe(500);
    mocks.run.mockRejectedValueOnce(new Error("offline"));
    expect((await POST(request(`Bearer ${SECRET}`))).status).toBe(500);
  });
});
