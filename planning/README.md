# K 线原型第一版

两份原始 HTML 原样保存在本目录，仅用于视觉参考。

本版将浅色稿的 Cedar 工作台、公司标题和克制的绿色配色，与深色稿的图表层次组合成同一套可切换主题。仅实现 K 线、成交量、均线、日/周/月周期、时间范围、十字光标、缩放平移、图表导出和手机布局。经营指标、事件、笔记和数据来源工作台不在本版范围内。

图表使用 TradingView Lightweight Charts 5.2.1，保留官方标识和来源链接。它是开源 Canvas 图表库，不是 TradingView 整站 iframe，也不是需要另行授权的 Advanced Charts。

页面和组件全部使用 Tailwind CSS。全局 CSS 仅注册字体、基础样式和 primitive / semantic / component / chart token；Canvas 颜色由统一读取函数从 token 解析。架构按 analyze 的通用前端分层组织，不迁移其策略代码。

数据按用户最新要求经数据库服务产品：独立导入任务只读 analyze2quant 的已发布版本及注册 Parquet，对象校验后将招商南油行情转换为产品格式，事务写入 Cedar PostgreSQL。前后端请求仅通过同源 `/api/market/kline` 读取 Cedar 数据库，不直接读取数据湖。每 15 分钟检查来源版本，同一版本不重复导入，失败保留旧快照。可行性核对见 [data-reuse-feasibility.md](data-reuse-feasibility.md)，落实记录见 [market-database-integration.md](market-database-integration.md)。

价格为不复权，币种人民币；成交量从 Tushare 的“手”乘 100 转为“股”，成交额从“千元”乘 1000 转为“元”。周/月线从真实交易日聚合，不填补停牌或节假日。均线使用完整周期历史计算，再改变图表可见范围。日内功能暂不开放。

官方 API 参考：https://tradingview.github.io/lightweight-charts/docs/
行情口径：https://tushare.pro/document/2?doc_id=27
