export type PantryIndex = {
  exact: Set<string>;
};

export type IngredientNameMatch = {
  matched: boolean;
  kind: "exact" | "compatible" | "none";
  score: number;
  pantryItem?: string;
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
  带皮五花肉: "五花肉",
  黑鱼片: "鱼片",
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

// Compatibility is deliberately directional. A generic pantry entry can
// suggest a known cut, but one specific cut never silently becomes another.
const compatiblePantryItems: Record<string, ReadonlySet<string>> = {
  鸡肉: new Set(["鸡腿肉", "鸡胸肉", "带骨鸡块", "鸡块", "嫩母鸡"]),
  猪肉: new Set(["五花肉", "猪里脊", "猪肉末"]),
  牛肉: new Set(["牛里脊"]),
  鸭肉: new Set(["嫩鸭"]),
  鱼: new Set(["鱼片", "草鱼块", "花鲢鱼头"]),
  辣椒: new Set(["青椒", "红椒", "青红椒", "螺丝椒", "余干辣椒", "小米椒", "青小米椒", "红小米椒"]),
};

export function canonicalIngredient(value: string): string {
  const compact = value.trim().replaceAll(/\s+/g, "");
  return aliases[compact] ?? compact;
}

export function createPantryIndex(items: string[]): PantryIndex {
  return {
    exact: new Set(items.map(canonicalIngredient).filter(Boolean)),
  };
}

export function matchIngredient(index: PantryIndex, ingredientName: string): IngredientNameMatch {
  const canonical = canonicalIngredient(ingredientName);
  if (!canonical) return { matched: false, kind: "none", score: 0 };

  if (index.exact.has(canonical)) {
    return { matched: true, kind: "exact", score: 1, pantryItem: canonical };
  }

  for (const pantryItem of index.exact) {
    if (compatiblePantryItems[pantryItem]?.has(canonical)) {
      return { matched: true, kind: "compatible", score: 0.72, pantryItem };
    }
  }

  return { matched: false, kind: "none", score: 0 };
}

export function hasIngredient(pantry: string[], ingredientName: string): boolean {
  return matchIngredient(createPantryIndex(pantry), ingredientName).matched;
}
