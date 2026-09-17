# 餐饮菜谱服务专家 Skill

`culinary-service-expert` 从 SpicyLab「灶边」的产品规划、交互问题、厨艺内容与开发交付中提炼可复用方法。默认中文，按本次任务加载相关资料，不把小问题强制扩展为整套项目。

## 内容与入口

- [技能入口](culinary-service-expert/SKILL.md)：使用场景、资料路由和关键约束。
- [完整技能ZIP](culinary-service-expert.zip)：包含完整的31个技能文件；不包含下列仓库归档报告。
- [交付与验收报告](交付与验收.md)：要求覆盖、测试结果及未验证范围。
- [独立情景评测](evaluation/forward-output.md)：三个真实任务式案例的输出与局限。
- [SHA256文件清单](package-validation.json)：技能文件的相对路径、长度及哈希。
- [包结构验证器](validate-package.py)：本地链接、JSON/CSV、元数据与清单检查。

技能目录含15篇指南、6份模板、2份结构化示例、3张历史截图，以及2个工具和1个测试脚本。全部应用图片与演示资产仍保留在仓库原目录；技能中的截图只是有明确图注的复盘示例。

## 安装

1. 下载ZIP并解压，或从仓库复制 `skills/culinary-service-expert` 整个文件夹。
2. 放入当前用户的 Codex 技能目录：默认 `~/.codex/skills/`；Windows通常为 `%USERPROFILE%\.codex\skills\`。自定义 `CODEX_HOME` 时使用其中的 `skills/`。
3. 确认路径形如 `skills/culinary-service-expert/SKILL.md`，不要多套一层同名目录。已有同名技能时先备份并比较，不直接覆盖个人改动。
4. 在新任务中输入 `$culinary-service-expert`，或直接引用该 `SKILL.md`。

例如：

> 使用 $culinary-service-expert，审查菜谱服务的食材匹配和采购机制，给出部位、形态、用量与人数变更的规则和回归案例。本次不修改或发布应用。

## 运行工具

Node.js 20或更高版本。在仓库根目录运行，无需为技能工具安装npm依赖：

```bash
node skills/culinary-service-expert/scripts/business-model.mjs skills/culinary-service-expert/assets/examples/business-scenarios.json
node skills/culinary-service-expert/scripts/audit-recipe.mjs skills/culinary-service-expert/assets/examples/recipe-record.json
node --test skills/culinary-service-expert/scripts/test-tools.mjs
```

可选包校验需要 Python 3.9或更高版本和 PyYAML（本次使用6.0.3）：

```bash
python -m pip install PyYAML==6.0.3
python skills/validate-package.py skills/culinary-service-expert
```

校验器将当前清单输出到标准输出，不会覆盖文件。将输出的 `manifest` 与归档的 `package-validation.json` 比较，可检查内容变化。结构校验不能证明所有业务、食品安全或真实设备行为正确。

本目录的 `.gitattributes` 保留文件原始字节，避免Windows自动转换换行后产生清单哈希差异；其范围仅限 `skills/`，不改变应用的Git配置或运行时。

## 使用边界

- 市场研究与法规保留原始来源和核验范围，正式使用时需核对最新版本。
- 经营模型参数是演示假设，不是已实现收入、预测或完整财务报表。
- 菜谱样例未经实际试做；结构校验器不会将其认证为可发布或食品安全合格。
- 历史截图、模拟键盘验证和真实手机验收分别记录；本次上传不代表线上应用重新验收或发布。
- 沿用仓库现有许可状态；此次归档没有新增开源或商业授权。
