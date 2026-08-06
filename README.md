# FuelLog

FuelLog 是面向健身人群的本地优先饮食与宏量营养记录应用，提供 Windows 桌面版和网页审核版。

## 主要能力

- 按日期记录早餐、午餐、晚餐和加餐
- 新增、编辑、删除及短时撤销饮食记录
- 从食物库选择后按份量自动换算热量与三大营养素
- 本地自然语言食物匹配，例如 `200g鸡胸肉`、`2个鸡蛋`、`一碗米饭`
- 低置信度识别保护，避免直接写入不可靠结果
- 训练日与休息日独立目标，并按日期保存目标快照
- 根据年龄、性别、身高、体重、活动量和目标生成起点建议
- 身体数据记录与饮食、体重趋势分析
- 完整 JSON 备份与恢复
- 饮食 CSV 导出

## 数据存储

- Windows 桌面版：SQLite，保存在当前 Windows 用户的应用数据目录
- 网页版：浏览器 `localStorage`
- 两个平台默认不上传用户数据，也不会自动同步
- 网页站点数据被清理、浏览器更换或系统重装前，应先从“数据管理”导出完整 JSON 备份

## 智能识别说明

当前识别采用本地食物目录、别名匹配、份量解析和单位换算，不会把数据发送到在线 AI。营养结果属于通用估算，不同品牌、生熟重量、烹饪油和调味料会造成差异。包装食品应优先参考营养标签。

## 开发环境

- Node.js 22
- Rust stable
- Tauri 2.11
- React 18 + TypeScript
- Zustand
- Recharts 3
- SQLite（Tauri SQL 插件）
- Vitest

## 本地启动

### 网页开发模式

```bash
npm ci
npm run dev
```

### Windows / Tauri 开发模式

先安装 Rust、Node.js 和 Tauri 对应的系统依赖：

```bash
npm ci
npm run tauri dev
```

## 质量检查

```bash
npm run test:run
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm audit --audit-level=high
```

CI 会在合并前执行依赖安全审计、回归测试、前端构建和 Tauri 后端检查。

## 发布限制

公开生成的 Windows 安装包目前没有商业代码签名，因此 Windows SmartScreen 可能显示“未知发布者”。正式面向公众发布前，需要配置可信代码签名证书；不要通过关闭杀毒软件来绕过警告。

## 版本

当前开发版本：`0.3.0`

详细变化见 [CHANGELOG.md](CHANGELOG.md)，架构见 [ARCHITECTURE.md](ARCHITECTURE.md)，隐私说明见 [PRIVACY.md](PRIVACY.md)。
