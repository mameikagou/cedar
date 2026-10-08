# 复用 analyze2quant 行情的可行性核对

核对日期：2026-10-08。结论：可以复用现有数据湖；独立的已发布 A 股宽表尚未确认，已有日线、复权因子与拼接面板逻辑足以支持本版 K 线。

本次仅查询行情元数据与招商南油数据，数据库会话启用只读事务和语句超时，没有修改 analyze2quant 数据、触发采集或读取策略信号与研究结果。

## 已验证的入口与数据

- 正式数据库为 `analyze2quant_prod`，现有 reader 登录可访问 `api.dataset_current`、`api.dataset_version_objects` 等只读视图。
- 已发布数据位于 `/srv/qrant-data/datasets`。按数据库 current 指针选择版本和注册对象，不扫描目录猜最新文件。
- `a_share.daily_1d` 当前版本有 2,848 个注册对象，状态 available，元数据未标记不可用对象。
- 实际筛选 `601975.SH` 得到 1,868 根日线，覆盖 2019-01-08 至 2026-09-18；2024 年起有 659 根。OHLCV 无空值，交易日期无重复。
- 日线含 open/high/low/close、pre_close、pct_chg、volume、amount、source 等所需字段。不复权价格可直接投影。
- `a_share.adj_factor` 中该股有 1,870 条记录，覆盖到 2026-09-21。已存在 `a_share_panel.adjusted_daily_panel` 数据拼接逻辑，支持按股票和日期合并日线、复权因子及可选 daily_basic 字段。
- 当前 A 股 registry 中没有名称含 wide/panel 的已发布数据集，也没有找到独立 A 股 panel 缓存；不能把这一点表述为已确认存在可直接读取的独立宽表。现有美股 panel 缓存不能用于招商南油。

## 建议接法

`Cedar FastAPI → analyze2quant 只读版本视图 → 注册的行情 Parquet → 单股/日期过滤 → OHLCV 投影 → TradingView`

已有发布数据和面板口径优先复用。前端所需 K 线接口保持薄适配，不引入研究引擎依赖，不输出策略字段。只用内存缓存降低重复读取成本，不在 Cedar 再落一份行情表。一次查询固定版本，避免发布切换时混读对象。

数据库读取权限和同机数据文件读取均已验证；部署接入时使用后端私有配置，生产服务仍需验证读取权限。公开仓库与浏览器不包含凭据、物理路径或内部研究信息。

## 口径与限制

- 当前实际最新日线为 2026-09-18，尚未覆盖到核对日。页面必须展示最后交易日，更新交给 analyze2quant 原采集发布链路；Cedar 不临时请求供应商补数。
- 供应商适配器原样把 Tushare vol 写为 volume、amount 写为 amount；字段改名没有完成单位换算。图表接口应按现有单位合同明确转换，避免把“手”误当“股”或重复转换。
- 复权因子的日期范围比日线长，计算只对已有日线按精确日期连接；复权基准应明确，不将研究面板的 adjusted_* 直接冒称前复权。
- 周/月线和均线从真实日线计算；不补造停牌日或节假日行情。本版不需要日内数据。

本文件保留 2026-10-08 的可行性核对结论。用户随后要求经 Cedar 数据库提供产品数据，最终实现以 [market-database-integration.md](market-database-integration.md) 为准。
