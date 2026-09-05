import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptRecipe,
  buildShoppingList,
  findRelevantRecipes,
  hasIngredient,
  normalizeStoredState,
  parseIngredientInput,
  rankRecipes,
} from "../src/domain.ts";
import { recipes } from "../src/recipes.ts";

test("the seed catalog contains 36 balanced regional recipes", () => {
  assert.equal(recipes.length, 36);

  const counts = Object.groupBy(recipes, (recipe) => recipe.cuisine);
  assert.deepEqual(
    Object.fromEntries(Object.entries(counts).map(([cuisine, items]) => [cuisine, items?.length])),
    { 川菜: 9, 重庆菜: 9, 湘菜: 9, 赣菜: 9 },
  );

  for (const recipe of recipes) {
    assert.ok(recipe.ingredients.length >= 5, `${recipe.name} should have a useful ingredient list`);
    assert.ok(recipe.steps.length >= 4, `${recipe.name} should have a usable cooking tutorial`);
  }
});

test("pantry matching understands aliases and ranks fully cookable dishes first", () => {
  const ranked = rankRecipes(recipes, ["鸡腿肉", "干红辣椒", "花椒", "葱", "姜", "蒜"], "鸡");

  assert.equal(ranked[0]?.recipe.name, "辣子鸡");
  assert.equal(ranked[0]?.canCook, true);
  assert.equal(ranked[0]?.missing.length, 0);
  assert.ok(ranked.every((result) => [
    result.recipe.name,
    ...result.recipe.tags,
    ...result.recipe.ingredients.map((ingredient) => ingredient.name),
  ].some((value) => value.includes("鸡"))));
});

test("ingredient input splits Chinese separators and removes alias duplicates", () => {
  assert.deepEqual(
    parseIngredientInput(" 鸡腿，豆腐、干红辣椒；鸡腿肉 "),
    ["鸡腿肉", "豆腐", "干辣椒"],
  );
});

test("canonical matching rejects arbitrary fragments and accepts explicit aliases", () => {
  assert.equal(hasIngredient(["肉", "毛血"], "五花肉"), false);
  assert.equal(hasIngredient(["带皮五花肉"], "五花肉"), true);
  assert.equal(hasIngredient(["干红辣椒"], "干辣椒"), true);
  assert.equal(hasIngredient(["鱼片"], "黑鱼片"), true);
});

test("ingredient recommendations exclude zero matches and rank main-ingredient coverage first", () => {
  assert.deepEqual(findRelevantRecipes(recipes, ["肉", "毛血"]), []);

  const ranked = findRelevantRecipes(recipes, ["豆腐", "牛肉末"]);
  assert.equal(ranked[0]?.recipe.name, "麻婆豆腐");
  assert.equal(ranked[0]?.canCook, true);
  assert.equal(ranked[0]?.matchRatio, 1);
});

test("generic fish input recalls fish recipes without claiming a different cut is available", () => {
  const ranked = findRelevantRecipes(recipes, ["鱼肉"]);
  const names = ranked.map((result) => result.recipe.name);
  const fishHead = ranked.find((result) => result.recipe.name === "剁椒鱼头");

  assert.equal(ranked[0]?.recipe.name, "剁椒鱼头");
  assert.ok(names.includes("酸菜鱼"));
  assert.ok(names.includes("来凤鱼"));
  assert.ok(names.includes("赣南小炒鱼"));
  assert.ok(!names.includes("鱼香肉丝"));
  assert.ok(fishHead);
  assert.equal(fishHead.canCook, false);
  assert.deepEqual(fishHead.matched.map((ingredient) => ingredient.name), []);
  assert.deepEqual(fishHead.related.map((ingredient) => ingredient.name), ["花鲢鱼头"]);
  assert.deepEqual(fishHead.missing.map((ingredient) => ingredient.name), ["花鲢鱼头"]);
  assert.equal(hasIngredient(["鱼肉"], "花鲢鱼头"), false);
  assert.ok(buildShoppingList(fishHead.recipe, ["鱼肉"]).some((item) => item.name === "花鲢鱼头"));
});

test("ingredient families recall similar catalog cases while rejecting misleading text fragments", () => {
  const cases = [
    { input: "鸡肉", includes: ["辣子鸡", "宫保鸡丁", "东安鸡"], excludes: ["鱼香肉丝"] },
    { input: "猪肉", includes: ["回锅肉", "水煮肉片", "瓦罐肉饼汤"], excludes: ["小炒黄牛肉"] },
    { input: "牛肉", includes: ["麻婆豆腐", "小炒黄牛肉"], excludes: ["辣椒炒肉"] },
    { input: "鸭肉", includes: ["永州血鸭", "莲花血鸭", "南昌啤酒鸭"], excludes: ["毛血旺"] },
    { input: "豆制品", includes: ["麻婆豆腐", "重庆豆花饭"], excludes: ["干煸四季豆"] },
    { input: "虾肉", includes: ["口味虾"], excludes: ["剁椒鱼头"] },
    { input: "鸡杂", includes: ["黔江鸡杂"], excludes: ["辣子鸡"] },
    { input: "辣椒", includes: ["辣椒炒肉", "永州血鸭"], excludes: ["麻婆豆腐", "剁椒鱼头"] },
    { input: "叶菜", includes: ["重庆小面", "小炒黄牛肉"], excludes: ["麻婆豆腐"] },
    { input: "菌菇", includes: ["鱼香肉丝"], excludes: ["酸菜鱼"] },
    { input: "米粉", includes: ["南昌拌粉", "赣味粉蒸肉"], excludes: ["重庆小面"] },
    { input: "腊味", includes: ["腊味合蒸", "藜蒿炒腊肉"], excludes: ["咸烧白"] },
    { input: "蛋类", includes: ["外婆菜炒蛋", "瓦罐肉饼汤"], excludes: ["毛血旺"] },
  ] as const;

  for (const { input, includes, excludes } of cases) {
    const names = findRelevantRecipes(recipes, [input]).map((result) => result.recipe.name);
    for (const name of includes) assert.ok(names.includes(name), `${input} 应召回 ${name}`);
    for (const name of excludes) assert.ok(!names.includes(name), `${input} 不应召回 ${name}`);
  }
});

test("semantic recipe search prioritizes exact ingredients then related ingredient families", () => {
  const fishResults = rankRecipes(recipes, [], "鱼肉");
  const fishNames = fishResults.map((result) => result.recipe.name);

  assert.equal(fishResults[0]?.recipe.name, "剁椒鱼头");
  assert.ok(fishNames.includes("酸菜鱼"));
  assert.ok(!fishNames.includes("鱼香肉丝"));
  assert.ok(!rankRecipes(recipes, [], "鱼").some((result) => result.recipe.name === "鱼香肉丝"));
  assert.ok(!rankRecipes(recipes, [], "鸡肉").some((result) => result.recipe.name === "黔江鸡杂"));
  assert.ok(!rankRecipes(recipes, [], "鸭肉").some((result) => result.recipe.name === "毛血旺"));

  const exactCutResults = rankRecipes(recipes, [], "黑鱼片");
  assert.equal(exactCutResults[0]?.recipe.name, "酸菜鱼");

  const compoundResults = rankRecipes(recipes, [], "鱼肉 蒸菜");
  assert.deepEqual(compoundResults.map((result) => result.recipe.name), ["剁椒鱼头"]);
});

test("recipe search includes ingredient names that are absent from titles and tags", () => {
  const ranked = rankRecipes(recipes, [], "毛肚");

  assert.deepEqual(ranked.map((result) => result.recipe.name), ["毛血旺"]);
});

test("shopping list only adds missing ingredients and merges repeated items", () => {
  const recipe = recipes.find((item) => item.name === "麻婆豆腐");
  assert.ok(recipe);

  const list = buildShoppingList(recipe, ["嫩豆腐", "蒜", "葱"], [
    { name: "豆瓣酱", amount: 10, unit: "克", checked: true, recipeIds: ["placeholder"] },
  ]);

  assert.ok(!list.some((item) => item.name === "豆腐"));
  const doubanjiang = list.find((item) => item.name === "豆瓣酱");
  assert.ok(doubanjiang);
  assert.equal(doubanjiang.amount, 30);
  assert.equal(doubanjiang.checked, true);
  assert.ok(doubanjiang.recipeIds.includes(recipe.id));
});

test("adding the same recipe twice does not duplicate shopping quantities", () => {
  const recipe = recipes.find((item) => item.name === "麻婆豆腐");
  assert.ok(recipe);

  const once = buildShoppingList(recipe, ["豆腐", "牛肉末"]);
  const twice = buildShoppingList(recipe, ["豆腐", "牛肉末"], once);

  assert.equal(twice, once, "an idempotent add should preserve the existing list reference");
  assert.deepEqual(twice, once);
});

test("flavor adaptation scales servings and makes concrete spice, salt and oil changes", () => {
  const recipe = recipes.find((item) => item.name === "辣子鸡");
  assert.ok(recipe);

  const adapted = adaptRecipe(recipe, {
    servings: 4,
    spice: 1,
    numb: 1,
    salt: 1,
    oil: 1,
  });

  const chicken = adapted.ingredients.find((item) => item.name === "鸡腿肉");
  const chili = adapted.ingredients.find((item) => item.name === "干辣椒");
  const oil = adapted.ingredients.find((item) => item.name === "食用油");

  assert.equal(chicken?.amount, 800);
  assert.equal(chili?.amount, 30);
  assert.equal(oil?.amount, 45);
  assert.ok(adapted.notes.some((note) => note.includes("少辣")));
  assert.ok(adapted.steps.every((step) => step.instruction.length > 12));
  assert.equal(recipe.ingredients.find((item) => item.name === "鸡腿肉")?.amount, 400);
});

test("stored local state is deduplicated, clamped and safe against corrupt data", () => {
  assert.deepEqual(normalizeStoredState("not-json").pantry, []);

  const state = normalizeStoredState(JSON.stringify({
    pantry: ["鸡蛋", "鸡蛋", "  豆腐  ", 42],
    shopping: [{ name: "辣椒", amount: -4, unit: "克", checked: "yes", recipeIds: [] }],
    preferences: { servings: 99, spice: -1, numb: 2, salt: 5, oil: 0 },
  }));

  assert.deepEqual(state.pantry, ["鸡蛋", "豆腐"]);
  assert.deepEqual(state.preferences, { servings: 8, spice: 0, numb: 2, salt: 3, oil: 0 });
  assert.deepEqual(state.shopping[0], {
    name: "辣椒",
    amount: 0,
    unit: "克",
    checked: false,
    recipeIds: [],
  });
});
