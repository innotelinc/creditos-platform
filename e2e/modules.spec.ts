import { test, expect } from "@playwright/test";
import { loginViaUi, SEED } from "./helpers";

test.describe("App modules (billing / CRM / documents)", () => {
  test("admin sees billing with plan, invoices and entitlements", async ({ page }) => {
    await loginViaUi(page, SEED.admin.email);
    await page.getByRole("link", { name: "Billing", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Billing");
    await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible();
    await expect(page.getByText("Invoices", { exact: true })).toBeVisible();
    await expect(page.getByText(/Business/).first()).toBeVisible();
  });

  test("specialist sees the CRM pipeline with seeded leads", async ({ page }) => {
    await loginViaUi(page, SEED.specialist.email);
    await page.getByRole("link", { name: "CRM", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("CRM pipeline");
    for (const stage of ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]) {
      await expect(page.getByText(stage, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Melissa Grant")).toBeVisible();
    await expect(page.getByText("Derek Stone")).toBeVisible();
  });

  test("client sees the document center", async ({ page }) => {
    await loginViaUi(page, SEED.client.email);
    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Document center");
    await expect(page.getByRole("note", { name: "Compliance disclosure" })).toBeVisible();
  });
});
