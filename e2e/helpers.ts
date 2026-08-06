import { expect, type Page } from "@playwright/test";

/** Seed accounts created by apps/api/prisma/seed.ts (Summit Credit demo agency). */
export const SEED = {
  specialist: { email: "specialist@summit.test", password: "Password123!", firstName: "David" },
  admin: { email: "admin@summit.test", password: "Password123!" },
  client: { email: "client@summit.test", password: "Password123!", firstName: "Alex" },
  // A second client in the same tenant, used as the isolation fixture.
  otherClient: { email: "jordan@summit.test", password: "Password123!" },
};

/** Signs in through the real UI form and waits for the dashboard. */
export async function loginViaUi(page: Page, email: string, password = "Password123!") {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
}
