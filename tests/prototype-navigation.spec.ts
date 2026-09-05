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

  await input.fill("豆腐，牛肉末");
  await page.getByRole("button", { name: "添加食材" }).click();

  await expect(page.locator(".featured-recipe strong")).toHaveText("麻婆豆腐");
  await expect(page.locator(".featured-recipe .match-badge")).toHaveText("现有食材可做");
  await expect(page.locator(".featured-recipe img")).toHaveAttribute("alt", "麻婆豆腐成菜图");
});

test("generic ingredient input surfaces related recipes without claiming the exact cut is owned", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });

  await input.fill("鱼肉");
  await page.getByRole("button", { name: "看看能做什么" }).click();

  await expect(page.locator(".featured-recipe strong")).toHaveText("剁椒鱼头");
  await expect(page.locator(".featured-recipe")).toContainText("同类食材相关，仍需 花鲢鱼头");
  await expect(page.locator(".featured-recipe")).not.toContainText("现有食材可做");

  await page.getByRole("navigation", { name: "主要导航" })
    .getByRole("button", { name: "菜谱", exact: true })
    .click();
  const search = page.getByRole("searchbox", { name: "搜索菜谱" });
  await search.fill("鱼肉");
  await search.press("Enter");

  await expect(page.locator(".catalog-list .recipe-row strong").first()).toHaveText("剁椒鱼头");
  await expect(page.locator(".catalog-list .recipe-row", { hasText: "鱼香肉丝" })).toHaveCount(0);
});

test("outside tap dismisses the keyboard, preserves the ingredient draft, and permits refocus", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });
  const keyboard = page.getByTestId("keyboard-dock");

  await input.click();
  await input.fill("豆腐");
  await page.getByRole("heading", { name: "家里有什么？" }).click();

  await expect(keyboard).toHaveAttribute("data-visible", "false");
  await expect(input).toHaveValue("豆腐");

  await input.click();
  await expect(keyboard).toHaveAttribute("data-visible", "true");
  await expect(input).toBeFocused();
});

test("the primary CTA commits its draft, closes the keyboard, and ranks the new pantry", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });

  await input.click();
  await input.fill("豆腐，牛肉末");
  await page.getByRole("button", { name: "看看能做什么" }).click();

  await expect(input).toHaveValue("");
  const keyboard = page.getByTestId("keyboard-dock");
  await expect(keyboard).toHaveAttribute("data-visible", "false");
  await expect(keyboard).toHaveCSS("visibility", "hidden");
  await expect(page.locator(".featured-recipe strong")).toHaveText("麻婆豆腐");
  await expect(page.locator(".featured-recipe .match-badge")).toHaveText("现有食材可做");
});

test("closing the keyboard never leaves the phone screen scrolled above a blank lower area", async ({ page }) => {
  await page.setViewportSize({ width: 686, height: 663 });

  for (const ingredient of ["牛肉", "毛血"]) {
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "输入家里现有的食材" });

    await input.click();
    await input.fill(ingredient);
    await page.getByTestId("device-screen").evaluate((screen) => {
      // Reproduce the native browser's focus scroll in a short desktop viewport.
      // Some browsers retain this offset after the real keyboard is dismissed.
      screen.scrollTop = 327;
    });
    await page.getByRole("button", { name: "看看能做什么" }).click();
    await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");

    const layout = await page.evaluate(() => {
      const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]')!;
      const viewport = document.querySelector<HTMLElement>('[data-testid="mobile-app-viewport"]')!;
      const screenRect = screen.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();

      return {
        screenScrollTop: screen.scrollTop,
        viewportTopDelta: viewportRect.top - screenRect.top,
        viewportBottomDelta: viewportRect.bottom - screenRect.bottom,
      };
    });

    expect(layout.screenScrollTop, `${ingredient}提交后手机屏幕容器不应残留原生滚动量`).toBe(0);
    expect(Math.abs(layout.viewportTopDelta)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.viewportBottomDelta)).toBeLessThanOrEqual(1);
  }
});

test("zero-match pantry shows guidance instead of a fixed recipe", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });

  await input.fill("毛血");
  await page.getByRole("button", { name: "看看能做什么" }).click();

  await expect(page.getByText("暂时没有精准匹配")).toBeVisible();
  await expect(page.locator(".featured-recipe")).toHaveCount(0);
});

test("shopping add remains complete after leaving and reopening a recipe", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });
  await input.fill("豆腐，牛肉末");
  await input.press("Enter");

  await page.getByRole("button", { name: "查看麻婆豆腐菜谱" }).click();
  await page.getByRole("button", { name: "加入缺料" }).click();
  await expect(page.getByRole("button", { name: "已加入采购单" })).toBeDisabled();

  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "查看麻婆豆腐菜谱" }).click();
  await expect(page.getByRole("button", { name: "已加入采购单" })).toBeDisabled();
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

test("taste pantry input accepts Enter, hides the keyboard, and updates the shared pantry", async ({ page }) => {
  await page.getByRole("navigation", { name: "主要导航" })
    .getByRole("button", { name: "口味", exact: true })
    .click();

  const input = page.getByRole("textbox", { name: "补充常备食材" });
  await input.click();
  await input.fill("木耳");
  await input.press("Enter");

  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "移除木耳", exact: true })).toBeVisible();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
});

test("bottom navigation hides during scroll activity and returns after scrolling stops", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });
  await input.fill("豆腐，牛肉末，五花肉，青椒");
  await input.press("Enter");

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

test("repeated input, tab, detail, and back operations remain responsive and idempotent", async ({ page }) => {
  test.setTimeout(45_000);
  const navigation = page.getByRole("navigation", { name: "主要导航" });
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });
  const aliases = ["鸡腿", "鸡腿肉", "去骨鸡腿", "鸡腿", "鸡腿肉"];

  for (const ingredient of aliases) {
    await input.click();
    await input.fill(ingredient);
    await page.getByRole("heading", { name: "家里有什么？" }).click();
    await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
    await input.click();
    await input.press("Enter");

    await navigation.getByRole("button", { name: "菜谱", exact: true }).click();
    await expect(page.getByRole("heading", { name: "想学哪道菜？" })).toBeVisible();
    await page.locator(".catalog-list .recipe-row").first().click();
    await expect(page.getByRole("button", { name: "返回", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await expect(page.getByRole("heading", { name: "想学哪道菜？" })).toBeVisible();
    await navigation.getByRole("button", { name: "找菜", exact: true }).click();
    await expect(page.getByRole("heading", { name: "家里有什么？" })).toBeVisible();
  }

  await expect(page.getByRole("button", { name: "移除鸡腿肉", exact: true })).toHaveCount(1);
  await page.waitForTimeout(450);
  await expect(page.locator('.flow-screen[data-flow-current="true"]')).toHaveCount(1);

  await navigation.getByRole("button", { name: "菜谱", exact: true }).click();
  await page.waitForTimeout(450);
  const catalogScroll = page.locator('.flow-screen[data-flow-current="true"] [data-testid="mobile-scroll"]');
  await catalogScroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(navigation).toHaveAttribute("data-scroll-hidden", "false", { timeout: 2_000 });

  const geometry = await page.evaluate(() => {
    const current = document.querySelector<HTMLElement>('.flow-screen[data-flow-current="true"]')!;
    const lastRecipe = current.querySelector<HTMLElement>(".catalog-list .recipe-row:last-child")!;
    const footer = document.querySelector<HTMLElement>(".flow-fixed-footer")!;
    return {
      lastRecipeBottom: lastRecipe.getBoundingClientRect().bottom,
      footerTop: footer.getBoundingClientRect().top,
    };
  });
  expect(geometry.lastRecipeBottom).toBeLessThanOrEqual(geometry.footerTop + 1);
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
