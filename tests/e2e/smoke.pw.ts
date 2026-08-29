import { expect, test } from "@playwright/test";

const apiBaseURL = process.env.PLAYWRIGHT_BASE_URL
  ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT ?? "8787"}`;

test("loads the public application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/TrangNgữ/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
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

test("enables owner testing only for the current tab", async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), "The production admin key is intentionally unavailable to browser CI.");
  await page.goto("/#/admin");
  await page.getByLabel("Admin access key").fill("e2e-owner-access-key-that-is-safe-and-local");
  await page.getByRole("button", { name: "Open dashboard" }).click();
  const ownerPanel = page.locator(".owner-testing-panel");
  await expect(ownerPanel.getByRole("heading", { name: "Translate beyond today’s public limit" })).toBeVisible();
  await ownerPanel.getByRole("button", { name: "Enable owner testing" }).click();
  await expect(page.getByRole("button", { name: "Owner testing" })).toBeVisible();
  await expect(page.getByText("Owner testing · daily limit bypassed")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Owner testing" })).toHaveCount(0);
  await expect(page.getByText("3 jobs or 45 pages per day")).toBeVisible();
});
