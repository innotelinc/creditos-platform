import { test, expect, request as pwRequest } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loginViaUi, SEED } from "./helpers";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function apiLogin(email: string, password = "Password123!") {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return { ctx, user: (await res.json()).user as { id: string; email: string; role: string } };
}

test.describe("Client portal — own-data scoping", () => {
  test("client signs in and sees only client navigation", async ({ page }) => {
    await loginViaUi(page, SEED.client.email);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`Welcome back, ${SEED.client.firstName}`);
    await expect(page.getByText("credit repair plan")).toBeVisible();
    // No staff-only nav for clients.
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    // Required compliance disclosure (§7.2) on the client dashboard.
    await expect(page.getByRole("note", { name: "Compliance disclosure" })).toBeVisible();
  });

  test("compliance disclosure appears on report and dispute views", async ({ page }) => {
    await loginViaUi(page, SEED.client.email);
    for (const label of ["Reports", "Disputes"]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("note", { name: "Compliance disclosure" })).toBeVisible();
    }
  });

  test("client cannot read another client's report through the BFF", async () => {
    const staff = await apiLogin(SEED.specialist.email);
    const clients = (
      (await (await staff.ctx.get("/api/users/clients")).json()) as {
        items: Array<{ id: string; email: string }>;
      }
    ).items;
    const other = clients.find((c) => c.email === SEED.otherClient.email);
    expect(other, `seed must contain ${SEED.otherClient.email}`).toBeTruthy();

    // Staff uploads a report for the other client.
    const csv = await readFile(path.resolve("apps/api/prisma/seeds/sample-experian.csv"));
    const up = await staff.ctx.post("/api/reports", {
      params: { clientId: other!.id, bureau: "EQUIFAX" },
      multipart: { file: { name: "sample-experian.csv", mimeType: "text/csv", buffer: csv } },
    });
    expect(up.status()).toBe(201);
    const report = (await up.json()) as { id: string };

    // The client must be blocked from it and never see it in their own list.
    const client = await apiLogin(SEED.client.email);
    expect((await client.ctx.get(`/api/reports/${report.id}`)).status()).toBe(404);
    const own = (await (await client.ctx.get("/api/reports")).json()) as {
      items: Array<{ client: { id: string } }>;
    };
    for (const r of own.items) expect(r.client.id).toBe(client.user.id);
    await staff.ctx.dispose();
    await client.ctx.dispose();
  });

  test("client cannot read another client's letters or disputes", async () => {
    const staff = await apiLogin(SEED.specialist.email);
    const clients = (
      (await (await staff.ctx.get("/api/users/clients")).json()) as {
        items: Array<{ id: string; email: string }>;
      }
    ).items;
    const other = clients.find((c) => c.email === SEED.otherClient.email);
    expect(other, `seed must contain ${SEED.otherClient.email}`).toBeTruthy();

    const letter = (await (
      await staff.ctx.post("/api/letters/generate", {
        data: { templateCode: "609", clientId: other!.id },
      })
    ).json()) as { id: string };
    const dispute = (await (
      await staff.ctx.post("/api/disputes", {
        data: { clientId: other!.id, title: "E2E: cross-client isolation fixture" },
      })
    ).json()) as { id: string };

    const client = await apiLogin(SEED.client.email);
    expect((await client.ctx.get(`/api/letters/${letter.id}`)).status()).toBe(404);
    expect((await client.ctx.get(`/api/disputes/${dispute.id}`)).status()).toBe(404);

    const ownLetters = ((await (await client.ctx.get("/api/letters")).json()) as {
      items: Array<{ client: { id: string } }>;
    }).items;
    for (const l of ownLetters) expect(l.client.id).toBe(client.user.id);
    const ownDisputes = ((await (await client.ctx.get("/api/disputes")).json()) as {
      items: Array<{ client: { id: string } }>;
    }).items;
    for (const d of ownDisputes) expect(d.client.id).toBe(client.user.id);
    await staff.ctx.dispose();
    await client.ctx.dispose();
  });
});
