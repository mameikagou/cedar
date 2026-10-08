# Cedar

Cedar 公司研究工作台：第一版实现招商南油真实 K 线。

- 前端：React 18.3.1、Rspack 2、TypeScript、Bun 1.3.3。参考 analyze 前端的 TanStack Router / Query、Zustand、Tailwind CSS 4、Radix UI、CVA、Zod、Framer Motion 及通用组件封装，仅迁基础架构。保留 Cedar 的绿色与暖色背景。
- 后端：Python 3.12、FastAPI、uv、Psycopg 异步连接池。
- PostgreSQL：复用现有实例，独立 `cedar` 数据库和 `cedar_app` 登录角色。

## 开发

安装 Node.js 24、Bun 1.3.3、uv 和 GNU Make，在仓库根目录运行：

```bash
make setup
make dev
```

打开 <http://127.0.0.1:3000>。`make dev` 同时启动 Rspack（React Fast Refresh）和 FastAPI，`/api` 代理到后端。API 文档：<http://127.0.0.1:8000/docs>。

也可分别运行 `make dev-frontend` / `make dev-backend`。`make build` 生成 `frontend/dist`，生产环境由 FastAPI 同源提供构建产物和 API，支持客户端路由刷新。

```bash
make check
```

检查包括 TypeScript、ESLint、Rspack 生产构建、Ruff、API/构建产物集成测试，以及部署授权与回滚测试。还检查业务 CSS 边界、注册对象校验、日线单位转换、仅数据库读取及周期聚合 / 均线计算。GitHub Actions 使用同样的入口，CI 不连接真实数据库。

## 前端基础架构

```text
frontend/
  src/routes/              TanStack 文件路由，数据获取与页面组合
  src/api/                 独立 fetch 封装、超时、统一错误
  src/hooks/api/           TanStack Query hooks、Zod 响应校验
  src/hooks/interaction/   交互封装
  src/components/views/   页面展示组件，通过 props 接收数据
  src/components/ui/      通用 UI、Radix/CVA Button、页面骨架
  src/components/design-system/  analyze 的 Surface、TextButton
  src/stores/              Zustand，仅全局 UI 状态
  src/styles/              primitive → semantic → component 主题 token
  bun.lock                 冻结依赖
  dist/                    构建产物（不提交）
backend/src/cedar_api/      FastAPI 应用、配置、数据库连接
backend/tests/             API、构建产物和部署测试
backend/uv.lock            冻结后端依赖
scripts/                   开发进程、Actions 部署请求及本机部署执行
infra/systemd/             常驻应用及部署轮询服务
.github/workflows/         CI/CD
```

沿用 analyze 的分层规范：路由 → API hooks → 请求层，页面组合 → 展示组件 → 通用 UI → 设计原语。UI 不直接请求接口，服务器数据只由 TanStack Query 管理，Zustand 不保存 API 数据。颜色通过语义 token 引用，主题支持浅色/深色。新增路由由 TanStack Rspack 插件自动生成路由树；`bun run typecheck` 也会先生成。

字体自托管 Claude 官方站当前使用的 Anthropic Sans / Serif / Mono 原版可变字体（常规及斜体，字重 300–800）。UI 使用 Sans，标题使用 Serif，代码字体入口使用 Mono；中文字符沿用系统字体回退。字体文件、来源和归属记录见 `frontend/public/fonts/SOURCES.md`，字体授权由项目所属公司管理。

## K 线与样式规范

设计参考原样保存在 `planning/`。使用 TradingView Lightweight Charts 5.2.1，实现真实日线及周/月聚合、MA5/10/20、成交量、时间范围、十字光标、缩放平移、图片导出、明暗主题和手机布局。经营指标、事件及笔记不在本版范围内。

数据链路：**analyze2quant 已发布数据湖 → 独立导入任务 → Cedar PostgreSQL → FastAPI → React 图表**。`GET /api/market/kline` 只读取 Cedar 行情表，不访问数据湖、不调用供应商。后台任务每 15 分钟检查已发布 current 版本，固定版本后校验注册 Parquet 的大小、SHA-256、字段与行数，筛选招商南油并转换为产品数据格式；所有日线与来源元数据在同一个事务中提交。版本未变跳过重导，失败保留旧快照。

产品日线按 `(symbol, trade_date)` 建主键，提供 OHLC、昨收、涨跌幅、成交量和成交额。价格不复权、币种人民币，成交量从手转为股、成交额从千元转为元；可缺失的昨收/涨跌幅/成交额保留 null，不造值。JSON 使用 `time`、`preClose`、`pctChange` 等前端字段，另返回 `sourceDataset`、`sourceVersion`、`sourcePublishedAt`、`syncedAt` 与 `latestTradingDate`。原始单位口径见 [Tushare daily](https://tushare.pro/document/2?doc_id=27)，Cedar 不需要 Tushare token。日内功能暂不开放。

页面如实显示最后交易日。最后交易日距今超过 7 个自然日或导入任务超过 1 小时未成功检查来源版本时，显示历史数据提示；这是保守提示，不代表交易日历或实时行情。更新由 analyze2quant 原采集发布链路负责。

[项目规范](AGENTS.md)：业务代码严禁 `.css` / CSS Modules / 内嵌样式表，全部使用 Tailwind CSS；`.css` 仅配置全局样式、字体、主题和 token。业务颜色使用语义 token，Canvas 通过 `lib/chartColors.ts` 读取 `tokens.chart.css`，禁止硬编码颜色。ESLint 和 `check:styles` 在 CI 中检查这个边界。

## 数据库

本机连接配置位于 `~/.config/cedar/runtime.env`，权限 `0600`，不进入 Git。其他机器复制 `backend/.env.example` 为 `backend/.env`，填写连接信息。

配置优先级：进程 `CEDAR_DATABASE_URL` → `backend/.env` → 私有配置文件，可通过 `CEDAR_ENV_FILE` 指定后者。独立数据库共享 PostgreSQL 的计算和存储，项目角色没有超级用户、创建库或创建角色权限。业务表 `market_daily` 保存产品格式日线，`market_sync` 保存来源 dataset/version/hash、来源发布时间、导入时间与版本检查时间；在 Cedar 数据库内幂等初始化。

未配置数据库时，API 可以启动，`/api/ready` 返回 503；配置后会在启动时验证连接。`GET /api/health` 检查进程并返回部署 commit；`GET /api/ready` 检查真实 PG 连接。`CEDAR_WEB_DIR` 可以覆盖前端构建目录。

## 行情导入

本机导入任务配置单独保存在 `~/.config/cedar/market.env`（0600），包含 `CEDAR_DATABASE_URL`、`CEDAR_LAKE_READER_DATABASE_URL` 和 `CEDAR_LAKE_ROOT`。数据湖只读凭据不放入 HTTP 服务的 runtime.env，也不放入 Actions 或浏览器。源数据根只读，目标限定 `cedar` 数据库。

```bash
CEDAR_ENV_FILE=~/.config/cedar/market.env make import-market
# 如需按同一版本重新转换：
cd backend
CEDAR_ENV_FILE=~/.config/cedar/market.env uv run --frozen python -m cedar_api.import_market --force
```

首次导入后启用 `cedar-market-import.timer`；并发任务由 Cedar 数据库 advisory lock 互斥。排查使用 `systemctl status cedar-market-import.timer` 和 `journalctl -u cedar-market-import.service`。本地 PostgreSQL 事务回滚测试可通过 `CEDAR_TEST_DATABASE_URL` 显式启用，只使用当前会话的临时表，不改业务记录。

## 部署

访问 <https://cedar.mrlonely.top>，沿用原有 Cloudflare Access 登录保护。现有 Tunnel 指向本机 `127.0.0.1:9483`，Cedar 同源提供前端和 API。

- PR 运行 CI；`main` 推送或手动触发成功后，GitHub 托管 runner 请求生产部署。
- 本机服务验证请求仓库、`main` commit、工作流来源及 CI 成功结果，只部署精确 commit。
- 前端按 `bun.lock` 冻结安装并构建，后端按 `uv.lock` 安装到 `/srv/cedar/releases/<commit>/backend/.venv`，生产 API 不安装开发依赖。
- `/srv/cedar/current` 原子切换后重启 `cedar.service`；API、数据库、首页和 JS/CSS 产物检查通过才报告成功，失败则恢复并验证上一个版本。
- Actions 等待部署结果，生产失败会使流水线失败。旧版本保留供回滚。

本机初始安装（已有 admin 用户、Node.js 24、Bun、uv、gh 登录及 PG 私有配置）：

```bash
sudo install -d -o admin -g admin /srv/cedar
git clone --bare . /srv/cedar/repository.git
git --git-dir=/srv/cedar/repository.git remote set-url origin https://github.com/mameikagou/cedar.git
sudo install -d /usr/local/lib/cedar
sudo install -m 644 scripts/deploy_agent.py /usr/local/lib/cedar/deploy_agent.py
sudo install -m 644 infra/systemd/cedar* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cedar.service
sudo systemctl enable --now cedar-deploy.timer
# 在包含 importer 的首个版本已部署且 market.env 配好后启用：
sudo systemctl enable --now cedar-market-import.timer
```

部署约每 20 秒轮询，PG 凭据不进入 Actions。部署 unit 的 PATH 包含本机 Node.js / Bun 安装目录，迁机时应调整。更新部署脚本或 unit 后需要重新 install / daemon-reload；普通代码变更自动部署。

排查：`systemctl status cedar.service cedar-deploy.timer`，`journalctl -u cedar-deploy.service`。
