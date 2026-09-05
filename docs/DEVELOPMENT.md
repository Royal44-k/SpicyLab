# 开发架构与规格

## 1. 技术栈

- React 19 + TypeScript 7
- Vite 8
- Motion、Radix UI、use-gesture
- Node.js 原生测试运行器
- Playwright 移动交互测试
- Cloudflare Workers / OpenAI Sites 兼容构建输出

## 2. 应用分层

### 界面层

`src/Prototype.tsx` 组合找菜、菜谱、采购、口味和菜谱详情流程，`src/prototype.css` 定义应用自有视觉。固定导航与状态栏属于手机运行时外壳，不进入普通滚动内容。

### 移动运行时

`src/mobile/` 提供：

- `PhoneFrame`：iPhone / Pixel 10 设备框与屏幕入口。
- `MobileScroll`：移动滚动、拖动抑制和安全区。
- `FlowStack`：详情页推入、返回和固定页脚。
- `KeyboardInput` / `KeyboardDock`：真实输入焦点与模拟键盘联动。
- `Carousel` / `BottomSheet`：移动手势组件。

受保护文件及运行时哈希由 `mobile-runtime.lock.json` 和 `scripts/check-mobile-runtime.mjs` 校验。

### 领域层

- `src/recipes.ts`：36 道菜的结构化数据、用量、步骤和图片路径。
- `src/ingredientMatching.ts`：食材标准化、别名与品类关系。
- `src/domain.ts`：搜索评分、库存匹配、采购单合并和口味缩放。
- `src/appState.ts`：本地状态初始化、去重、持久化和纯 reducer 更新。

## 3. 食材匹配规则

匹配分为四层，不能混用：

1. `exact`：食材或明确别名完全等价，可视为已经拥有。
2. `covers`：具体食材能够满足菜谱中的泛化需求，例如具体鱼肉满足泛化“鱼肉”。
3. `related`：属于同一食材家族，仅用于召回和排序，不能标记为已拥有。
4. `none`：无关系，不参与食材驱动结果。

搜索词以空格、顿号、逗号或分号拆分，多词采用 AND 语义。单词评分优先级为：完整菜名、菜名包含、主料精确匹配、标签、主料品类相关、配菜相关、菜系与描述。存在搜索词时先比较查询相关度，再比较可直接制作、主料满足度、主料相关度、加权匹配率、缺少主料数、缺料总数、烹饪时间和目录顺序。

泛化输入只负责召回。例如输入“鱼肉”可以找到“剁椒鱼头”，但不会把“花鲢鱼头”标为现有食材，也不会从采购单中移除。语义食材词只有在菜谱确实包含相关食材时才允许菜名文字参与匹配，因此“鱼肉”不会误召回“鱼香肉丝”。

## 4. 状态与持久化

应用状态包含：

- 家庭库存 `pantry`
- 采购单 `shopping`
- 收藏 `favorites`
- 辣、麻、咸、油与人数偏好 `preferences`

状态通过纯 reducer 更新，并写入浏览器本地存储。重复添加、别名添加、重复进入详情页和返回操作必须保持幂等。

## 5. 输入与键盘契约

- 所有文本输入使用移动运行时提供的键盘感知组件。
- Enter、添加按钮和“看看能做什么”会提交内容并关闭键盘。
- 点击输入框外或开始滚动只关闭键盘，不丢弃未提交文字。
- 菜谱搜索只显示应用自有的红色清除按钮，浏览器原生搜索清除控件必须隐藏。

## 6. 图片规格

- 菜品展示图使用横向 JPG/PNG，保持真实成菜质感，不使用纯色占位。
- 运行资源位于 `public/assets/app/`。
- 可追溯高分辨率源图位于 `source-assets/dishes-original/`。
- 详情页与列表页必须引用同一道菜自己的图片。

## 7. 质量门槛

提交前至少执行：

```bash
npm run check:runtime
node --test tests/app-state.test.ts tests/domain.test.ts tests/recipe-images.test.mjs
npm run test:runtime
npm run build
npm run test:sites
```

关键回归覆盖：输入提交与重新聚焦、匹配和误召回、采购单幂等、详情页返回、底部导航遮挡、安全区、状态栏对比度、原生搜索清除按钮以及所有菜谱图片完整性。

## 8. 构建产物

`npm run build` 生成：

- `dist/client/`：静态应用和全部运行资源。
- `dist/server/index.js`：Cloudflare Workers 兼容入口。
- `dist/.openai/hosting.json`：Sites 部署元数据。

`dist/` 是可再生构建产物，因此不提交到 Git；仓库保存生成它所需的全部源码和资产。
