import { expect, test } from "@playwright/test";

test("signed-out users cannot reopen a protected page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByRole("heading", { name: "Welcome to Time Log" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
});

test("an external return path remains on Time Log", async ({ page }) => {
  await page.goto("/login?next=//evil.example");

  await expect(page).toHaveURL(/localhost:3000\/login/);
  await expect(page.getByRole("heading", { name: "Welcome to Time Log" })).toBeVisible();
});

test("logout expires current-browser authentication cookies", async ({
  context,
  page,
}) => {
  await page.goto("/login");
  await context.addCookies([
    {
      name: "time_log_session",
      value: "test-session",
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "token",
      value: "legacy-token",
      url: "http://localhost:3000",
      sameSite: "Lax",
    },
  ]);

  const status = await page.evaluate(async () => {
    const response = await fetch("/api/auth/logout", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return response.status;
  });

  expect(status).toBe(200);
  const cookieNames = (await context.cookies()).map((cookie) => cookie.name);
  expect(cookieNames).not.toContain("time_log_session");
  expect(cookieNames).not.toContain("token");
});
