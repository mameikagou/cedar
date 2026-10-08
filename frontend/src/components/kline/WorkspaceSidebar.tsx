import { ChartCandlestick, ChevronRight, Database, Ship, TreePine } from 'lucide-react'
export function WorkspaceSidebar() {
  return (
    <aside aria-label="研究空间" className="fixed inset-y-0 left-0 z-20 hidden w-(--workspace-sidebar-width) flex-col border-r border-border-subtle bg-bg-surface px-4 py-7 lg:flex">
      <a href="/" className="mb-10 flex min-h-11 items-center gap-3 px-2 text-accent">
        <TreePine size={30} strokeWidth={1.5} />
        <span><span className="block text-lg font-semibold tracking-[.18em]">CEDAR</span><span className="mt-1 block text-[11px] tracking-wider text-text-muted">公司研究工作台</span></span>
      </a>
      <p className="px-3 text-[10px] font-medium tracking-widest text-text-muted">WORKSPACE / 研究空间</p>
      <a href="#price-chart" aria-current="page" className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border-l-2 border-accent bg-bg-selected px-3 text-sm font-medium text-accent">
        <ChartCandlestick size={18} />K 线研究<ChevronRight size={14} className="ml-auto" />
      </a>
      <div className="my-7 border-t border-border-subtle" />
      <p className="px-3 text-[10px] font-medium tracking-widest text-text-muted">当前公司 / 01</p>
      <div className="mt-4 rounded-xl border border-border-subtle bg-bg-canvas p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-accent"><Ship size={14} />油轮运输</div>
        <p className="text-sm font-medium">招商南油</p>
        <p className="mt-1 font-mono text-xs text-text-muted">601975.SH</p>
        <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3 text-[11px] text-text-muted"><span className="size-1.5 rounded-full bg-accent" />A 股 · 历史日线</div>
      </div>
      <div className="mt-auto px-2 pt-8 text-xs text-text-muted">
        <p className="flex items-center gap-2"><Database size={14} />Cedar 行情数据库</p>
        <p className="mt-2 text-[11px] leading-relaxed">从价格开始，回到研究现场。</p>
        <div className="mt-5 border-t border-border-subtle pt-5 text-[10px] tracking-widest">CEDAR / RESEARCH 01</div>
      </div>
    </aside>
  )
}
