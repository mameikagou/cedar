import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, createChart,
  type IChartApi, type ISeriesApi, type Time,
} from 'lightweight-charts'
import { chartColors } from '@/lib/chartColors'
import { MA_PERIODS, movingAverage, rangeStart, type Candle, type ChartRange, type MovingAveragePeriod } from '@/lib/kline'

export interface KlineChartHandle { reset: () => void; exportImage: () => void }
interface Props {
  bars: Candle[]
  range: ChartRange
  averages: readonly MovingAveragePeriod[]
  volume: boolean
  theme: 'light' | 'dark'
  onHover: (time?: string) => void
}
export const KlineChart = forwardRef<KlineChartHandle, Props>(function KlineChart({ bars, range, averages, volume, theme, onHover }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const candles = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const histogram = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lines = useRef<ISeriesApi<'Line'>[]>([])
  const currentBars = useRef(bars)

  useImperativeHandle(ref, () => ({
    reset: () => {
      const api = chart.current
      if (!api) return
      api.priceScale('right').applyOptions({ autoScale: true })
      api.timeScale().fitContent()
    },
    exportImage: () => {
      const canvas = chart.current?.takeScreenshot()
      if (!canvas) return
      const link = document.createElement('a')
      link.download = 'cedar-601975-kline.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    },
  }), [])

  useEffect(() => {
    const element = container.current
    if (!element) return
    const colors = chartColors(element)
    const api = createChart(element, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: colors.background }, textColor: colors.text, fontFamily: colors.font, fontSize: 11, attributionLogo: true, panes: { separatorColor: colors.grid, separatorHoverColor: colors.crosshair } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, minimumWidth: 58 },
      timeScale: { borderVisible: false, rightOffset: 4, minBarSpacing: 2, fixLeftEdge: true, timeVisible: false, lockVisibleTimeRangeOnResize: true },
      localization: { locale: 'zh-CN', dateFormat: 'yyyy-MM-dd' },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })
    chart.current = api
    candles.current = api.addSeries(CandlestickSeries)
    lines.current = MA_PERIODS.map(() => api.addSeries(LineSeries, { lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }))
    const hovered = (event: { time?: Time }) => {
      if (!event.time) { onHover(); return }
      const time = typeof event.time === 'string' ? event.time : typeof event.time === 'number' ? new Date(event.time * 1000).toISOString().slice(0, 10) : `${event.time.year}-${String(event.time.month).padStart(2, '0')}-${String(event.time.day).padStart(2, '0')}`
      onHover(currentBars.current.some((bar) => bar.time === time) ? time : undefined)
    }
    api.subscribeCrosshairMove(hovered)
    return () => { api.unsubscribeCrosshairMove(hovered); api.remove(); chart.current = null; histogram.current = null; candles.current = null; lines.current = [] }
  }, [onHover])

  useEffect(() => {
    const api = chart.current
    const element = container.current
    if (!api || !element) return
    currentBars.current = bars
    const colors = chartColors(element)
    api.applyOptions({
      layout: { background: { type: ColorType.Solid, color: colors.background }, textColor: colors.text, panes: { separatorColor: colors.grid, separatorHoverColor: colors.crosshair } },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.grid, style: 2 } },
      crosshair: { vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair }, horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair } },
    })
    candles.current?.applyOptions({ upColor: colors.up, downColor: colors.down, borderVisible: false, wickUpColor: colors.up, wickDownColor: colors.down })
    candles.current?.setData(bars)
    MA_PERIODS.forEach((period, index) => {
      lines.current[index].applyOptions({ color: colors.ma[index], visible: averages.includes(period) })
      lines.current[index].setData(movingAverage(bars, period))
    })
    if (volume) {
      if (!histogram.current) {
        histogram.current = api.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, 1)
        api.panes()[0].setStretchFactor(4)
        api.panes()[1].setStretchFactor(1)
        histogram.current.priceScale().applyOptions({ borderVisible: false, scaleMargins: { top: 0.15, bottom: 0 } })
      }
      histogram.current.setData(bars.map((bar) => ({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? colors.volumeUp : colors.volumeDown })))
    } else if (histogram.current) {
      api.removeSeries(histogram.current)
      histogram.current = null
    }
  }, [bars, averages, volume, theme])

  useEffect(() => {
    const api = chart.current
    const start = rangeStart(bars, range)
    if (!api || !start || !bars.length) return
    const index = bars.findIndex((bar) => bar.time >= start)
    api.timeScale().setVisibleLogicalRange({ from: Math.max(0, index === -1 ? 0 : index) - 1, to: bars.length + 3 })
  }, [bars, range])

  return <div ref={container} data-testid="kline-canvas" role="img" aria-label="招商南油真实 K 线与成交量，支持缩放、拖动和十字光标" className="h-(--kline-height-mobile) w-full min-w-0 sm:h-(--kline-height) group-[:fullscreen]/chart:h-[calc(100dvh-240px)]" />
})
