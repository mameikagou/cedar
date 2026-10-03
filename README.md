# Cedar

前后端开发骨架。

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

检查包括 TypeScript、ESLint、Rspack 生产构建、Ruff、API/构建产物集成测试，以及部署授权与回滚测试。GitHub Actions 使用同样的入口，CI 不连接真实数据库。

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

## 数据库

本机连接配置位于 `~/.config/cedar/runtime.env`，权限 `0600`，不进入 Git。其他机器复制 `backend/.env.example` 为 `backend/.env`，填写连接信息。

配置优先级：进程 `CEDAR_DATABASE_URL` → `backend/.env` → 私有配置文件，可通过 `CEDAR_ENV_FILE` 指定后者。独立数据库共享 PostgreSQL 的计算和存储，项目角色没有超级用户、创建库或创建角色权限。当前没有业务表。

未配置数据库时，API 可以启动，`/api/ready` 返回 503；配置后会在启动时验证连接。`GET /api/health` 检查进程并返回部署 commit；`GET /api/ready` 检查真实 PG 连接。`CEDAR_WEB_DIR` 可以覆盖前端构建目录。

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
```

部署约每 20 秒轮询，PG 凭据不进入 Actions。部署 unit 的 PATH 包含本机 Node.js / Bun 安装目录，迁机时应调整。更新部署脚本或 unit 后需要重新 install / daemon-reload；普通代码变更自动部署。

排查：`systemctl status cedar.service cedar-deploy.timer`，`journalctl -u cedar-deploy.service`。
