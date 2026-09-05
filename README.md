# 灶边 · 川渝湘赣菜谱攻略

「灶边」是一款面向家庭做饭场景的移动端 Web/PWA 原型。用户可以根据家中已有食材寻找可做或最接近的菜，也可以按菜名、食材和地方风味搜索菜谱，将缺少的材料合并进采购单，并按个人口味与人数生成调整后的烹饪攻略。

[在线演示](https://spicylab-kitchenserver.lirongouyang522.chatgpt.site/?release=v8)

![灶边 iPhone 首页](qa/implementation-home-393x852.png)

## 核心能力

- 36 道川菜、重庆菜、湘菜和赣菜家常菜谱。
- 根据家庭库存计算可做程度、缺少食材和稳定排序。
- 食材别名、品类召回与精确库存判断相互分离，避免“鱼香肉丝”被“鱼肉”误召回。
- 菜名、食材、菜系和多关键词联合搜索。
- 自动合并缺料采购单并记录已购状态。
- 人数、辣度、麻度、咸度和用油偏好调整。
- iPhone 与 Pixel 10 设备预览、模拟键盘、滚动导航和安全区适配。
- 浏览器本地持久化；无需注册即可试用。

## 本地运行

环境要求：Node.js 20 或更高版本。

```bash
npm ci
npm run dev
```

开发服务器默认由 Vite 启动。打开终端中显示的本地地址即可查看应用。

## 构建与测试

```bash
# 生产构建，同时生成 Sites 所需 Worker 输出
npm run build

# 业务逻辑、状态和图片完整性
node --test tests/app-state.test.ts tests/domain.test.ts tests/recipe-images.test.mjs

# 移动端交互回归
npm run test:runtime

# Sites 打包输出验证
npm run test:sites
```

首次运行浏览器测试时，可按 Playwright 提示安装 Chromium；也可以通过 `PLAYWRIGHT_EXECUTABLE_PATH` 指向本机 Chromium/Edge。

## 项目结构

```text
src/                         应用界面、业务状态、菜谱数据与匹配引擎
src/mobile/                  手机框、键盘、滚动、导航和设备运行时
public/assets/app/           线上使用的菜品图与首页视觉素材
public/assets/iphone/        iPhone 设备和键盘素材
public/assets/android/       Pixel 10 设备、键盘和导航栏素材
source-assets/dishes-original/ 菜品高分辨率源图
tests/                       单元、集成、移动交互与 Sites 测试
audit/                       交互缺陷复现和最终 QA 截图
qa/                          设计对照与实现截图
docs/                        架构、演示、资产与历史设计规格
worker/                      Cloudflare Workers 兼容入口
```

进一步资料：

- [开发架构与规格](docs/DEVELOPMENT.md)
- [演示与 QA 截图](docs/DEMO.md)
- [资产清单](docs/ASSETS.md)
- [移动组件契约](src/mobile/COMPONENTS.md)
- [设计 QA 报告](design-qa.md)
- [键盘、匹配与稳定性设计](docs/superpowers/specs/2026-09-04-keyboard-matching-stability-design.md)

## 数据与隐私

库存、采购单、收藏和口味偏好保存在当前浏览器的本地存储中，不会自动同步到其他设备。清除站点数据会同时清除这些本地记录。

## 资产与许可

仓库包含项目运行和复现所需的完整图片与设备演示素材。菜品图及 QA 素材的目录说明见 [资产清单](docs/ASSETS.md)。本项目当前未附开源许可证；如需公开复用或商业分发，请由仓库所有者补充合适的 `LICENSE`。
