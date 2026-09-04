import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  Cross2Icon,
  HeartIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MixerVerticalIcon,
  PlusIcon,
  ReaderIcon,
  SewingPinIcon,
  StarIcon,
} from "@radix-ui/react-icons";
import {
  createContext,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Carousel,
  FlowStack,
  KeyboardInput,
  MobileScroll,
  useFlow,
  useKeyboard,
  type FlowControls,
  type FlowScreen,
} from "./mobile";
import { appStateReducer, createInitialState } from "./appState";
import {
  adaptRecipe,
  findRelevantRecipes,
  hasIngredient,
  normalizeIngredient,
  rankRecipes,
  type FlavorProfile,
  type LocalState,
  type ShoppingItem,
} from "./domain";
import { cuisineMeta, recipes, type Cuisine, type Recipe } from "./recipes";

const STORAGE_KEY = "zaobian-local-state-v1";
const pantrySuggestions = ["鸡腿肉", "豆腐", "鸡蛋", "五花肉", "青椒", "干辣椒", "花椒", "木耳", "鱼片", "牛肉"];
const flavorLabels = ["不加", "少量", "标准", "够味"];

type AppContextValue = LocalState & {
  addPantry: (ingredient: string) => void;
  removePantry: (ingredient: string) => void;
  addRecipeToShopping: (recipe: Recipe) => void;
  toggleShopping: (name: string) => void;
  clearPurchased: () => void;
  updatePreference: (key: keyof FlavorProfile, value: number) => void;
  toggleFavorite: (recipeId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppStateProvider");
  return context;
}

function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    appStateReducer,
    typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY),
    createInitialState,
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);

  const addPantry = useCallback((input: string) => dispatch({ type: "pantry/add", input }), []);
  const removePantry = useCallback((ingredient: string) => dispatch({ type: "pantry/remove", ingredient }), []);
  const addRecipeToShopping = useCallback((recipe: Recipe) => dispatch({ type: "shopping/add-recipe", recipe }), []);
  const toggleShopping = useCallback((name: string) => dispatch({ type: "shopping/toggle", name }), []);
  const clearPurchased = useCallback(() => dispatch({ type: "shopping/clear-purchased" }), []);
  const updatePreference = useCallback(
    (key: keyof FlavorProfile, preference: number) => dispatch({ type: "preference/update", key, value: preference }),
    [],
  );
  const toggleFavorite = useCallback((recipeId: string) => dispatch({ type: "favorite/toggle", recipeId }), []);

  const value = useMemo<AppContextValue>(() => ({
    ...state,
    addPantry,
    removePantry,
    addRecipeToShopping,
    toggleShopping,
    clearPurchased,
    updatePreference,
    toggleFavorite,
  }), [addPantry, addRecipeToShopping, clearPurchased, removePantry, state, toggleFavorite, toggleShopping, updatePreference]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function tabScreen(id: "home" | "recipes" | "shopping" | "taste"): FlowScreen {
  const Content = { home: HomeScreen, recipes: CatalogScreen, shopping: ShoppingScreen, taste: TasteScreen }[id];
  return {
    id,
    footerHeight: 70,
    footer: (flow) => <BottomNav flow={flow} active={id} />,
    render: () => <Content />,
  };
}

function detailScreen(recipeId: string): FlowScreen {
  const dish = recipes.find((item) => item.id === recipeId) ?? recipes[0];
  return {
    id: `recipe-${recipeId}`,
    headerHeight: 58,
    header: (flow) => <DetailHeader flow={flow} dish={dish} />,
    render: () => <RecipeDetail dish={dish} />,
  };
}

function BottomNav({ flow, active }: { flow: FlowControls; active: string }) {
  const navigationRef = useRef<HTMLElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const [scrollHidden, setScrollHidden] = useState(false);
  const tabs = [
    { id: "home", label: "找菜", icon: HomeIcon },
    { id: "recipes", label: "菜谱", icon: ReaderIcon },
    { id: "shopping", label: "采购", icon: SewingPinIcon },
    { id: "taste", label: "口味", icon: MixerVerticalIcon },
  ] as const;

  useEffect(() => {
    const navigation = navigationRef.current;
    const currentScreens = navigation
      ?.closest(".flow-stack")
      ?.querySelectorAll<HTMLElement>('.flow-screen[data-flow-current="true"] .mobile-scroll');
    const scroll = currentScreens?.item(Math.max(0, currentScreens.length - 1));

    if (!scroll) return;

    const markScrollActivity = () => {
      setScrollHidden(true);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => {
        setScrollHidden(false);
        revealTimerRef.current = null;
      }, 220);
    };

    scroll.addEventListener("scroll", markScrollActivity, { passive: true });

    return () => {
      scroll.removeEventListener("scroll", markScrollActivity);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    };
  }, [active]);

  return (
    <nav
      ref={navigationRef}
      className="bottom-nav"
      aria-label="主要导航"
      aria-hidden={scrollHidden ? "true" : undefined}
      data-scroll-hidden={scrollHidden ? "true" : "false"}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            type="button"
            className="nav-item"
            data-active={active === tab.id ? "true" : "false"}
            aria-current={active === tab.id ? "page" : undefined}
            onClick={() => active !== tab.id && flow.replace(tabScreen(tab.id))}
            key={tab.id}
          >
            <Icon width={20} height={20} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DetailHeader({ flow, dish }: { flow: FlowControls; dish: Recipe }) {
  const { favoriteIds, toggleFavorite } = useApp();
  const favorite = favoriteIds.includes(dish.id);
  return (
    <div className="detail-header">
      <button type="button" className="icon-button" aria-label="返回" onClick={flow.pop}>
        <ArrowLeftIcon width={20} height={20} />
      </button>
      <strong>{dish.name}</strong>
      <button
        type="button"
        className="icon-button favorite-button"
        data-favorite={favorite ? "true" : "false"}
        aria-label={favorite ? "取消收藏" : "收藏菜谱"}
        aria-pressed={favorite}
        onClick={() => toggleFavorite(dish.id)}
      >
        <HeartIcon width={20} height={20} />
      </button>
    </div>
  );
}

type IngredientComposerProps = {
  compact?: boolean;
  draft?: string;
  onDraftChange?: (value: string) => void;
  onCommit?: () => void;
};

function IngredientComposer({ compact = false, draft = "", onDraftChange, onCommit }: IngredientComposerProps) {
  const { pantry, removePantry } = useApp();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onCommit?.();
  };

  return (
    <div className={compact ? "ingredient-composer compact" : "ingredient-composer"}>
      {!compact ? (
        <form className="ingredient-search" onSubmit={submit}>
          <MagnifyingGlassIcon width={20} height={20} aria-hidden="true" />
          <KeyboardInput
            aria-label="输入家里现有的食材"
            placeholder="输入食材，如：鸡腿、豆腐"
            value={draft}
            onChange={(event) => onDraftChange?.(event.target.value)}
            autoComplete="off"
            inputMode="text"
            enterKeyHint="done"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
          />
          <button type="submit" className="add-ingredient" aria-label="添加食材" disabled={!draft.trim()}>
            <PlusIcon width={20} height={20} />
          </button>
        </form>
      ) : null}
      {pantry.length > 0 ? (
        <div className="pantry-chips" aria-label="已有食材">
          {pantry.map((ingredient) => (
            <span className="pantry-chip" key={ingredient}>
              {ingredient}
              <button type="button" aria-label={`移除${ingredient}`} onClick={() => removePantry(ingredient)}>
                <Cross2Icon width={13} height={13} />
              </button>
            </span>
          ))}
        </div>
      ) : <p className="empty-inline">还没有食材，先加两三样试试。</p>}
    </div>
  );
}

function HomeScreen() {
  const { pantry, addPantry } = useApp();
  const flow = useFlow();
  const { hide: hideKeyboard } = useKeyboard();
  const matchSectionRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(pantry.length > 0);
  const ranked = findRelevantRecipes(recipes, pantry);
  const cookable = ranked.filter((item) => item.canCook).length;
  const nearMatches = ranked.filter((item) => item.missing.length > 0 && item.missing.length <= 2).length;
  const featured = ranked[0];

  const commitDraft = useCallback(() => {
    const input = draft.trim();
    if (input) {
      addPantry(input);
      setDraft("");
    }
    hideKeyboard();
    setRevealed(true);
  }, [addPantry, draft, hideKeyboard]);

  const revealMatches = () => {
    commitDraft();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => matchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  };

  return (
    <MobileScroll className="app-screen dark-screen home-screen">
      <main className="home-content with-tab-footer">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="brand-line"><span>灶边</span><small>川 · 渝 · 湘 · 赣</small></div>
          <div className="hero-copy">
            <p className="eyebrow">按你家的存货，今天就开火</p>
            <h1 id="home-title">家里有什么？</h1>
            <p>告诉我现成食材，先找能做的；缺一两样，也给你列好采购单。</p>
          </div>
          <IngredientComposer
            draft={draft}
            onDraftChange={setDraft}
            onCommit={commitDraft}
          />
          <button type="button" className="primary-cta" onClick={revealMatches}>
            <StarIcon width={18} height={18} />
            看看能做什么
            <ChevronRightIcon width={20} height={20} />
          </button>
        </section>

        {revealed ? (
          <section ref={matchSectionRef} className="match-section" data-match-section aria-label="匹配结果" aria-live="polite">
            {featured ? (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow red">按现有食材匹配</p>
                    <h2>{cookable > 0 ? `能做 ${cookable} 道菜` : "先从最接近的做起"}</h2>
                  </div>
                  <span>{nearMatches} 道只差 1–2 样</span>
                </div>
                <FeaturedRecipe result={featured} onOpen={() => flow.push(detailScreen(featured.recipe.id))} />
                <div className="compact-results">
                  {ranked.filter((result) => result.recipe.id !== featured.recipe.id).slice(0, 3).map((result) => (
                    <RecipeRow key={result.recipe.id} result={result} onOpen={() => flow.push(detailScreen(result.recipe.id))} />
                  ))}
                </div>
              </>
            ) : pantry.length === 0 ? (
              <EmptyState title="先添加家里的食材" note="输入一种或多种现有食材，再查看真正匹配的菜谱。" />
            ) : (
              <EmptyState title="暂时没有精准匹配" note="试试更具体的名称，例如“五花肉”“鱼片”或“青椒”。" />
            )}
          </section>
        ) : null}
      </main>
    </MobileScroll>
  );
}

function QuickIngredient({ name }: { name: string }) {
  const { pantry, addPantry } = useApp();
  const active = pantry.some((item) => normalizeIngredient(item) === normalizeIngredient(name));
  return (
    <button type="button" className="quick-chip" data-active={active ? "true" : "false"} onClick={() => addPantry(name)}>
      {active ? <CheckIcon width={14} height={14} /> : <PlusIcon width={14} height={14} />}
      {name}
    </button>
  );
}

function FeaturedRecipe({ result, onOpen }: { result: ReturnType<typeof rankRecipes>[number]; onOpen: () => void }) {
  const match = Math.round(result.matchRatio * 100);
  return (
    <button type="button" className="featured-recipe" onClick={onOpen} aria-label={`查看${result.recipe.name}菜谱`}>
      <img src={result.recipe.image} alt={`${result.recipe.name}成菜图`} draggable={false} />
      <span className="featured-shade" aria-hidden="true" />
      <span className="match-badge">{result.canCook ? "现有食材可做" : `匹配 ${match}%`}</span>
      <span className="featured-copy">
        <small>{result.recipe.cuisine} · {result.recipe.time} 分钟 · 辣度 {result.recipe.heat}/3</small>
        <strong>{result.recipe.name}</strong>
        <span>{result.missing.length === 0 ? result.recipe.subtitle : `还缺 ${result.missing.slice(0, 2).map((item) => item.name).join("、")}${result.missing.length > 2 ? " 等" : ""}`}</span>
      </span>
      <ChevronRightIcon className="featured-arrow" width={22} height={22} />
    </button>
  );
}

function RecipeRow({ result, onOpen }: { result: ReturnType<typeof rankRecipes>[number]; onOpen: () => void }) {
  const match = Math.round(result.matchRatio * 100);
  return (
    <button type="button" className="recipe-row" onClick={onOpen}>
      <span className="cuisine-seal">{cuisineMeta[result.recipe.cuisine].short}</span>
      <span className="recipe-row-copy">
        <strong>{result.recipe.name}</strong>
        <small>{result.recipe.subtitle}</small>
        <span className="match-track" aria-label={`食材匹配度${match}%`}>
          <i style={{ "--match": `${match}%` } as CSSProperties} />
        </span>
      </span>
      <span className="recipe-row-meta">{result.canCook ? "可做" : `缺 ${result.missing.length}`}</span>
      <ChevronRightIcon width={18} height={18} />
    </button>
  );
}

function CatalogScreen() {
  const { pantry } = useApp();
  const flow = useFlow();
  const keyboard = useKeyboard();
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<Cuisine | "全部">("全部");
  const ranked = rankRecipes(recipes, pantry, query).filter((item) => cuisine === "全部" || item.recipe.cuisine === cuisine);

  return (
    <MobileScroll className="app-screen paper-screen">
      <main className="catalog-content with-tab-footer">
        <header className="screen-title">
          <p className="eyebrow red">36 道招牌家常菜</p>
          <h1>想学哪道菜？</h1>
          <p>按菜名、食材或地方风味查找，缺的材料直接加入采购单。</p>
        </header>
        <div className="light-search">
          <MagnifyingGlassIcon width={20} height={20} />
          <KeyboardInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索菜名或食材"
            aria-label="搜索菜谱"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              keyboard.hide();
            }}
          />
          {query ? <button type="button" aria-label="清除搜索" onClick={() => setQuery("")}><Cross2Icon /></button> : null}
        </div>
        <div className="filter-row" role="group" aria-label="地方菜系">
          {(["全部", "川菜", "重庆菜", "湘菜", "赣菜"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={cuisine === item} data-active={cuisine === item ? "true" : "false"} onClick={() => setCuisine(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="catalog-summary"><strong>{ranked.length}</strong> 道结果 · 按你家食材匹配排序</div>
        <section className="catalog-list" aria-live="polite">
          {ranked.map((result) => <RecipeRow key={result.recipe.id} result={result} onOpen={() => flow.push(detailScreen(result.recipe.id))} />)}
          {ranked.length === 0 ? <EmptyState title="没有找到这道菜" note="换个菜名、主料或菜系试试。" /> : null}
        </section>
      </main>
    </MobileScroll>
  );
}

function ShoppingScreen() {
  const { shopping, toggleShopping, clearPurchased } = useApp();
  const pending = shopping.filter((item) => !item.checked);
  const purchased = shopping.filter((item) => item.checked);
  return (
    <MobileScroll className="app-screen paper-screen">
      <main className="shopping-content with-tab-footer">
        <header className="screen-title split-title">
          <div>
            <p className="eyebrow red">按菜谱自动汇总</p>
            <h1>采购单</h1>
            <p>{pending.length} 项待买，勾选后仍会保留在本机。</p>
          </div>
          {purchased.length ? <button type="button" className="text-button" onClick={clearPurchased}>清除已买</button> : null}
        </header>
        {shopping.length ? (
          <>
            <ShoppingGroup title="待采购" items={pending} toggle={toggleShopping} />
            {purchased.length ? <ShoppingGroup title="已采购" items={purchased} toggle={toggleShopping} /> : null}
          </>
        ) : <EmptyState title="采购单还是空的" note="打开一道菜谱，点“加入缺料”就会自动合并到这里。" />}
        <aside className="local-note"><SewingPinIcon /> 数据只保存在当前浏览器，不需要登录。</aside>
      </main>
    </MobileScroll>
  );
}

function ShoppingGroup({ title, items, toggle }: { title: string; items: ShoppingItem[]; toggle: (name: string) => void }) {
  if (!items.length) return null;
  return (
    <section className="shopping-group">
      <h2>{title}<span>{items.length}</span></h2>
      <div className="shopping-list">
        {items.map((item) => (
          <button type="button" className="shopping-item" data-checked={item.checked ? "true" : "false"} onClick={() => toggle(item.name)} key={`${item.name}-${item.unit}`}>
            <span className="check-box">{item.checked ? <CheckIcon /> : null}</span>
            <span><strong>{item.name}</strong><small>来自 {item.recipeIds.length} 道菜</small></span>
            <b>{formatAmount(item.amount)} {item.unit}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function TasteScreen() {
  const { preferences, pantry, addPantry } = useApp();
  const keyboard = useKeyboard();
  const [ingredient, setIngredient] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ingredient.trim()) return;
    addPantry(ingredient);
    keyboard.hide();
    setIngredient("");
  };
  return (
    <MobileScroll className="app-screen paper-screen">
      <main className="taste-content with-tab-footer">
        <header className="screen-title">
          <p className="eyebrow red">一套偏好，整本菜谱跟着变</p>
          <h1>我家口味</h1>
          <p>调整辣、麻、咸、油与份量，打开任意菜谱就会显示你的专属用量。</p>
        </header>
        <section className="taste-panel">
          <ServingControl />
          <FlavorControl label="辣度" preferenceKey="spice" value={preferences.spice} />
          <FlavorControl label="麻度" preferenceKey="numb" value={preferences.numb} />
          <FlavorControl label="咸度" preferenceKey="salt" value={preferences.salt} />
          <FlavorControl label="用油" preferenceKey="oil" value={preferences.oil} />
        </section>
        <section className="pantry-manager">
          <div className="section-heading light"><div><p className="eyebrow red">我的食材</p><h2>常备清单</h2></div><span>{pantry.length} 种</span></div>
          <form className="light-search" onSubmit={submit}>
            <PlusIcon />
            <KeyboardInput
              value={ingredient}
              onChange={(event) => setIngredient(event.target.value)}
              placeholder="补充一种常备食材"
              aria-label="补充常备食材"
              inputMode="text"
              enterKeyHint="done"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
            />
            <button type="submit" disabled={!ingredient.trim()}>添加</button>
          </form>
          <IngredientComposer compact />
          <div className="quick-picks light-picks">
            <span>常用食材</span>
            <Carousel className="quick-carousel" aria-label="常用食材">
              {pantrySuggestions.map((item) => <QuickIngredient key={item} name={item} />)}
            </Carousel>
          </div>
        </section>
        <aside className="local-note"><CheckIcon /> 偏好已自动保存到本机。</aside>
      </main>
    </MobileScroll>
  );
}

function ServingControl() {
  const { preferences, updatePreference } = useApp();
  return (
    <div className="serving-control">
      <div><strong>做几人份</strong><small>所有原料同步换算</small></div>
      <div className="stepper">
        <button type="button" aria-label="减少份量" disabled={preferences.servings <= 1} onClick={() => updatePreference("servings", preferences.servings - 1)}><MinusIcon /></button>
        <b>{preferences.servings}<small>人</small></b>
        <button type="button" aria-label="增加份量" disabled={preferences.servings >= 8} onClick={() => updatePreference("servings", preferences.servings + 1)}><PlusIcon /></button>
      </div>
    </div>
  );
}

function FlavorControl({ label, preferenceKey, value }: { label: string; preferenceKey: "spice" | "numb" | "salt" | "oil"; value: number }) {
  const { updatePreference } = useApp();
  return (
    <div className="flavor-control">
      <strong>{label}</strong>
      <div className="segmented" role="group" aria-label={label}>
        {flavorLabels.map((item, index) => (
          <button key={item} type="button" aria-pressed={value === index} data-active={value === index ? "true" : "false"} onClick={() => updatePreference(preferenceKey, index)}>{item}</button>
        ))}
      </div>
    </div>
  );
}

function RecipeDetail({ dish }: { dish: Recipe }) {
  const { pantry, preferences, shopping, addRecipeToShopping } = useApp();
  const [completed, setCompleted] = useState<string[]>([]);
  const adapted = adaptRecipe(dish, preferences);
  const match = rankRecipes([dish], pantry)[0];
  const missingIngredients = dish.ingredients.filter((ingredient) => !hasIngredient(pantry, ingredient.name));
  const shoppingComplete = missingIngredients.length > 0 && missingIngredients.every((ingredient) => (
    shopping.some((item) => (
      normalizeIngredient(item.name) === normalizeIngredient(ingredient.name)
      && item.unit === ingredient.unit
      && item.recipeIds.includes(dish.id)
    ))
  ));

  const addMissing = () => {
    if (!missingIngredients.length || shoppingComplete) return;
    addRecipeToShopping(dish);
  };

  return (
    <MobileScroll className="app-screen paper-screen">
      <main className="detail-content">
        <section className="detail-visual photo">
          <img src={dish.image} alt={`${dish.name}成菜图`} draggable={false} />
          <span className="detail-visual-copy">
            <small>{dish.cuisine} · {dish.difficulty}</small>
            <h1>{dish.name}</h1>
            <p>{dish.subtitle}</p>
          </span>
        </section>
        <div className="recipe-facts" aria-label="菜谱信息">
          <span><b>{dish.time}</b><small>分钟</small></span>
          <span><b>{preferences.servings}</b><small>人份</small></span>
          <span><b>{dish.heat}/3</b><small>原始辣度</small></span>
          <span><b>{match.canCook ? "齐" : match.missing.length}</b><small>{match.canCook ? "主料齐" : "样主料缺"}</small></span>
        </div>

        <section className="detail-section personalized">
          <div className="section-heading light"><div><p className="eyebrow red">已按“我家口味”换算</p><h2>专属改配</h2></div></div>
          <div className="personal-notes">
            {adapted.notes.map((note) => <span key={note}><CheckIcon />{note}</span>)}
          </div>
        </section>

        <section className="detail-section">
          <div className="section-heading light">
            <div><p className="eyebrow red">准备</p><h2>食材与用量</h2></div>
            <button
              type="button"
              className="outline-button"
              data-added={shoppingComplete || missingIngredients.length === 0 ? "true" : "false"}
              disabled={shoppingComplete || missingIngredients.length === 0}
              onClick={addMissing}
            >
              {shoppingComplete || missingIngredients.length === 0 ? <CheckIcon /> : <PlusIcon />}
              {missingIngredients.length === 0 ? "无需补料" : shoppingComplete ? "已加入采购单" : "加入缺料"}
            </button>
          </div>
          <div className="ingredient-list">
            {adapted.ingredients.map((ingredient) => {
              const has = hasIngredient(pantry, ingredient.name);
              return (
                <div key={ingredient.name} data-have={has ? "true" : "false"}>
                  <span>{has ? <CheckIcon /> : null}</span>
                  <strong>{ingredient.name}</strong>
                  <small>{ingredient.category}</small>
                  <b>{formatAmount(ingredient.amount)} {ingredient.unit}</b>
                </div>
              );
            })}
          </div>
        </section>

        <section className="detail-section">
          <div className="section-heading light"><div><p className="eyebrow red">跟做模式</p><h2>4 步开火</h2></div><span>{completed.length}/4</span></div>
          <div className="step-list">
            {adapted.steps.map((step, index) => {
              const done = completed.includes(step.id);
              return (
                <button
                  type="button"
                  className="cook-step"
                  data-done={done ? "true" : "false"}
                  key={step.id}
                  onClick={() => setCompleted((items) => done ? items.filter((id) => id !== step.id) : [...items, step.id])}
                >
                  <span className="step-number">{done ? <CheckIcon /> : index + 1}</span>
                  <span className="step-copy"><strong>{step.title}<small>约 {step.minutes} 分钟</small></strong><p>{step.instruction}</p></span>
                </button>
              );
            })}
          </div>
        </section>
        {dish.safety ? <aside className="safety-note"><strong>安全提醒</strong><p>{dish.safety}</p></aside> : null}
      </main>
    </MobileScroll>
  );
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return <div className="empty-state"><span><ReaderIcon /></span><strong>{title}</strong><p>{note}</p></div>;
}

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, "");
}

export default function Prototype() {
  const initial = useMemo(() => tabScreen("home"), []);
  return <AppStateProvider><FlowStack initial={initial} /></AppStateProvider>;
}
