import { test, expect } from "@playwright/test";
import { loginViaUi, SEED } from "./helpers";

test.describe("Authentication & RBAC surfaces", () => {
  test("protected routes redirect unauthenticated visitors to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test("invalid credentials surface an error", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("nobody@summit.test");
    await page.locator('input[name="password"]').fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Sign in failed")).toBeVisible();
  });

  test("specialist signs in and sees the staff dashboard", async ({ page }) => {
    await loginViaUi(page, SEED.specialist.email);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`Welcome back, ${SEED.specialist.firstName}`);
    await expect(page.getByText("AI Analysis")).toBeVisible();
    await expect(page.getByText("across your clients today")).toBeVisible();
    // Specialists are staff but not admins — no Admin nav link.
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("admin signs in and reaches the admin console", async ({ page }) => {
    await loginViaUi(page, SEED.admin.email);
    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Admin");
  });

  test("staff can navigate the main sections", async ({ page }) => {
    await loginViaUi(page, SEED.specialist.email);
    const nav: Array<[string, string]> = [
      ["Reports", "Credit reports"],
      ["Disputes", "Disputes"],
      ["Letters", "Letters"],
      ["Settings", "Settings"],
    ];
    for (const [label, heading] of nav) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    }
  });

  test("signing out returns to login and re-protects routes", async ({ page }) => {
    await loginViaUi(page, SEED.specialist.email);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
