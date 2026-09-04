import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptRecipe,
  buildShoppingList,
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
    ["鸡腿", "豆腐", "干红辣椒"],
  );
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
