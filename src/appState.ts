import {
  buildShoppingList,
  defaultPreferences,
  normalizeIngredient,
  normalizeStoredState,
  parseIngredientInput,
  type FlavorProfile,
  type LocalState,
} from "./domain.ts";
import type { Recipe } from "./recipes.ts";

export type AppStateAction =
  | { type: "pantry/add"; input: string }
  | { type: "pantry/remove"; ingredient: string }
  | { type: "shopping/add-recipe"; recipe: Recipe }
  | { type: "shopping/toggle"; name: string }
  | { type: "shopping/clear-purchased" }
  | { type: "preference/update"; key: keyof FlavorProfile; value: number }
  | { type: "favorite/toggle"; recipeId: string };

export function createInitialState(serialized?: string | null): LocalState {
  if (serialized) return normalizeStoredState(serialized);

  return {
    pantry: [],
    shopping: [],
    preferences: { ...defaultPreferences },
    favoriteIds: [],
  };
}

const preferenceLimit = (key: keyof FlavorProfile) => key === "servings" ? [1, 8] as const : [0, 3] as const;

export function appStateReducer(state: LocalState, action: AppStateAction): LocalState {
  switch (action.type) {
    case "pantry/add": {
      const known = new Set(state.pantry.map(normalizeIngredient));
      const additions = parseIngredientInput(action.input).filter((ingredient) => {
        const canonical = normalizeIngredient(ingredient);
        if (known.has(canonical)) return false;
        known.add(canonical);
        return true;
      });

      return additions.length ? { ...state, pantry: [...state.pantry, ...additions] } : state;
    }

    case "pantry/remove": {
      const target = normalizeIngredient(action.ingredient);
      const pantry = state.pantry.filter((ingredient) => normalizeIngredient(ingredient) !== target);
      return pantry.length === state.pantry.length ? state : { ...state, pantry };
    }

    case "shopping/add-recipe": {
      const shopping = buildShoppingList(action.recipe, state.pantry, state.shopping);
      return shopping === state.shopping ? state : { ...state, shopping };
    }

    case "shopping/toggle": {
      let changed = false;
      const shopping = state.shopping.map((item) => {
        if (item.name !== action.name) return item;
        changed = true;
        return { ...item, checked: !item.checked };
      });
      return changed ? { ...state, shopping } : state;
    }

    case "shopping/clear-purchased": {
      const shopping = state.shopping.filter((item) => !item.checked);
      return shopping.length === state.shopping.length ? state : { ...state, shopping };
    }

    case "preference/update": {
      const [minimum, maximum] = preferenceLimit(action.key);
      const value = Math.min(maximum, Math.max(minimum, Math.round(action.value)));
      if (state.preferences[action.key] === value) return state;
      return { ...state, preferences: { ...state.preferences, [action.key]: value } };
    }

    case "favorite/toggle": {
      const favoriteIds = state.favoriteIds.includes(action.recipeId)
        ? state.favoriteIds.filter((id) => id !== action.recipeId)
        : [...state.favoriteIds, action.recipeId];
      return { ...state, favoriteIds };
    }
  }
}
