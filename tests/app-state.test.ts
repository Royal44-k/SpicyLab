import assert from "node:assert/strict";
import test from "node:test";

import { appStateReducer, createInitialState } from "../src/appState.ts";
import { recipes } from "../src/recipes.ts";

test("a new user starts empty and existing saved pantry is preserved", () => {
  assert.deepEqual(createInitialState(null).pantry, []);

  const saved = createInitialState(JSON.stringify({ pantry: ["豆腐"], shopping: [] }));
  assert.deepEqual(saved.pantry, ["豆腐"]);
});

test("repeated aliases are one atomic and canonical pantry update", () => {
  const initial = createInitialState(null);
  const once = appStateReducer(initial, { type: "pantry/add", input: "鸡腿" });
  const twice = appStateReducer(once, { type: "pantry/add", input: "鸡腿肉，鸡腿" });

  assert.deepEqual(twice.pantry, ["鸡腿肉"]);
  assert.equal(twice, once, "duplicate input should not trigger a new state object");
});

test("rapid reducer actions preserve unrelated state and remain reversible", () => {
  const mapo = recipes.find((recipe) => recipe.name === "麻婆豆腐");
  assert.ok(mapo);

  let state = createInitialState(null);
  state = appStateReducer(state, { type: "pantry/add", input: "嫩豆腐，蒜" });
  state = appStateReducer(state, { type: "shopping/add-recipe", recipe: mapo });
  state = appStateReducer(state, { type: "preference/update", key: "spice", value: 1 });
  state = appStateReducer(state, { type: "favorite/toggle", recipeId: mapo.id });
  state = appStateReducer(state, { type: "pantry/remove", ingredient: "豆腐" });

  assert.deepEqual(state.pantry, ["蒜"]);
  assert.equal(state.preferences.spice, 1);
  assert.deepEqual(state.favoriteIds, [mapo.id]);
  assert.ok(state.shopping.some((item) => item.name === "牛肉末"));
});
