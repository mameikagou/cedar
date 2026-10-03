# Cedar

前后端开发骨架。

- 前端沿用 [analyze2quant](https://github.com/mameikagou/analyze2quant) 的原生 HTML / CSS / JavaScript 结构及基础视觉风格，无 Node 运行时依赖、无构建步骤。
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

包括 Ruff、API/静态页面测试和 JavaScript 语法检查。JavaScript 检查需要 Node.js 24。
GitHub Actions 使用同样的检查入口，不连接真实数据库。

## 目录

```text
frontend/             原生 HTML、CSS、JavaScript
backend/src/cedar_api/ FastAPI 应用、配置、数据库连接
backend/tests/        API 和静态页面检查
backend/uv.lock       后端锁定依赖
.github/workflows/    CI
```

`GET /api/health` 检查 API 进程；`GET /api/ready` 检查真实数据库连接。
数据库当前不建业务表，业务模型、迁移工具、鉴权和部署方案后续再定。
安装后若前端文件位于其他位置，可设置 `CEDAR_WEB_DIR`。
