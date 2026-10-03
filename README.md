# Cedar

前后端开发骨架。

- 前端沿用 [analyze2quant](https://github.com/mameikagou/analyze2quant) 的原生 HTML / CSS / JavaScript 结构及基础视觉风格，仅复用设计与封装方式。使用 ES Modules 分开 API 请求、UI 组件及页面逻辑，无 Node 运行时依赖、无构建步骤。
- 后端使用 Python 3.12、FastAPI、uv 和 Psycopg 异步连接池。
- PostgreSQL 复用现有实例，使用独立的 `cedar` 数据库和 `cedar_app` 登录角色。

## 开发

安装 [uv](https://docs.astral.sh/uv/getting-started/installation/) 和 GNU Make，然后在仓库根目录运行：

```bash
make setup
make dev
```

打开 <http://127.0.0.1:8000>。前端由 FastAPI 同源提供，修改页面后刷新浏览器即可。
API 文档：<http://127.0.0.1:8000/docs>。

## 数据库配置

初始化机器上的连接配置存放于 `~/.config/cedar/runtime.env`，权限为 `0600`，不进入 Git。
其他机器可以复制 `backend/.env.example` 为 `backend/.env`，填入自己的连接信息。

配置优先级：进程环境变量 `CEDAR_DATABASE_URL` → `backend/.env` → 私有配置文件。
通过 `CEDAR_ENV_FILE` 可指定私有配置路径。
独立数据库共享 PostgreSQL 实例的计算和存储资源，避免再启动一个实例。
项目专用角色不授予超级用户、创建数据库或创建角色权限。

未配置数据库时，页面和 API 仍可启动，`/api/ready` 返回 503。
配置了数据库后，应用启动时验证连接，连接失败会使启动失败。

## 检查

```bash
make check
```

包括 Ruff、API/静态页面测试、部署授权与回滚测试和 JavaScript 语法检查。JavaScript 检查需要 Node.js 24。
GitHub Actions 使用同样的检查入口，CI 不连接真实数据库。

## 目录

```text
frontend/             原生 HTML、CSS、JavaScript
  api/                同源请求封装与接口
  components/         UI 组件
  pages/              页面逻辑
backend/src/cedar_api/ FastAPI 应用、配置、数据库连接
backend/tests/        API 和静态页面检查
backend/uv.lock       后端锁定依赖
scripts/              Actions 部署请求与本机部署执行
infra/systemd/        常驻应用及部署轮询服务
.github/workflows/    CI/CD
```

`GET /api/health` 检查 API 进程；`GET /api/ready` 检查真实数据库连接。
数据库当前不建业务表，业务模型、迁移工具、鉴权和部署方案后续再定。
安装后若前端文件位于其他位置，可设置 `CEDAR_WEB_DIR`。

## 生产部署与 CI/CD

访问 <https://frontend.mrlonely.top>，沿用域名原有的 Cloudflare Access 登录保护。
现有 Cloudflare Tunnel 将该域名指向本机 `127.0.0.1:9483`，Cedar 同时提供前端和 API。

- Pull request 运行 CI；推送到 `main` 或在 `main` 手动触发 Actions 时，CI 成功后请求生产部署。
- 所有 Actions 作业使用 GitHub 托管 runner。本机部署服务读取 GitHub Deployment 请求，验证仓库、`main` commit、工作流来源及 CI 成功结果。
- 依赖按 `uv.lock` 安装到 `/srv/cedar/releases/<commit>/backend/.venv`，生产不安装开发依赖。
- `/srv/cedar/current` 原子切换版本，然后重启 `cedar.service`。应用、数据库和首页检查均通过才报告部署成功；检查失败时恢复并验证上一版本。
- GitHub Actions 等待本机部署结果，生产失败会使流水线失败。旧版本目录保留供回滚使用。

本机初始安装（已有 `admin` 用户、uv、gh 登录及私有 PG 配置）：

```bash
sudo install -d -o admin -g admin /srv/cedar
sudo install -d /usr/local/lib/cedar
sudo install -m 644 scripts/deploy_agent.py /usr/local/lib/cedar/deploy_agent.py
sudo install -m 644 infra/systemd/cedar* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cedar.service
sudo systemctl enable --now cedar-deploy.timer
```

部署服务约每 20 秒检查一次新请求，使用本机现有 GitHub CLI 登录报告 deployment 状态。
数据库凭据只由应用读取，GitHub Actions 中无需存储 PG 密码。
更新部署服务或 systemd 配置后，应重做对应的 `install` 和 `daemon-reload`；普通代码变更自动部署。

排查：`systemctl status cedar.service cedar-deploy.timer`，以及 `journalctl -u cedar-deploy.service`。
`/api/health` 返回当前部署 commit，便于核对实际运行版本。
