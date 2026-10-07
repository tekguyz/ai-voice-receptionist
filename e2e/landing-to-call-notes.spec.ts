import { expect, test } from "@playwright/test";

// The one end-to-end check (spec #1): the landing page, "Try the demo", and
// the Sample Call played to its Call Notes. No Vapi and no Redis needed.
test("a Visitor goes from the landing page to the Sample Call's Call Notes", async ({ page }) => {
  // A fake clock, so the Sample Call's 30 seconds pass at once.
  await page.clock.install();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("answers when you can");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index, follow/);
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const banner = page.getByRole("complementary", { name: "Demo" });
  await expect(banner.getByRole("link", { name: "Leave the demo" })).toHaveAttribute("href", "/");
  await expect(banner.getByRole("link", { name: "Built by TEKGUYZ" })).toHaveAttribute("href", "https://tekguyz.com");

  await page.getByRole("button", { name: "Play the Sample Call" }).click();
  await page.clock.runFor(35_000);
  // A long wait too, so the check still holds if the clock does not drive a timer.
  await expect(page.getByRole("heading", { name: "Call Notes" })).toBeVisible({ timeout: 45_000 });
});
