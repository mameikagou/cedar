import { useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChartCandlestick, ChevronRight, CircleAlert, Database, Moon, RefreshCw, Ship, Sun, TreePine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KlineChart, type KlineChartHandle } from '@/components/charts/KlineChart'
import { ChartToolbar } from '@/components/kline/ChartToolbar'
import { WorkspaceSidebar } from '@/components/kline/WorkspaceSidebar'
import { useTheme } from '@/hooks/interaction/useTheme'
import type { KlineSnapshot } from '@/hooks/api/useKline'
import { useKlineStore } from '@/stores/useKlineStore'
import { aggregateCandles, formatVolume, MA_PERIODS, movingAverage, rangeStart } from '@/lib/kline'
import { cn } from '@/lib/utils'
interface Props { snapshot?: KlineSnapshot; loading: boolean; refreshing: boolean; error?: string; onRefresh: () => void }
const averageClasses = ['text-(--chart-ma-5)', 'text-(--chart-ma-10)', 'text-(--chart-ma-20)']
const periodNames = { day: '日 K', week: '周 K', month: '月 K' }
export function KlineView({ snapshot, loading, refreshing, error, onRefresh }: Props) {
  const { theme, toggle } = useTheme()
  const settings = useKlineStore()
  const chart = useRef<KlineChartHandle>(null)
  const panel = useRef<HTMLElement>(null)
  const [hoveredTime, setHoveredTime] = useState<string>()
  const [notice, setNotice] = useState('')
  const bars = useMemo(() => aggregateCandles(snapshot?.candles ?? [], settings.period), [snapshot, settings.period])
  const averages = useMemo(() => MA_PERIODS.map((period) => new Map(movingAverage(bars, period).map((point) => [point.time, point.value]))), [bars])
  const selected = bars.find((bar) => bar.time === hoveredTime) ?? bars.at(-1)
  const latest = snapshot?.candles.at(-1)
  const start = rangeStart(bars, settings.range)
  const visibleBars = bars.filter((bar) => !start || bar.time >= start).length
  const rise = (latest?.pctChange ?? 0) >= 0
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (panel.current?.requestFullscreen) await panel.current.requestFullscreen()
      else setNotice('当前浏览器不支持全屏，请使用图表缩放。')
    } catch { setNotice('全屏未能打开，请使用图表缩放。') }
  }
  return (
    <div data-market="cn" className="min-h-dvh bg-bg-canvas">
      <WorkspaceSidebar />
      <div className="min-w-0 lg:ml-(--workspace-sidebar-width)">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-4 sm:px-7">
          <a href="/" className="flex min-h-11 items-center gap-2 text-accent lg:hidden"><TreePine size={22} /><span className="text-sm font-semibold tracking-widest">CEDAR</span></a>
          <nav aria-label="位置" className="hidden items-center gap-3 text-xs text-text-muted sm:flex"><span>我的研究</span><ChevronRight size={12} /><span>A 股</span><ChevronRight size={12} /><span className="text-text-primary">K 线研究</span></nav>
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="mr-2 hidden text-[10px] tracking-widest text-text-muted sm:inline">RESEARCH / 01</span>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'} title="切换主题">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</Button>
            <Button variant="ghost" size="icon" disabled={refreshing} onClick={onRefresh} aria-label="刷新行情" title="刷新行情"><RefreshCw size={17} className={cn(refreshing && 'animate-spin')} /></Button>
          </div>
        </header>
        <main className="mx-auto max-w-(--workspace-content-width) px-3 py-5 sm:px-7 sm:py-7">
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-5">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-border-subtle bg-bg-selected text-accent"><Ship size={24} strokeWidth={1.5} /></div>
              <div><h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">{snapshot?.name ?? '招商南油'}</h1><p className="mt-2 flex items-center gap-2 text-[11px] text-text-muted"><span className="font-mono tracking-wide">601975.SH</span><span className="rounded bg-bg-selected px-1.5 py-0.5 text-accent">A 股</span><span>油轮运输</span></p></div>
            </div>
            <div className="flex w-full items-end justify-between border-t border-border-subtle pt-4 sm:w-auto sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
              <div><div className={cn('flex items-baseline gap-3 font-mono tabular-nums', rise ? 'text-(--chart-up)' : 'text-(--chart-down)')}><span className="text-3xl font-medium tracking-tight">{latest?.close.toFixed(2) ?? '—'}</span><span className="flex items-center gap-1 text-sm">{latest && (rise ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}{latest?.pctChange != null ? `${rise ? '+' : ''}${latest.pctChange.toFixed(2)}%` : '—'}</span></div><p className="mt-1 text-[10px] text-text-muted">历史日线 · 截至 {snapshot?.latestTradingDate ?? '正在同步'}</p></div>
              <span className="text-xs text-text-muted sm:hidden">CNY / 元</span>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-muted sm:ml-auto sm:flex"><Database size={13} /><span>analyze2quant 数据湖</span><span className={cn('ml-1 size-1.5 rounded-full', snapshot?.stale ? 'bg-error' : 'bg-accent')} /></div>
          </div>
          {(snapshot?.stale || error) && <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface p-3 text-sm text-text-secondary"><CircleAlert size={16} className="shrink-0 text-error" /><span>{error ?? '当前展示数据库已导入的历史行情，请以最后交易日为准。'}</span></div>}
          <section id="price-chart" ref={panel} aria-label="股价走势" className="group/chart overflow-hidden rounded-xl border border-border-subtle bg-bg-surface [&:fullscreen]:h-dvh [&:fullscreen]:rounded-none">
            <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-4 sm:px-5">
              <div><h2 className="flex items-center gap-2 text-sm font-medium"><ChartCandlestick size={17} className="text-accent" />股价走势</h2><p className="mt-1.5 text-[11px] text-text-muted">价格与成交量，共享一条时间轴。</p></div>
              <span className="shrink-0 rounded border border-border-subtle px-2 py-1 font-mono text-[10px] text-text-muted">{periodNames[settings.period]} / CNY</span>
            </div>
            <ChartToolbar {...settings} reset={() => chart.current?.reset()} exportImage={() => chart.current?.exportImage()} fullscreen={() => { void fullscreen() }} />
            {loading && !snapshot ? <div role="status" className="grid h-(--kline-height-mobile) place-items-center px-6 text-sm text-text-muted sm:h-(--kline-height)"><span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" />正在同步招商南油真实日线…</span></div> : selected ? <>
              <div className="grid grid-cols-3 gap-x-3 gap-y-2 px-4 pt-4 pb-2 font-mono text-[11px] tabular-nums text-text-muted sm:flex sm:flex-wrap sm:gap-x-5 sm:px-5" data-testid="ohlc">
                <time className="col-span-3 font-medium text-text-primary sm:mr-1">{selected.time}</time>
                {([['开', selected.open], ['高', selected.high], ['低', selected.low], ['收', selected.close]] as const).map(([label, value]) => <span key={label}>{label} <b className="font-normal text-text-primary">{value.toFixed(2)}</b></span>)}
                <span>涨跌 <b className={cn('font-normal', (selected.pctChange ?? 0) >= 0 ? 'text-(--chart-up)' : 'text-(--chart-down)')}>{selected.pctChange != null ? `${selected.pctChange >= 0 ? '+' : ''}${selected.pctChange.toFixed(2)}%` : '—'}</b></span>
                <span>量 <b className="font-normal text-text-primary">{formatVolume(selected.volume)}股</b></span>
              </div>
              <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 font-mono text-[10px] sm:px-5" aria-label="均线数值">
                {MA_PERIODS.map((period, index) => settings.averages.includes(period) && <span key={period} className={averageClasses[index]}>MA{period} <span>{averages[index].get(selected.time)?.toFixed(2) ?? '—'}</span></span>)}
                {settings.volume && <span className="text-text-muted">VOL / 股</span>}
              </div>
              <KlineChart ref={chart} bars={bars} range={settings.range} averages={settings.averages} volume={settings.volume} theme={theme} onHover={setHoveredTime} />
            </> : <div className="flex h-(--kline-height-mobile) flex-col items-center justify-center gap-4 px-6 text-center sm:h-(--kline-height)"><CircleAlert size={28} className="text-text-muted" /><p className="text-sm text-text-muted">{error ?? '暂时没有可用行情。'}</p><Button variant="outline" onClick={onRefresh}>重新加载行情</Button></div>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3 text-[10px] text-text-muted sm:px-5"><span>{visibleBars} 根 {periodNames[settings.period]}<span className="mx-2">·</span>红涨绿跌<span className="mx-2">·</span>不复权</span><span className="sm:hidden">横拖回看 · 双指缩放 · 长按读数</span><span className="hidden sm:inline">拖动回看 · 滚轮缩放 · 双击价格轴复位</span></div>
          </section>
          {notice && <p role="status" className="mt-3 text-xs text-text-muted">{notice}</p>}
          <footer className="mt-5 flex flex-col justify-between gap-3 text-[10px] leading-relaxed text-text-muted sm:flex-row">
            <p>来源：analyze2quant 数据湖 · 历史日线{snapshot && ` · 入库 ${new Date(snapshot.syncedAt).toLocaleString('zh-CN', { hour12: false })}`}<br className="sm:hidden" /><span className="hidden sm:inline"> · </span>周 / 月线由日线聚合，当前周期可能尚未结束。</p>
            <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="flex min-h-11 items-center underline-offset-4 hover:text-accent hover:underline sm:-mt-3">图表由 TradingView Lightweight Charts™ 提供</a>
          </footer>
        </main>
      </div>
    </div>
  )
}
