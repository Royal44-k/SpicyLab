# 项目资产清单

## 菜品与品牌图片

| 目录 | 内容 | 用途 |
| --- | --- | --- |
| `public/assets/app/dishes/` | 35 张优化后的横向菜品 JPG | 列表与详情页运行资源 |
| `public/assets/app/laziji.png` | 辣子鸡成菜图 | 列表与详情页运行资源 |
| `public/assets/app/hero-wok.png` | 首页铁锅主题图 | 首页视觉背景 |
| `source-assets/dishes-original/` | 35 张高分辨率菜品 PNG | 原始母版、后续裁切和再压缩 |

菜品文件以地区前缀组织：`sc-` 为川菜、`cq-` 为重庆菜、`hn-` 为湘菜、`jx-` 为赣菜。运行时映射集中在 `src/recipes.ts`。

## 设备演示素材

| 目录 | 内容 |
| --- | --- |
| `public/assets/iphone/` | iPhone 外框与键盘素材 |
| `public/assets/android/` | Pixel 10 外框、键盘和底部导航素材 |
| `public/assets/status/` | iOS / Android 状态栏图标 |

这些文件属于移动原型运行时的一部分，路径和几何尺寸受 `mobile-runtime.lock.json` 保护。

## QA 与演示证据

| 目录 | 内容 |
| --- | --- |
| `qa/` | 首页设计对照、完整视口和最终实现截图 |
| `audit/final-qa/` | 新用户、输入、键盘、匹配、Pixel 与详情返回验证 |
| `audit/keyboard-flow/` | 已修复键盘缺陷的历史复现截图 |

完整浏览入口见 [DEMO.md](DEMO.md)。

## 可再生文件

以下目录不属于源资产，已通过 `.gitignore` 排除：

- `node_modules/`：依赖缓存，可通过 `npm ci` 恢复。
- `dist/`：生产构建结果，可通过 `npm run build` 恢复。
- `test-results/`、`playwright-report/`：临时测试输出。

## 使用提示

仓库保留了运行图与源图，便于完整复现项目。公开或商业使用前，请由仓库所有者确认图片、字体和设备展示素材的授权范围，并补充项目许可证。
