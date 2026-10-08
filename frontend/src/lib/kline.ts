export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  preClose: number | null
  pctChange: number | null
  amount: number | null
}
export type Period = 'day' | 'week' | 'month'
export type ChartRange = '1M' | '3M' | '6M' | 'ALL'
export const MA_PERIODS = [5, 10, 20] as const
export type MovingAveragePeriod = typeof MA_PERIODS[number]

export function aggregateCandles(data: readonly Candle[], period: Period): Candle[] {
  if (period === 'day') return data.map((bar) => ({ ...bar }))
  const groups = new Map<string, Candle>()
  for (const bar of data) {
    const date = new Date(`${bar.time}T00:00:00Z`)
    if (period === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
    const key = period === 'month' ? bar.time.slice(0, 7) : date.toISOString().slice(0, 10)
    const previous = groups.get(key)
    if (!previous) groups.set(key, { ...bar })
    else {
      previous.high = Math.max(previous.high, bar.high)
      previous.low = Math.min(previous.low, bar.low)
      previous.close = bar.close
      previous.volume += bar.volume
      previous.amount = previous.amount === null || bar.amount === null ? null : previous.amount + bar.amount
      previous.pctChange = previous.preClose ? (previous.close / previous.preClose - 1) * 100 : null
    }
  }
  return [...groups.values()]
}

export function movingAverage(data: readonly Candle[], period: number) {
  if (!Number.isInteger(period) || period < 1) throw new Error('均线周期必须为正整数')
  let sum = 0
  const result: { time: string; value: number }[] = []
  data.forEach((bar, index) => {
    sum += bar.close
    if (index >= period) sum -= data[index - period].close
    if (index >= period - 1) result.push({ time: bar.time, value: sum / period })
  })
  return result
}

export function rangeStart(data: readonly Candle[], range: ChartRange): string | undefined {
  if (!data.length) return undefined
  if (range === 'ALL') return data[0].time
  const date = new Date(`${data.at(-1)!.time}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() - Number.parseInt(range))
  return date.toISOString().slice(0, 10)
}

export function formatVolume(value: number): string {
  return value >= 100_000_000 ? `${(value / 100_000_000).toFixed(2)} 亿` : `${(value / 10_000).toFixed(2)} 万`
}
