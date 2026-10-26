import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import type { Overview } from "../src/portal/api";
const credentials = JSON.parse(readFileSync(new URL("../var/identity.json", import.meta.url), "utf8")).users as {
  username: string;
  password: string;
  role: string;
}[];
async function login(page: Page, role: string) {
  const u = credentials.find((u) => u.role === role)!;
  await page.goto("/");
  await page.getByRole("link", { name: "Đăng nhập qua Keycloak" }).click();
  await page.locator("#username").fill(u.username);
  await page.locator("#password").fill(u.password);
  await page.locator("#kc-login").click();
  await expect(page.getByText("API đã kết nối", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Không gian 3D vận hành logistics")).toBeVisible();
}
async function overview(page: Page) {
  const r = await page.request.get("/api/overview");
  expect(r.status()).toBe(200);
  return (await r.json()) as Overview;
}
function businessState(data: Overview) {
  return { stocks: data.stocks, movements: data.movements, decisions: data.decisions, workflows: data.workflows, events: data.events };
}
async function assertVisualFreeze(page: Page) {
  await expect
    .poll(
      async () => {
        const counter = await page.evaluate(() => (window as unknown as { __twinDraws: number }).__twinDraws);
        await page.waitForTimeout(600);
        return (await page.evaluate(() => (window as unknown as { __twinDraws: number }).__twinDraws)) - counter;
      },
      { timeout: 15000, intervals: [300] },
    )
    .toBe(0);
  // Playwright scrolling a canvas into view triggers ResizeObserver invalidation; measure idle drawing before captures.
  const first = await page.locator(".twin-stage canvas").screenshot();
  await page.waitForTimeout(500);
  const second = await page.locator(".twin-stage canvas").screenshot();
  expect(first.equals(second)).toBe(true);
}
test("3D actions drive BPMN, source/transit/target stock and realtime across authenticated users", async ({ browser }) => {
  test.setTimeout(120000);
  const pContext = await browser.newContext({ viewport: { width: 1600, height: 1100 } }),
    aContext = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  try {
    const p = await pContext.newPage(),
      a = await aContext.newPage(),
      errors: string[] = [],
      remote: string[] = [];
    for (const page of [p, a]) {
      await page.addInitScript(() => {
        const metrics = window as unknown as { __twinDraws: number };
        metrics.__twinDraws = 0;
        for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
          const original = Context.prototype.drawElements;
          Context.prototype.drawElements = function (...args) {
            metrics.__twinDraws++;
            return original.apply(this, args);
          };
        }
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (req) => {
        if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(req.url()) && !req.url().startsWith("data:")) remote.push(req.url());
      });
    }
    await login(p, "planner");
    await login(a, "approver");
    for (const store of ["q1", "q3", "q7"]) expect((await p.request.post("/api/telemetry", { data: { store, temperature: 5 } })).status()).toBe(200);
    expect((await p.request.post("/api/analysis", { data: {} })).status()).toBe(200);
    const initial = await overview(p);
    const decision = initial.decisions.find((d) => d.kind === "transfer" && ["pending", "approved"].includes(d.status));
    expect(decision).toBeTruthy();
    if (decision!.status === "pending") expect((await a.request.post(`/api/decisions/${decision!.id}/approve`, { data: {} })).status()).toBe(200);
    expect((await a.request.post(`/api/decisions/${decision!.id}/execute`, { data: {} })).status()).toBe(200);
    const issued = await overview(a),
      movement = issued.movements.find((m) => m.decision === decision!.id)!;
    expect(movement.status).toBe("reserved");
    const beforeSource = issued.stocks.find((s) => s.id === movement.source)!.on_hand,
      beforeTarget = issued.stocks.find((s) => s.id === movement.target)!.on_hand;
    await expect(a.getByLabel("Chọn đối tượng")).toHaveValue("");
    await a.getByLabel("Chọn đối tượng").selectOption(`movement:${movement.id}`);
    await p.getByLabel("Chọn đối tượng").selectOption(`movement:${movement.id}`);
    const aInspector = a.getByLabel("Thông tin đối tượng vận hành"),
      pInspector = p.getByLabel("Thông tin đối tượng vận hành");
    await expect(aInspector.getByRole("button", { name: "Xác nhận đã xuất phát" })).toBeEnabled();
    await expect(pInspector.getByRole("button", { name: "Xác nhận đã xuất phát" })).toBeDisabled();
    await aInspector.getByRole("button", { name: "Xác nhận đã xuất phát" }).click();
    await expect(aInspector.locator(".twin-status").first()).toHaveText("Đã xuất phát");
    await expect(pInspector.locator(".twin-status").first()).toHaveText("Đã xuất phát", { timeout: 8000 });
    const transit = await overview(a);
    expect(transit.stocks.find((s) => s.id === movement.source)!.on_hand).toBe(beforeSource - movement.quantity);
    expect(transit.stocks.find((s) => s.id === movement.target)!.on_hand).toBe(beforeTarget);
    expect(transit.workflows!.find((w) => w.entity === movement.id)?.currentTask).toBe("receive");
    await expect(aInspector.getByRole("button", { name: "Hủy lệnh", exact: true })).toHaveCount(0);
    // Actual server-issued in-transit movement, with purely visual playback controls.
    await a.mouse.move(5, 5);
    await a.waitForTimeout(1300);
    const movingFrame = await a.locator(".twin-stage canvas").screenshot();
    await a.waitForTimeout(850);
    expect(movingFrame.equals(await a.locator(".twin-stage canvas").screenshot())).toBe(false);
    await a.screenshot({ path: "docs/twin-in-transit.png", fullPage: true });
    await a.screenshot({ path: "docs/waretrack-merged-in-transit.png", fullPage: true });
    await a.getByRole("button", { name: "Dừng chuyển động 3D" }).click();
    await expect(a.locator(".twin-stage")).toHaveAttribute("data-motion", "paused");
    await assertVisualFreeze(a);
    await a.getByRole("button", { name: "Xem gần đối tượng" }).click();
    await assertVisualFreeze(a);
    const canvasBounds = await a.locator(".twin-stage canvas").boundingBox();
    await a.mouse.move(canvasBounds!.x + canvasBounds!.width / 2, canvasBounds!.y + canvasBounds!.height / 2);
    await a.mouse.down({ button: "right" });
    await a.mouse.move(canvasBounds!.x + canvasBounds!.width / 2 + 60, canvasBounds!.y + canvasBounds!.height / 2 - 25, { steps: 5 });
    await a.mouse.up({ button: "right" });
    await a.getByRole("button", { name: "Phóng to mô hình" }).click();
    await assertVisualFreeze(a);
    await a.setViewportSize({ width: 1400, height: 1000 });
    await assertVisualFreeze(a);
    await a.setViewportSize({ width: 1600, height: 1100 });
    await a.getByRole("button", { name: "Góc nhìn từ trên" }).click();
    await assertVisualFreeze(a);
    expect(businessState(await overview(a))).toEqual(businessState(transit));
    await a.getByRole("button", { name: "Khôi phục góc nhìn 3D" }).click();
    await a.getByRole("button", { name: "Chạy chuyển động 3D" }).click();
    await a.getByRole("button", { name: "Mạng lưới", exact: true }).click();
    await expect(a.locator(".twin-stage")).toHaveAttribute("data-view", "network");
    await a.waitForTimeout(1000);
    const networkFrame = await a.locator(".twin-stage canvas").screenshot();
    await a.waitForTimeout(800);
    expect(networkFrame.equals(await a.locator(".twin-stage canvas").screenshot())).toBe(false);
    await a.screenshot({ path: "docs/waretrack-network-in-transit.png", fullPage: true });
    await a.getByRole("button", { name: "Kho chi tiết", exact: true }).click();
    await a.emulateMedia({ reducedMotion: "reduce" });
    await expect(a.locator(".twin-stage")).toHaveAttribute("data-motion", "reduced");
    await assertVisualFreeze(a);
    expect(businessState(await overview(a))).toEqual(businessState(transit));
    await a.emulateMedia({ reducedMotion: "no-preference" });
    await aInspector.getByRole("button", { name: "Xác nhận đã nhận", exact: true }).click();
    await expect(aInspector.locator(".twin-status").first()).toHaveText("Đã nhận");
    await expect(pInspector.locator(".twin-status").first()).toHaveText("Đã nhận", { timeout: 8000 });
    const received = await overview(a);
    expect(received.stocks.find((s) => s.id === movement.target)!.on_hand).toBe(beforeTarget + movement.quantity);
    expect(received.workflows!.find((w) => w.entity === movement.id)?.currentTask).toBe(null);
    await a.screenshot({ path: "docs/twin-desktop.png", fullPage: true });
    if (await a.getByRole("button", { name: "Mở mái để xem kệ" }).count()) await a.getByRole("button", { name: "Mở mái để xem kệ" }).click();
    await a.getByRole("button", { name: "Đóng mái kho" }).click();
    await expect(a.getByRole("button", { name: "Mở mái để xem kệ" })).toBeVisible();
    await a.getByRole("button", { name: "Góc nhìn từ trên" }).click();
    await a.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.screenshot({ path: "docs/twin-mobile.png", fullPage: true });
    expect(errors).toEqual([]);
    expect(remote).toEqual([]);
    writeFileSync(
      "docs/twin-api-validation.json",
      JSON.stringify(
        {
          passed: true,
          decision: decision!.id,
          movement: movement.id,
          quantity: movement.quantity,
          realtime: "SSE reflected second-user changes within 8 seconds",
          engine: received.workflows!.find((w) => w.entity === movement.id)?.engineVersion,
          pageErrors: errors,
          remoteRequests: remote,
          visualChecks: [
            "warehouse motion",
            "paused frames and draw calls settle",
            "focus/top demand camera settles",
            "network motion",
            "reduced motion freezes",
            "playback leaves API business state unchanged",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await pContext.close();
    await aContext.close();
  }
});
test("PO received through batch form keeps new lot metadata and source expiry", async ({ page }) => {
  await login(page, "approver");
  const state = await overview(page),
    d = state.decisions.find((d) => d.kind === "restock" && ["pending", "approved"].includes(d.status));
  expect(d).toBeTruthy();
  if (d!.status === "pending") expect((await page.request.post(`/api/decisions/${d!.id}/approve`, { data: {} })).status()).toBe(200);
  expect((await page.request.post(`/api/decisions/${d!.id}/execute`, { data: {} })).status()).toBe(200);
  const issued = await overview(page),
    m = issued.movements.find((m) => m.decision === d!.id)!;
  await page.getByRole("button", { name: "Hàng hóa & điều chuyển", exact: true }).click();
  const card = page.locator(".movement").filter({ hasText: m.source }).filter({ hasText: "Đơn mua" }).first();
  await card.getByRole("button", { name: "Nhận lô nhập", exact: true }).click();
  await card.getByLabel("Mã lô nhập").fill(`TEST-${m.id.slice(0, 8)}`);
  const expiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await card.getByLabel("Hạn dùng lô nhập").fill(expiry);
  await card.getByRole("button", { name: "Xác nhận nhận lô", exact: true }).click();
  await expect(card.getByText("Đã nhận", { exact: false })).toBeVisible();
  const result = await overview(page),
    lot = result.stocks.find((s) => s.id === m.source)!.lots!.find((l) => l.received_from === m.id)!;
  expect(lot.expires).toBe(expiry);
  expect(lot.on_hand).toBe(m.quantity);
  expect(result.movements.find((x) => x.id === m.id)?.receipt?.batchId).toBe(`TEST-${m.id.slice(0, 8)}`);
});
