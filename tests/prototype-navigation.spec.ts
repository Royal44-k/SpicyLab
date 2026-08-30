import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("bottom navigation hides during scroll activity and returns after scrolling stops", async ({ page }) => {
  const navigation = page.locator('nav[aria-label="主要导航"]');
  const scroll = page.getByTestId("mobile-scroll");

  await expect(navigation).toHaveAttribute("data-scroll-hidden", "false");
  const box = await scroll.boundingBox();
  if (!box) throw new Error("Scroll target has no bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 180, { steps: 2 });
  await page.waitForTimeout(20);
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await navigation.getAttribute("data-scroll-hidden")).toBe("true");
  await page.mouse.up();

  await expect(navigation).toHaveAttribute("data-scroll-hidden", "false", { timeout: 2_000 });
});

test("iPhone navigation paints through the bottom safe area", async ({ page }) => {
  const layout = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]')!;
    const navigation = document.querySelector<HTMLElement>('nav[aria-label="主要导航"]')!;
    const safeArea = Number.parseFloat(getComputedStyle(screen).getPropertyValue("--device-safe-area-bottom"));
    const safeAreaFill = getComputedStyle(navigation, "::after");

    return {
      safeArea,
      fillHeight: Number.parseFloat(safeAreaFill.height),
      fillBackground: safeAreaFill.backgroundColor,
      navigationBackground: getComputedStyle(navigation).backgroundColor,
    };
  });

  expect(layout.safeArea).toBeGreaterThan(0);
  expect(layout.fillHeight).toBe(layout.safeArea);
  expect(layout.fillBackground).toBe(layout.navigationBackground);
});

test("status chrome switches to a light treatment over the dark home hero", async ({ page }) => {
  const contrast = await page.evaluate(() => {
    const status = document.querySelector<HTMLElement>(".status-bar")!;
    const indicators = document.querySelector<HTMLElement>(".status-indicator-svg")!;

    return {
      statusColor: getComputedStyle(status).color,
      indicatorFilter: getComputedStyle(indicators).filter,
    };
  });

  expect(contrast.statusColor).toBe("rgb(255, 250, 240)");
  expect(contrast.indicatorFilter).not.toBe("none");
});
