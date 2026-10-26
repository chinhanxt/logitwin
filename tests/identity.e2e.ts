import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const identity = JSON.parse(readFileSync(new URL("../var/identity.json", import.meta.url), "utf8")) as {
  users: { username: string; password: string; role: string }[];
};
async function login(page: import("@playwright/test").Page, role: string) {
  const user = identity.users.find((u) => u.role === role)!;
  await page.goto("/");
  await page.getByRole("link", { name: "Đăng nhập qua Keycloak" }).click();
  await page.locator("#username").fill(user.username);
  await page.locator("#password").fill(user.password);
  await page.locator("#kc-login").click();
  await expect(page.getByText("API đã kết nối")).toBeVisible();
}
test("OIDC authentication verifies identity and forbids role selection", async ({ page }) => {
  await login(page, "planner");
  const session = await page.request.get("/api/session");
  const data = await session.json();
  expect(data.mode).toBe("oidc");
  expect(data.role).toBe("planner");
  expect(data.tenant).toBe("demo-chain");
  expect((await page.request.post("/api/session", { data: { role: "approver" } })).status()).toBe(403);
  await page.screenshot({ path: "docs/portal-sso.png", fullPage: true });
});
test("distinct OIDC principals enforce planner/approver separation", async ({ browser }) => {
  const plannerContext = await browser.newContext(),
    approverContext = await browser.newContext();
  try {
    const p = await plannerContext.newPage(),
      a = await approverContext.newPage();
    await login(p, "planner");
    await login(a, "approver");
    const pSession = await (await p.request.get("/api/session")).json(),
      aSession = await (await a.request.get("/api/session")).json();
    expect(pSession.id).not.toBe(aSession.id);
    expect((await a.request.post("/api/analysis", { data: {} })).status()).toBe(403);
    expect((await p.request.post("/api/analysis", { data: {} })).status()).toBe(200);
    const overview = await (await p.request.get("/api/overview")).json();
    const pending = overview.decisions.find((d: { status: string; created_by: string }) => d.status === "pending" && d.created_by === pSession.id);
    if (pending) {
      expect((await p.request.post(`/api/decisions/${pending.id}/approve`, { data: {} })).status()).toBe(403);
      expect((await a.request.post(`/api/decisions/${pending.id}/approve`, { data: {} })).status()).toBe(200);
    }
  } finally {
    await plannerContext.close();
    await approverContext.close();
  }
});
