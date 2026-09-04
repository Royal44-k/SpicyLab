import type { Ingredient, Recipe } from "./recipes.ts";

export type FlavorProfile = {
  servings: number;
  spice: number;
  numb: number;
  salt: number;
  oil: number;
};

export type ShoppingItem = {
  name: string;
  amount: number;
  unit: string;
  checked: boolean;
  recipeIds: string[];
};

export type LocalState = {
  pantry: string[];
  shopping: ShoppingItem[];
  preferences: FlavorProfile;
  favoriteIds: string[];
};

export type RankedRecipe = {
  recipe: Recipe;
  matched: Ingredient[];
  missing: Ingredient[];
  matchRatio: number;
  canCook: boolean;
};

const aliases: Record<string, string> = {
  嫩豆腐: "豆腐",
  老豆腐: "豆腐",
  内酯豆腐: "豆腐",
  干红辣椒: "干辣椒",
  辣椒干: "干辣椒",
  红干椒: "干辣椒",
  鸡腿: "鸡腿肉",
  去骨鸡腿: "鸡腿肉",
  牛肉馅: "牛肉末",
  猪肉馅: "猪肉末",
  青花椒: "花椒",
  红花椒: "花椒",
  蒜头: "蒜",
  大蒜: "蒜",
  生姜: "姜",
  小葱: "葱",
  香葱: "葱",
  香芹: "芹菜",
  绿豆芽: "豆芽",
  黄豆芽: "豆芽",
  青辣椒: "青椒",
  红辣椒: "红椒",
  花生: "花生米",
  鸡蛋液: "鸡蛋",
};

export const defaultPreferences: FlavorProfile = {
  servings: 2,
  spice: 2,
  numb: 2,
  salt: 2,
  oil: 2,
};

export const normalizeIngredient = (value: string) => {
  const compact = value.trim().replaceAll(/\s+/g, "");
  return aliases[compact] ?? compact;
};

export function parseIngredientInput(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(/[、，,；;\n]+/u)
    .map((item) => item.trim())
    .filter((item) => {
      const canonical = normalizeIngredient(item);
      if (!canonical || seen.has(canonical)) return false;
      seen.add(canonical);
      return true;
    });
}

const ingredientMatches = (available: Set<string>, ingredient: Ingredient) => {
  const canonical = normalizeIngredient(ingredient.name);
  if (available.has(canonical)) return true;

  return [...available].some((item) => {
    if (item.length < 2 || canonical.length < 2) return false;
    return item.includes(canonical) || canonical.includes(item);
  });
};

export function rankRecipes(catalog: Recipe[], pantry: string[], query = ""): RankedRecipe[] {
  const available = new Set(pantry.map(normalizeIngredient).filter(Boolean));
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");

  return catalog
    .filter((item) => {
      if (!normalizedQuery) return true;
      const haystack = [
        item.name,
        item.cuisine,
        item.subtitle,
        ...item.tags,
        ...item.ingredients.map((ingredient) => ingredient.name),
      ].join(" ").toLocaleLowerCase("zh-CN");
      return haystack.includes(normalizedQuery);
    })
    .map((item) => {
      // Pantry matching answers “can I start this dish?” from main ingredients and
      // vegetables. Aromatics and seasonings still appear in the detailed shopping list.
      const required = item.ingredients.filter((ingredient) =>
        ingredient.essential !== false && ingredient.category !== "香料" && ingredient.category !== "调味",
      );
      const matched = required.filter((ingredient) => ingredientMatches(available, ingredient));
      const missing = required.filter((ingredient) => !ingredientMatches(available, ingredient));
      const matchRatio = required.length === 0 ? 1 : matched.length / required.length;
      return { recipe: item, matched, missing, matchRatio, canCook: missing.length === 0 };
    })
    .sort((a, b) => {
      if (a.canCook !== b.canCook) return Number(b.canCook) - Number(a.canCook);
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
      if (a.matchRatio !== b.matchRatio) return b.matchRatio - a.matchRatio;
      return a.recipe.time - b.recipe.time;
    });
}

export function buildShoppingList(
  recipe: Recipe,
  pantry: string[],
  existing: ShoppingItem[] = [],
): ShoppingItem[] {
  const available = new Set(pantry.map(normalizeIngredient).filter(Boolean));
  const result = existing.map((item) => ({ ...item, recipeIds: [...item.recipeIds] }));

  for (const ingredient of recipe.ingredients) {
    if (ingredientMatches(available, ingredient)) continue;
    const current = result.find(
      (item) => normalizeIngredient(item.name) === normalizeIngredient(ingredient.name) && item.unit === ingredient.unit,
    );
    if (current) {
      current.amount = roundAmount(current.amount + ingredient.amount);
      if (!current.recipeIds.includes(recipe.id)) current.recipeIds.push(recipe.id);
    } else {
      result.push({
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        checked: false,
        recipeIds: [recipe.id],
      });
    }
  }

  return result;
}

const roundAmount = (amount: number) => Math.round(amount * 10) / 10;

const scaleForLevel = (level: number, kind: "spice" | "numb" | "salt" | "oil") => {
  const normalized = clamp(level, 0, 3);
  const maps = {
    spice: [0, 0.25, 1, 1.35],
    numb: [0, 0.5, 1, 1.3],
    salt: [0.45, 0.72, 1, 1.15],
    oil: [0.25, 0.375, 1, 1.15],
  } as const;
  return maps[kind][normalized];
};

const ingredientScale = (ingredient: Ingredient, profile: FlavorProfile) => {
  const name = ingredient.name;
  let scale = profile.servings / 2;
  if (/辣椒|辣椒油|剁椒|泡椒|豆瓣酱|火锅底料/.test(name)) scale *= scaleForLevel(profile.spice, "spice");
  if (/花椒/.test(name)) scale *= scaleForLevel(profile.numb, "numb");
  if (/盐|生抽|老抽|豉油|芽菜|榨菜|豆豉|腐乳汁/.test(name)) scale *= scaleForLevel(profile.salt, "salt");
  if (/食用油|红油/.test(name)) scale *= scaleForLevel(profile.oil, "oil");
  return scale;
};

export function adaptRecipe(recipe: Recipe, profile: FlavorProfile): Recipe & { notes: string[] } {
  const safeProfile: FlavorProfile = {
    servings: clamp(profile.servings, 1, 8),
    spice: clamp(profile.spice, 0, 3),
    numb: clamp(profile.numb, 0, 3),
    salt: clamp(profile.salt, 0, 3),
    oil: clamp(profile.oil, 0, 3),
  };

  const notes = [
    ["不辣：去掉鲜辣椒和辣椒籽，以彩椒补体积", "少辣：辣椒减至标准量的四分之一", "标准辣度：保留菜品本味", "加辣：在标准量上增加约三成"][safeProfile.spice],
    ["不麻：省去花椒", "微麻：花椒减半", "标准麻度：花椒按原配方", "加麻：花椒增加约三成"][safeProfile.numb],
    ["控盐：咸味调料减量，靠香醋与香料提味", "少盐：咸味调料约七成量", "标准咸度：按原配方", "偏重口：咸味调料最多增加一成半"][safeProfile.salt],
    ["极少油：选不粘锅并分次少量补油", "少油：食用油降至约四成", "标准用油：按原配方", "丰润口感：用油最多增加一成半"][safeProfile.oil],
  ];

  return {
    ...recipe,
    servings: safeProfile.servings,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      amount: roundAmount(ingredient.amount * ingredientScale(ingredient, safeProfile)),
    })),
    steps: recipe.steps.map((step) => ({ ...step })),
    notes,
  };
}

const clamp = (value: unknown, minimum: number, maximum: number) => {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : minimum;
  return Math.min(maximum, Math.max(minimum, number));
};

const emptyState = (): LocalState => ({
  pantry: [],
  shopping: [],
  preferences: { ...defaultPreferences },
  favoriteIds: [],
});

export function normalizeStoredState(serialized: string | null | undefined): LocalState {
  if (!serialized) return emptyState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return emptyState();
  }
  if (!parsed || typeof parsed !== "object") return emptyState();
  const source = parsed as Record<string, unknown>;
  const pantry = Array.isArray(source.pantry)
    ? [...new Set(source.pantry.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
    : [];
  const shopping = Array.isArray(source.shopping)
    ? source.shopping.flatMap((raw): ShoppingItem[] => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as Record<string, unknown>;
        if (typeof item.name !== "string" || typeof item.unit !== "string") return [];
        return [{
          name: item.name.trim(),
          amount: typeof item.amount === "number" && Number.isFinite(item.amount) ? Math.max(0, item.amount) : 0,
          unit: item.unit.trim(),
          checked: typeof item.checked === "boolean" ? item.checked : false,
          recipeIds: Array.isArray(item.recipeIds)
            ? item.recipeIds.filter((id): id is string => typeof id === "string")
            : [],
        }];
      })
    : [];
  const rawPreferences = source.preferences && typeof source.preferences === "object"
    ? source.preferences as Record<string, unknown>
    : {};
  const favoriteIds = Array.isArray(source.favoriteIds)
    ? source.favoriteIds.filter((id): id is string => typeof id === "string")
    : [];

  return {
    pantry,
    shopping,
    preferences: {
      servings: clamp(rawPreferences.servings ?? defaultPreferences.servings, 1, 8),
      spice: clamp(rawPreferences.spice ?? defaultPreferences.spice, 0, 3),
      numb: clamp(rawPreferences.numb ?? defaultPreferences.numb, 0, 3),
      salt: clamp(rawPreferences.salt ?? defaultPreferences.salt, 0, 3),
      oil: clamp(rawPreferences.oil ?? defaultPreferences.oil, 0, 3),
    },
    favoriteIds,
  };
}
