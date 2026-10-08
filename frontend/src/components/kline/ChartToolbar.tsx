import { Download, Maximize2, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Popover } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { MA_PERIODS, type ChartRange, type MovingAveragePeriod, type Period } from '@/lib/kline'
import { cn } from '@/lib/utils'
interface Props {
  period: Period
  range: ChartRange
  averages: readonly MovingAveragePeriod[]
  volume: boolean
  setPeriod: (value: Period) => void
  setRange: (value: ChartRange) => void
  toggleAverage: (value: MovingAveragePeriod) => void
  toggleVolume: () => void
  reset: () => void
  exportImage: () => void
  fullscreen: () => void
}
const periods: { value: Period; label: string }[] = [{ value: 'day', label: '日 K' }, { value: 'week', label: '周 K' }, { value: 'month', label: '月 K' }]
const ranges: ChartRange[] = ['1M', '3M', '6M', 'ALL']
const segment = 'min-h-11 min-w-11 rounded-md px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent'
export function ChartToolbar(props: Props) {
  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex rounded-lg bg-bg-canvas p-1" role="group" aria-label="K 线周期">
          {periods.map(({ value, label }) => <button key={value} type="button" aria-pressed={props.period === value} onClick={() => props.setPeriod(value)} className={cn(segment, props.period === value ? 'bg-bg-selected font-medium text-accent' : 'text-text-muted hover:bg-bg-hover')}>{label}</button>)}
        </div>
        <span className="border-l border-border-subtle pl-3 text-xs text-text-muted">不复权</span>
      </div>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        <div role="group" aria-label="时间范围" className="mr-auto flex sm:mr-2">
          {ranges.map((value) => <button key={value} type="button" aria-pressed={props.range === value} onClick={() => props.setRange(value)} className={cn(segment, props.range === value ? 'bg-bg-selected font-medium text-accent' : 'text-text-muted hover:bg-bg-hover')}>{value === 'ALL' ? '全部' : value}</button>)}
        </div>
        <Popover.Root>
          <Popover.Trigger asChild><Button variant="ghost" size="icon" aria-label="设置图表指标" title="图表指标"><SlidersHorizontal size={17} /></Button></Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={8} align="end" className="z-50 w-56 rounded-xl border border-border-subtle bg-bg-elevated p-4 text-text-primary shadow-(--shadow-elevated)">
              <p className="mb-2 text-xs font-medium text-text-muted">图表指标</p>
              {MA_PERIODS.map((value) => <label key={value} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">MA {value}<input type="checkbox" checked={props.averages.includes(value)} onChange={() => props.toggleAverage(value)} className="size-4 accent-accent" /></label>)}
              <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-between border-t border-border-subtle text-sm">成交量<input type="checkbox" checked={props.volume} onChange={props.toggleVolume} className="size-4 accent-accent" /></label>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Button variant="ghost" size="icon" aria-label="重置图表视图" title="重置视图" onClick={props.reset}><RotateCcw size={17} /></Button>
        <Button variant="ghost" size="icon" aria-label="下载 K 线图片" title="下载图片" onClick={props.exportImage}><Download size={17} /></Button>
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="全屏图表" title="全屏" onClick={props.fullscreen}><Maximize2 size={17} /></Button>
      </div>
    </div>
  )
}
