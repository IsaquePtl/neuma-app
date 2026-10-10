import { expect, test, type Locator, type Page } from "@playwright/test";

const FIXTURE = "/dev/player-fixture";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

async function root(page: Page): Promise<Locator> {
  return page.getByTestId("player-root");
}

async function expectPlaying(page: Page, playing: boolean) {
  const player = await root(page);
  await expect(player).toHaveAttribute("data-playing", playing ? "true" : "false");
  await expect(page.getByTestId("player-video")).toHaveJSProperty("paused", !playing);
}

test.describe("touch video player", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: IPHONE_UA,
  });

  test("a tap shows controls and only the orange button toggles playback", async ({
    page,
  }) => {
    await page.goto(FIXTURE);
    const player = await root(page);
    await expect(player).toHaveAttribute("data-pointer", "coarse");
    await expect(player).toHaveAttribute("data-controls", "visible");
    await expectPlaying(page, false);

    await page.getByTestId("player-play").tap();
    await expectPlaying(page, true);
    await expect(player).toHaveAttribute("data-controls", "hidden", { timeout: 5_000 });

    await page.getByTestId("player-surface").tap();
    await expect(player).toHaveAttribute("data-controls", "visible");
    await expectPlaying(page, true);
    await page.waitForTimeout(450);
    await expectPlaying(page, true);

    await expect(player).toHaveAttribute("data-controls", "hidden", { timeout: 5_000 });

    await page.getByTestId("player-surface").tap();
    await expect(player).toHaveAttribute("data-controls", "visible");
    await expectPlaying(page, true);

    await page.getByTestId("player-play").tap();
    await expectPlaying(page, false);
    await page.waitForTimeout(450);
    await expectPlaying(page, false);
    await expect(player).toHaveAttribute("data-controls", "visible");

    await page.getByTestId("player-play").tap();
    await expectPlaying(page, true);
    await page.waitForTimeout(450);
    await expectPlaying(page, true);

    await page.getByTestId("player-timeline").tap();
    await expectPlaying(page, true);
    await page.getByTestId("player-fullscreen").tap();
    await expectPlaying(page, true);
  });
});

test.describe("touch video player on a wider screen", () => {
  test.use({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });

  test("volume does not pause playback", async ({ page }) => {
    await page.goto(FIXTURE);
    const player = await root(page);
    await expect(player).toHaveAttribute("data-pointer", "coarse");
    await page.getByTestId("player-play").tap();
    await expectPlaying(page, true);
    await page.getByTestId("player-mute").tap();
    await expectPlaying(page, true);
    await page.waitForTimeout(450);
    await expectPlaying(page, true);
  });
});

test.describe("desktop video player", () => {
  test("clicking the picture toggles playback", async ({ page }) => {
    await page.goto(FIXTURE);
    const player = await root(page);
    await expect(player).toHaveAttribute("data-pointer", "fine");

    await page.getByTestId("player-play").click();
    await expectPlaying(page, true);
    await expect(player).toHaveAttribute("data-controls", "hidden", { timeout: 5_000 });

    await page.getByTestId("player-surface").click();
    await expectPlaying(page, false);
    await page.waitForTimeout(450);
    await expectPlaying(page, false);

    await page.getByTestId("player-surface").click({ position: { x: 12, y: 12 } });
    await expectPlaying(page, true);
    await page.waitForTimeout(450);
    await expectPlaying(page, true);

    await expect(player).toHaveAttribute("data-controls", "visible");
    await page.getByTestId("player-play").click();
    await expectPlaying(page, false);
    await page.waitForTimeout(450);
    await expectPlaying(page, false);
  });
});
