export type PantryIndex = {
  exact: Set<string>;
  byFamily: Map<string, Set<string>>;
};

export type IngredientNameMatch = {
  relevant: boolean;
  satisfied: boolean;
  kind: "exact" | "covers" | "related" | "none";
  score: number;
  pantryItem?: string;
};

type IngredientFamily = {
  id: string;
  generic: readonly string[];
  members: readonly string[];
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
  鸡肉块: "鸡块",
  带皮五花肉: "五花肉",
  黑鱼片: "鱼片",
  鱼柳: "鱼片",
  鱼肉片: "鱼片",
  牛肉馅: "牛肉末",
  猪肉馅: "猪肉末",
  牛肉片: "牛肉",
  黄牛肉: "牛肉",
  猪肉片: "猪肉",
  鲜鱼: "鱼肉",
  鱼类: "鱼肉",
  鲜虾: "虾肉",
  虾类: "虾肉",
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

// Families drive recall, not ownership. A generic or different member can
// surface a recipe, but only an exact/equivalent item satisfies its shopping
// requirement. A specific pantry member may cover a generic recipe requirement.
const ingredientFamilies: readonly IngredientFamily[] = [
  {
    id: "fish",
    generic: ["鱼", "鱼肉", "水产鱼"],
    members: ["鱼头", "花鲢鱼头", "鱼片", "鱼块", "草鱼块", "草鱼", "黑鱼", "花鲢"],
  },
  {
    id: "chicken-meat",
    generic: ["鸡", "鸡肉", "鲜鸡", "整鸡"],
    members: ["鸡腿肉", "鸡胸肉", "鸡块", "带骨鸡块", "嫩母鸡"],
  },
  {
    id: "chicken-offal",
    generic: ["鸡", "鸡杂"],
    members: ["鸡胗", "鸡心"],
  },
  {
    id: "pork",
    generic: ["猪肉", "鲜猪肉"],
    members: ["五花肉", "猪里脊", "猪肉末", "湘西酸肉"],
  },
  {
    id: "beef",
    generic: ["牛肉", "鲜牛肉"],
    members: ["牛里脊", "牛肉末"],
  },
  {
    id: "duck",
    generic: ["鸭", "鸭肉", "鲜鸭", "整鸭"],
    members: ["嫩鸭"],
  },
  {
    id: "shrimp",
    generic: ["虾", "虾肉"],
    members: ["小龙虾"],
  },
  {
    id: "soy-products",
    generic: ["豆制品", "豆类制品"],
    members: ["豆腐", "豆花"],
  },
  {
    id: "chilli",
    generic: ["辣椒", "椒类"],
    members: [
      "青椒", "红椒", "青红椒", "螺丝椒", "余干辣椒", "小米椒", "青小米椒", "红小米椒",
      "干辣椒", "辣椒粉", "剁椒", "泡椒", "辣椒油",
    ],
  },
  {
    id: "leafy-vegetables",
    generic: ["青菜", "叶菜", "绿叶菜"],
    members: ["芹菜", "香菜", "紫苏", "藜蒿", "蒜苗"],
  },
  {
    id: "fungi",
    generic: ["菌菇", "菌类", "蘑菇"],
    members: ["木耳"],
  },
  {
    id: "rice-powder",
    generic: ["米粉", "粉类"],
    members: ["江西米粉", "蒸肉米粉"],
  },
  {
    id: "cured-meat",
    generic: ["腊味"],
    members: ["腊肉", "腊肠"],
  },
  {
    id: "eggs",
    generic: ["蛋", "蛋类", "禽蛋"],
    members: ["鸡蛋"],
  },
];

const familyIdsByTerm = new Map<string, Set<string>>();
const genericTermsByFamily = new Map<string, Set<string>>();

for (const family of ingredientFamilies) {
  const genericTerms = new Set(family.generic);
  genericTermsByFamily.set(family.id, genericTerms);

  for (const term of [...family.generic, ...family.members]) {
    const ids = familyIdsByTerm.get(term) ?? new Set<string>();
    ids.add(family.id);
    familyIdsByTerm.set(term, ids);
  }
}

export function canonicalIngredient(value: string): string {
  const compact = value.trim().replaceAll(/\s+/g, "");
  return aliases[compact] ?? compact;
}

export function ingredientFamilyIds(value: string): ReadonlySet<string> {
  return familyIdsByTerm.get(canonicalIngredient(value)) ?? new Set<string>();
}

export function createPantryIndex(items: string[]): PantryIndex {
  const exact = new Set(items.map(canonicalIngredient).filter(Boolean));
  const byFamily = new Map<string, Set<string>>();

  for (const item of exact) {
    for (const familyId of ingredientFamilyIds(item)) {
      const familyItems = byFamily.get(familyId) ?? new Set<string>();
      familyItems.add(item);
      byFamily.set(familyId, familyItems);
    }
  }

  return { exact, byFamily };
}

export function matchIngredient(index: PantryIndex, ingredientName: string): IngredientNameMatch {
  const canonical = canonicalIngredient(ingredientName);
  if (!canonical) return { relevant: false, satisfied: false, kind: "none", score: 0 };

  if (index.exact.has(canonical)) {
    return { relevant: true, satisfied: true, kind: "exact", score: 1, pantryItem: canonical };
  }

  let bestMatch: IngredientNameMatch | null = null;
  for (const familyId of ingredientFamilyIds(canonical)) {
    const pantryItems = index.byFamily.get(familyId);
    if (!pantryItems?.size) continue;

    const recipeIsGeneric = genericTermsByFamily.get(familyId)?.has(canonical) ?? false;
    for (const pantryItem of pantryItems) {
      const pantryIsGeneric = genericTermsByFamily.get(familyId)?.has(pantryItem) ?? false;

      if (recipeIsGeneric) {
        const candidate: IngredientNameMatch = {
          relevant: true,
          satisfied: true,
          kind: "covers",
          score: pantryIsGeneric ? 0.94 : 0.9,
          pantryItem,
        };
        if (!bestMatch || candidate.score > bestMatch.score) bestMatch = candidate;
        continue;
      }

      const candidate: IngredientNameMatch = {
        relevant: true,
        satisfied: false,
        kind: "related",
        score: pantryIsGeneric ? 0.58 : 0.42,
        pantryItem,
      };
      if (!bestMatch || candidate.score > bestMatch.score) bestMatch = candidate;
    }
  }

  return bestMatch ?? { relevant: false, satisfied: false, kind: "none", score: 0 };
}

export function hasIngredient(pantry: string[], ingredientName: string): boolean {
  return matchIngredient(createPantryIndex(pantry), ingredientName).satisfied;
}
