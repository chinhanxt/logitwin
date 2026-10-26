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
test("portal workflow, knowledge retrieval, route preview and responsive navigation", async ({ page, browser }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "planner");
  await page.getByRole("button", { name: "Phân tích dữ liệu" }).click();
  await expect(page.getByRole("status")).toContainText("Đã phân tích");
  await page
    .getByRole("button", { name: "Quyết định", exact: false })
    .filter({ has: page.locator("span") })
    .first()
    .click();
  await page.getByLabel("Lọc trạng thái").selectOption("pending");
  if (await page.locator(".decision-card").count()) {
    await page.locator(".decision-card").first().click();
    await expect(page.getByRole("heading", { name: "Độ tin cậy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Phê duyệt", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Đóng chi tiết" }).click();
  }
  await page.getByRole("button", { name: "Trợ lý Intelligence", exact: true }).click();
  await page.getByRole("button", { name: "Lập chỉ mục AI" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lập chỉ mục", { timeout: 60000 });
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(page.getByRole("heading", { name: "Việc cần duyệt" })).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".source-list")).toBeVisible();
  await page.screenshot({ path: "docs/assistant.png", fullPage: true });
  await page.getByRole("button", { name: "Lộ trình giao hàng", exact: true }).click();
  await page.getByRole("button", { name: "Xem trước tuyến" }).click();
  await expect(page.getByText("Xuất phát từ Quận 1; một xe giao lần lượt từng lệnh.")).toBeVisible();
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.screenshot({ path: "docs/portal-desktop.png", fullPage: true });
  await page.reload();
  await expect(page.getByText("API đã kết nối")).toBeVisible();
  await page.getByRole("button", { name: "Kiến trúc 7 lớp", exact: true }).click();
  await expect(page.locator(".layer-list article")).toHaveCount(7);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "docs/portal-mobile.png", fullPage: true });
  const context = await browser.newContext();
  try {
    const a = await context.newPage();
    await login(a, "approver");
    await a.getByRole("button", { name: "Hàng hóa & điều chuyển", exact: true }).click();
    await expect(a.getByRole("heading", { name: "Tồn kho & mức phủ nhu cầu" })).toBeVisible();
  } finally {
    await context.close();
  }
  expect(errors).toEqual([]);
});
