import { test, expect } from "@playwright/test";

test.describe("Marketing & pricing", () => {
  test("pricing page shows both business and consumer models", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /pricing built for both sides/i })).toBeVisible();

    // Business model (default tab)
    await expect(page.getByText("For credit repair agencies")).toBeVisible();
    for (const plan of ["Starter", "Professional", "Business", "Enterprise"]) {
      await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
    }

    // Consumer model tab
    await page.getByRole("tab", { name: /for consumers/i }).click();
    await expect(page.getByText("For consumers repairing their credit")).toBeVisible();
    for (const plan of ["Kickstart", "Standard Repair", "Complete Repair", "Credit Monitoring"]) {
      await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
    }
  });

  test("features and about pages render", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByRole("heading", { name: /everything a repair operation needs/i })).toBeVisible();
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /the operating system for credit repair/i })).toBeVisible();
  });

  test("knowledge base lists seeded articles and opens one", async ({ page }) => {
    await page.goto("/knowledge-base");
    await expect(page.getByRole("heading", { name: "Help center" })).toBeVisible();
    await expect(page.getByText("What is credit repair?")).toBeVisible();
    await expect(page.getByText("Dispute rounds 1–3, explained")).toBeVisible();
    await page.getByRole("link", { name: /what is credit repair/i }).click();
    await expect(page.getByRole("heading", { name: "What is credit repair?" })).toBeVisible();
    await expect(page.getByText(/not a law firm/i)).toBeVisible();
  });

  test("contact form submits successfully", async ({ page }) => {
    await page.goto("/contact");
    await page.locator('input[name="name"]').fill("E2E Tester");
    await page.locator('input[name="email"]').fill("e2e@example.com");
    await page.locator('input[name="subject"]').fill("Pricing question");
    await page.locator('textarea[name="message"]').fill("Hello, tell me more about the Business plan.");
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(page.getByText("Message sent")).toBeVisible();
  });
});
