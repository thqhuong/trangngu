import { expect, test } from "@playwright/test";

const apiBaseURL = process.env.PLAYWRIGHT_BASE_URL
  ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT ?? "8787"}`;

test("loads the public application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/TrangNgữ/);
  await expect(page.getByText("TrangNgữ", { exact: true }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/GEMINI_API_KEY|SESSION_SIGNING_SECRET|IP_HASH_SALT|ADMIN_DASHBOARD_TOKEN/);
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

test("shows an interactive, quota-free PDF comparison", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "See the layout survive the translation" })).toBeVisible();
  const comparison = page.getByRole("slider", { name: "Drag the line across the page" });
  await comparison.scrollIntoViewIfNeeded();
  await expect(comparison).toHaveAttribute("aria-valuenow", "52");
  await comparison.focus();
  await page.keyboard.press("ArrowRight");
  await expect(comparison).toHaveAttribute("aria-valuenow", "54");
  await page.getByRole("button", { name: "Side by side" }).click();
  await expect(page.locator(".sample-split img")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Download sample|Download translated/ })).toHaveCount(0);
});

test("keeps the owner dashboard locked by default", async ({ page }) => {
  await page.goto("/#/admin");

  await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible();
  await expect(page.getByLabel("Admin access key")).toHaveAttribute("type", "password");
  await expect(page.getByText("No key is saved in local storage, cookies, source code, or analytics.")).toBeVisible();
});
