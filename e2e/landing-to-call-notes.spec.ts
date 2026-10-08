import { expect, test } from "@playwright/test";

// The one end-to-end check (spec #1): the landing page, "Try the demo", and
// the Sample Call played to its Call Notes. No Vapi and no Redis needed.
test("a Visitor goes from the landing page to the Sample Call's Call Notes", async ({ page }) => {
  // A fake clock, so the Sample Call passes at once. A fake clock cannot move
  // real sound, so the sound is blocked: the call goes on in silence, on the clock.
  await page.clock.install();
  await page.route("**/*.mp3", (route) => route.abort());

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

  // /demo is a full page load: a click before React hydrates does nothing.
  // Retry until the click lands and the Sample Call is running.
  const play = page.getByRole("button", { name: "Play the Sample Call" });
  await expect(async () => {
    await play.click();
    await expect(page.getByRole("button", { name: "Stop the Sample Call" })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(page.getByRole("button", { name: "Pause the Sample Call" })).toBeVisible();
  // Keep moving the clock until the Call Notes open: the blocked sound's error
  // arrives in real time, and only then does the call go on on the clock.
  await expect(async () => {
    await page.clock.runFor(20_000);
    await expect(page.getByRole("heading", { name: "Call Notes" })).toBeVisible({ timeout: 500 });
  }).toPass();
});
