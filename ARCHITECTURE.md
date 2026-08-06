# FuelLog Architecture

## Overview

FuelLog 使用本地优先架构。同一套 React/TypeScript 业务层运行在网页和 Tauri 桌面端：

- 网页端使用浏览器 `localStorage`
- 桌面端使用 Tauri SQL 插件和 SQLite
- Repository 层隐藏两个后端的差异
- Zustand 只维护当前界面状态，持久数据由 Repository 负责

## Frontend

- `src/App.tsx`：应用外壳、导航和首页编排
- `src/components`：饮食弹窗、食物库、身体数据、分析、目标和数据管理界面
- `src/store/useNutritionStore.ts`：当前日期、饮食列表、当日目标与异步状态
- `src/utils`：日期校验、营养换算和目标估算等纯函数
- `src/services/foodRecognition.ts`：本地食物名称与份量识别
- `src/services/dataBackup.ts`：跨平台 JSON 备份恢复与 CSV 导出

## Data access

- `src/repositories/mealRepository.ts`
- `src/repositories/foodRepository.ts`
- `src/repositories/goalRepository.ts`
- `src/repositories/dayPlanRepository.ts`
- `src/repositories/bodyRecordRepository.ts`
- `src/repositories/userProfileRepository.ts`
- `src/repositories/analyticsRepository.ts`

所有写入在 Repository 层完成校验。SQLite 使用参数绑定，网页存储损坏时不会静默回退为空数据。

## Canonical food catalog

`src/data/foodCatalog.ts` 是内置食物的唯一权威来源：

- 桌面端启动时从目录 upsert 到 SQLite
- 网页端将目录与用户收藏、使用次数、自定义食物合并
- 智能识别使用同一目录和别名

## SQLite schema

迁移由 `src/database/migrations.ts` 管理：

- `schema_migrations`：已应用迁移
- `foods`：内置和自定义食物
- `meal_entries`：饮食记录和记录时间
- `nutrition_goals`：训练日/休息日默认目标历史
- `daily_plans`：每个日期的训练类型和目标快照
- `body_records`：体重、体脂、肌肉量、腰围
- `user_profile`：目标估算资料

## Data safety

- 日期使用严格本地日期校验，拒绝不存在的日期
- 日期切换使用请求序列，旧请求不能覆盖新页面
- 删除饮食前确认，删除后提供短时撤销
- JSON 完整备份包含饮食、食物、目标、每日计划、身体数据和个人估算资料
- 备份恢复在桌面端使用 SQLite 事务

## Security

- Tauri 开启内容安全策略（CSP）
- SQL 写入权限仅授予主窗口
- CI 拦截高危和严重 npm 漏洞
- 生产依赖由 `package-lock.json` 和 `Cargo.lock` 固定

## Testing and delivery

Vitest 覆盖：

- 营养份量换算
- 食物识别
- 每日计划持久化
- 饮食增删改查
- 个性化目标估算
- 严格日期
- 浏览器损坏数据处理

GitHub Actions 负责网页验证、Tauri 检查、Pages 发布和 Windows 安装包构建。
