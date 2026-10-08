# Cedar 项目规范

- 默认用中文沟通。
- 前端使用 React 18、Rspack、TypeScript 和 Tailwind CSS（twcss），依赖管理只用 Bun。
- 后端使用 FastAPI，Python 依赖和执行环境使用 uv。
- 业务页面、业务组件严禁使用 `.css` 文件，包括 CSS Modules、独立样式表和内嵌 `<style>`；全部使用 Tailwind utility class。不要用行内 style 绕过此规则。
- `.css` 仅用于全局配置：Tailwind 入口、基础全局样式、字体注册、主题和设计 token。禁止在全局 CSS 中定义业务组件选择器。
- token 分为 primitive → semantic → component；页面和组件只引用语义或组件 token，禁止硬编码颜色。Canvas 图表从 `tokens.chart.css` 的语义 token 读取计算值，再传给图表 API。
- 前端架构参考 analyze：route → view → component，网络请求放在 api，服务端数据由 hooks/api + TanStack Query 管理，Zustand 只保存交互状态。前端只参考通用架构，不迁移其业务或策略代码；行情导入任务通过只读入口复用 analyze2quant 数据湖。
- 移动端优先，触控目标至少 44px；横向滑动仅限工具栏，不允许页面整体横向溢出。
- 用户提供的 HTML 放在 `planning/`，仅作为设计参考，不直接嵌入生产页面。
- 日/周/月 K 线的数据源是 analyze2quant 已发布的数据湖与可用宽表。独立导入任务只读解析 current 版本和注册对象，校验后转换为面向产品的行情格式，事务写入 Cedar PostgreSQL。前后端业务请求只读 Cedar 数据库，不直接读取数据湖或调用 Tushare。导入必须保留来源版本、发布时间和导入时间，重复同步同一版本不重复入库，失败保留完整旧版本。只投影行情所需字段，不暴露研究或策略数据。
- 数据更新时间与最后交易日必须如实展示，缺数据返回明确缺项，不临时调用外部供应商补数。日内数据如需 mock 必须明确标注。凭据仅保存在后端私有配置，不提交 Git 或发送到浏览器。
- 验证使用 `make check`；测试和本地预览不得占用或改动生产服务端口。
