import { expect, test } from "@playwright/test";

const apiBaseURL = process.env.PLAYWRIGHT_BASE_URL
  ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT ?? "8787"}`;

test("loads the public application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/TrangNgữ/);
  await expect(page.getByText("TrangNgữ", { exact: true }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/GEMINI_API_KEY|SESSION_SIGNING_SECRET|IP_HASH_SALT/);
});

test("reports a healthy API", async ({ request }) => {
  const response = await request.get(`${apiBaseURL}/api/health`);

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "ok" }));
});

test("does not overflow the viewport horizontally", async ({ page }) => {
  await page.goto("/");

  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
});
