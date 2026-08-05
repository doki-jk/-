# FuelLog

面向健身人群的桌面饮食与宏量营养记录应用。支持训练日/休息日目标、饮食明细、宏量营养进度和趋势分析。

## 技术栈

- Tauri 2
- React 18 + TypeScript
- Zustand
- Recharts
- SQLite（Tauri SQL 插件骨架）

## 本地启动

### 仅运行 Web 界面

```bash
npm install
npm run dev
```

### 运行桌面应用

先安装 Node.js、Rust 和 Tauri 系统依赖，然后执行：

```bash
npm install
npm run tauri dev
```

## 首版功能

- 今日热量和宏量营养仪表盘
- 早餐、午餐、晚餐和加餐记录
- 删除饮食记录
- 训练日/休息日切换
- 最近 7 天热量趋势
- SQLite 桌面数据层配置骨架

## 后续路线

1. 完成食物新增弹窗和食物库搜索
2. 建立 SQLite 表和持久化命令
3. 添加身体数据与体重趋势
4. 支持 CSV 导入导出
5. 增加训练日和休息日独立目标
