import { test, expect } from "@playwright/test";

test.describe("Public marketing site", () => {
  test("landing page renders hero and auth links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /start free trial/i }).first()).toBeVisible();
    await expect(page.getByText("Your credit in motion").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Features" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Pricing" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Help center" }).first()).toBeVisible();
  });

  test("login page renders with the demo workspace hint", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText(/Demo workspace/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
  });
});
