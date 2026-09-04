import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("home ingredient input submits a batch with Enter and closes the keyboard", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });
  const keyboard = page.getByTestId("keyboard-dock");

  await input.click();
  await input.fill("牛肉末，鸭血");
  await expect(keyboard).toHaveAttribute("data-visible", "true");
  await input.press("Enter");

  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "移除牛肉末", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "移除鸭血", exact: true })).toBeVisible();
  await expect(keyboard).toHaveAttribute("data-visible", "false");
});

test("new pantry items immediately promote the best matching recipe", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });

  await input.fill("牛肉末");
  await page.getByRole("button", { name: "添加食材" }).click();

  await expect(page.locator(".featured-recipe strong")).toHaveText("麻婆豆腐");
  await expect(page.locator(".featured-recipe .match-badge")).toHaveText("现有食材可做");
  await expect(page.locator(".featured-recipe img")).toHaveAttribute("alt", "麻婆豆腐成菜图");
});

test("recipe search matches ingredient names and Enter closes the keyboard", async ({ page }) => {
  await page.getByRole("navigation", { name: "主要导航" })
    .getByRole("button", { name: "菜谱", exact: true })
    .click();

  const input = page.getByRole("searchbox", { name: "搜索菜谱" });
  await input.fill("毛肚");
  await input.press("Enter");

  await expect(page.locator(".catalog-list .recipe-row strong")).toHaveText(["毛血旺"]);
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
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

test("visible bottom navigation does not cover content on any root tab", async ({ page }) => {
  const navigation = page.locator('nav[aria-label="主要导航"]');
  const tabs = ["找菜", "菜谱", "采购", "口味"];

  for (const tab of tabs) {
    if (tab !== "找菜") {
      await navigation.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(380);
    }

    const geometry = await page.evaluate(() => {
      const currentScreen = document.querySelector<HTMLElement>('.flow-screen[data-flow-current="true"]')!;
      const scroll = currentScreen.querySelector<HTMLElement>(".mobile-scroll")!;
      const footer = document.querySelector<HTMLElement>(".flow-fixed-footer")!;

      return {
        scrollBottom: scroll.getBoundingClientRect().bottom,
        footerTop: footer.getBoundingClientRect().top,
      };
    });

    expect(geometry.scrollBottom, `${tab}页内容应在底栏上方结束`).toBeLessThanOrEqual(geometry.footerTop + 1);
  }
});

test("recipe list keeps its bottom clearance after opening and closing a detail", async ({ page }) => {
  const navigation = page.locator('nav[aria-label="主要导航"]');

  await navigation.getByRole("button", { name: "菜谱", exact: true }).click();
  await page.waitForTimeout(380);

  const scroll = page.locator('.flow-screen:has(.catalog-content) [data-testid="mobile-scroll"]');
  await scroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(navigation).toHaveAttribute("data-scroll-hidden", "false", { timeout: 2_000 });

  await page.getByText("毛血旺", { exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.waitForTimeout(380);

  const returnedScroll = page.locator('.flow-screen:has(.catalog-content) [data-testid="mobile-scroll"]');
  await returnedScroll.evaluate((element) => element.scrollTo({ top: 0 }));
  await returnedScroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(navigation).toHaveAttribute("data-scroll-hidden", "false", { timeout: 2_000 });

  const geometry = await page.evaluate(() => {
    const currentScreen = document.querySelector<HTMLElement>('.flow-screen[data-flow-current="true"]')!;
    const lastRecipe = currentScreen.querySelector<HTMLElement>(".catalog-list .recipe-row:last-child")!;
    const footer = document.querySelector<HTMLElement>(".flow-fixed-footer")!;

    return {
      lastRecipeBottom: lastRecipe.getBoundingClientRect().bottom,
      footerTop: footer.getBoundingClientRect().top,
    };
  });

  expect(geometry.lastRecipeBottom, "从详情返回后，毛血旺应完整停在底栏上方").toBeLessThanOrEqual(geometry.footerTop + 1);
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
