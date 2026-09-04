# Keyboard, Matching, and Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ingredient entry, recipe ranking, and repeated navigation deterministic and reliable, then publish the verified fix to the existing public site.

**Architecture:** Centralize ingredient normalization and compatibility in one matcher, move local mutations to a pure reducer, and make keyboard/navigation controls stable across rerenders. The home composer uses one explicit commit path for Enter, plus, and the primary CTA, while outside dismissal only changes focus.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Node test runner, Playwright, Cloudflare Worker/Sites

**Spec:** `docs/superpowers/specs/2026-09-04-keyboard-matching-stability-design.md`

## Global Constraints

- Preserve the protected mobile frame, live status bar, device picker, calibrated iPhone/Pixel geometry, and simulated keyboard assets.
- The runtime may change only where the user explicitly requested keyboard and navigation lifecycle fixes; update runtime lock hashes only after verification.
- A new user pantry is empty; existing saved data is retained.
- Blur preserves draft text; Enter, plus, and “看看能做什么” commit it.
- No unrestricted substring ingredient matching.
- Home ingredient recommendations contain only positive matches.
- All changes follow strict failing-test-first TDD.

---

### Task 1: Canonical Ingredient Matching and Ranking

**Files:**
- Create: `src/ingredientMatching.ts`
- Modify: `src/domain.ts`
- Test: `tests/domain.test.ts`

**Interfaces:**
- Produces: `canonicalIngredient(value: string): string`
- Produces: `createPantryIndex(items: string[]): PantryIndex`
- Produces: `matchIngredient(index: PantryIndex, ingredientName: string): IngredientNameMatch`
- Produces: `hasIngredient(pantry: string[], ingredientName: string): boolean`
- Produces: `findRelevantRecipes(catalog: Recipe[], pantry: string[]): RankedRecipe[]`

- [ ] **Step 1: Write failing canonicalization and false-positive tests**

```ts
test("canonical matching rejects arbitrary fragments and accepts explicit aliases", () => {
  assert.equal(hasIngredient(["肉", "毛血"], "五花肉"), false);
  assert.equal(hasIngredient(["带皮五花肉"], "五花肉"), true);
  assert.equal(hasIngredient(["干红辣椒"], "干辣椒"), true);
});
```

- [ ] **Step 2: Write a failing weighted-ranking test**

```ts
test("ingredient recommendations exclude zero matches and rank main-ingredient coverage first", () => {
  assert.deepEqual(findRelevantRecipes(recipes, ["肉", "毛血"]), []);
  const ranked = findRelevantRecipes(recipes, ["豆腐", "牛肉末"]);
  assert.equal(ranked[0]?.recipe.name, "麻婆豆腐");
  assert.equal(ranked[0]?.canCook, true);
});
```

- [ ] **Step 3: Run the focused tests and verify failure**

Run: `node --test --test-name-pattern="canonical matching|ingredient recommendations" tests/domain.test.ts`

Expected: FAIL because the shared APIs do not exist and the old substring matcher returns false positives.

- [ ] **Step 4: Implement the shared matcher and ranking order**

Create `PantryIndex` with canonical exact values plus explicit directional compatibility. Replace the private `ingredientMatches` function in `domain.ts`, use main weight `3`, side weight `1`, exact score `1`, compatibility score `0.72`, and retain catalog index as the last tie-breaker.

- [ ] **Step 5: Use the shared matcher in shopping-list construction**

Replace the shopping-list availability check with `matchIngredient(index, ingredient.name).matched`.

- [ ] **Step 6: Run the complete domain suite**

Run: `node --test tests/domain.test.ts`

Expected: PASS with all legacy and new domain behaviors.

### Task 2: Atomic Local State and Empty New-User Pantry

**Files:**
- Create: `src/appState.ts`
- Modify: `src/Prototype.tsx`
- Test: `tests/app-state.test.ts`

**Interfaces:**
- Produces: `createInitialState(serialized?: string | null): LocalState`
- Produces: `appStateReducer(state: LocalState, action: AppStateAction): LocalState`

- [ ] **Step 1: Write failing initialization and idempotency tests**

```ts
test("a new user starts empty and repeated aliases remain one pantry item", () => {
  const initial = createInitialState(null);
  assert.deepEqual(initial.pantry, []);
  const once = appStateReducer(initial, { type: "pantry/add", input: "鸡腿" });
  const twice = appStateReducer(once, { type: "pantry/add", input: "鸡腿肉，鸡腿" });
  assert.deepEqual(twice.pantry, ["鸡腿肉"]);
});
```

- [ ] **Step 2: Run the focused state test and verify failure**

Run: `node --test tests/app-state.test.ts`

Expected: FAIL because the reducer module does not exist.

- [ ] **Step 3: Implement the pure reducer**

Move pantry, shopping, preference, and favorite mutations into exhaustive actions. Preserve the existing storage key and hydrate existing values with `normalizeStoredState`.

- [ ] **Step 4: Replace provider mutation closures with `useReducer` and stable callbacks**

Use `useReducer(appStateReducer, storedValue, createInitialState)` and memoized dispatch wrappers. Persist only committed state changes.

- [ ] **Step 5: Run state and domain tests**

Run: `node --test tests/app-state.test.ts tests/domain.test.ts`

Expected: PASS.

### Task 3: Keyboard Lifecycle and Refocus Reliability

**Files:**
- Modify: `src/mobile/Keyboard.tsx`
- Modify: `src/mobile/FlowStack.tsx`
- Modify: `tests/runtime-fixture.tsx`
- Test: `tests/mobile-runtime.spec.ts`
- Modify: `scripts/mobile-runtime-lock.json`

**Interfaces:**
- `KeyboardContextValue.show(element)` and `.hide()` remain public and become referentially stable.
- `KeyboardInput` and `KeyboardTextarea` dismiss on true focus exit but permit direct text-field focus transfer.

- [ ] **Step 1: Write failing outside-dismiss and refocus browser tests**

```ts
test("outside tap dismisses the keyboard, preserves the draft, and permits refocus", async ({ page }) => {
  const input = page.getByLabel("Message");
  await input.fill("豆腐");
  await page.getByRole("heading", { name: "Keyboard fixture" }).click();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
  await expect(input).toHaveValue("豆腐");
  await input.click();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "true");
});
```

- [ ] **Step 2: Run the focused browser test and verify failure**

Run: `npx playwright test tests/mobile-runtime.spec.ts --grep "outside tap"`

Expected: FAIL because outside pointer and blur do not currently hide the keyboard.

- [ ] **Step 3: Stabilize keyboard actions and focus ownership**

Use refs for the focused element and visibility, `useCallback` for `show`/`hide`, a capture-phase outside-pointer listener, and a microtask blur check that keeps a direct text-entry focus transfer alive.

- [ ] **Step 4: Stabilize FlowStack navigation callbacks**

Depend on the stable `hide` callback rather than the entire keyboard context, and make `push`/`replace` no-op when the destination id is already current.

- [ ] **Step 5: Update runtime hashes and run runtime tests**

Run: `npm run update:runtime-lock`

Run: `npm run check:runtime`

Run: `npx playwright test tests/mobile-runtime.spec.ts`

Expected: PASS.

### Task 4: Home Composer Commit Flow and Precise Result States

**Files:**
- Modify: `src/Prototype.tsx`
- Modify: `src/prototype.css`
- Test: `tests/prototype-navigation.spec.ts`

**Interfaces:**
- Home owns `draft` and a single `commitDraft(): boolean` path.
- `IngredientComposer` receives controlled draft props and an explicit commit callback.
- Home uses `findRelevantRecipes` and a local `matchSectionRef`.

- [ ] **Step 1: Write failing outside-dismiss, CTA-commit, and zero-match tests**

```ts
test("the primary CTA commits its draft, closes the keyboard, and ranks the new pantry", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "输入家里现有的食材" });
  await input.fill("豆腐，牛肉末");
  await page.getByRole("button", { name: "看看能做什么" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
  await expect(page.locator(".featured-recipe strong")).toHaveText("麻婆豆腐");
});
```

```ts
test("zero-match pantry shows guidance instead of a fixed recipe", async ({ page }) => {
  await page.getByRole("textbox", { name: "输入家里现有的食材" }).fill("毛血");
  await page.getByRole("button", { name: "看看能做什么" }).click();
  await expect(page.getByText("暂时没有精准匹配")).toBeVisible();
  await expect(page.locator(".featured-recipe")).toHaveCount(0);
});
```

- [ ] **Step 2: Run focused prototype tests and verify failure**

Run: `npx playwright test tests/prototype-navigation.spec.ts --grep "primary CTA|zero-match|outside"`

Expected: FAIL because the CTA neither commits nor hides and zero matches still render fixed recipes.

- [ ] **Step 3: Implement controlled draft and current-screen scroll ref**

Keep blur non-destructive, make Enter/plus/CTA share `commitDraft`, close keyboard before scrolling, and use `matchSectionRef.current` inside nested animation frames instead of `document.querySelector`.

- [ ] **Step 4: Implement positive-match and empty-result presentation**

Render a specific empty state for no pantry and another for no positive match. Use the shared matcher for recipe detail ownership marks.

- [ ] **Step 5: Add visible focus and pressed states without layout shift**

Add `:focus-within` treatment to dark and light search groups, preserve 44px minimum controls, and keep fixed-footer clearance unchanged.

- [ ] **Step 6: Run the complete prototype browser suite**

Run: `npx playwright test tests/prototype-navigation.spec.ts`

Expected: PASS.

### Task 5: Repeated-Operation Regression and Release Cache

**Files:**
- Modify: `tests/prototype-navigation.spec.ts`
- Modify: `public/sw.js`

**Interfaces:**
- No new public API.

- [ ] **Step 1: Write a failing repeated-operation regression test**

Add a browser test that performs at least five cycles of ingredient focus/dismiss/refocus, root-tab replacement, detail push/back, and pantry duplicate submission, then asserts one current screen, one pantry chip per canonical ingredient, responsive navigation, and footer clearance.

- [ ] **Step 2: Run the regression test and verify failure if duplicate/stale behavior remains**

Run: `npx playwright test tests/prototype-navigation.spec.ts --grep "repeated operations"`

Expected: FAIL before the navigation and state stabilization changes; PASS afterward.

- [ ] **Step 3: Increment the service-worker cache namespace**

Change `CACHE_NAME` from `zaobian-shell-v2` to `zaobian-shell-v3` so existing clients activate the corrected shell.

- [ ] **Step 4: Run all automated verification**

Run: `node --test tests/domain.test.ts tests/app-state.test.ts`

Run: `npm run test:runtime`

Run: `npm run check:runtime`

Run: `npm run build`

Run: `npm run test:sites`

Expected: all commands exit 0.

### Task 6: Visual QA and Existing-Site Publication

**Files:**
- Verify: `dist/client/index.html`
- Verify: `dist/server/index.js`
- Verify: `dist/.openai/hosting.json`
- Verify: `.openai/hosting.json`

**Interfaces:**
- Existing public URL remains `https://spicylab-kitchenserver.lirongouyang522.chatgpt.site/`.

- [ ] **Step 1: Open the verified local build in the selected in-app browser**

Check iPhone and Pixel views for closed/focused/dismissed input states, positive and zero-match results, root navigation, detail/back restoration, status chrome, and bottom safe-area clearance.

- [ ] **Step 2: Repeat the critical user journey manually**

Run at least five cycles: focus → type → outside dismiss → refocus → CTA commit → detail → back → switch tabs. Record screenshots of keyboard open, outside-dismissed draft, and ranked results.

- [ ] **Step 3: Publish the intact verified build to the existing Sites project**

Deploy without reinitializing or replacing the Product Design mobile project.

- [ ] **Step 4: Re-open the public URL and verify the deployed version**

Confirm the service worker is updated, the public DOM contains the new empty-state copy, and all critical interactions match the local build.

