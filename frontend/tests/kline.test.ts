import { describe, expect, test } from 'bun:test'
import { aggregateCandles, movingAverage, type Candle } from '../src/lib/kline'
const bar = (time: string, open: number, close: number, preClose: number): Candle => ({ time, open, close, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, preClose, pctChange: (close / preClose - 1) * 100, volume: 100, amount: 1000 })
describe('daily history aggregation', () => {
  const data = [bar('2026-09-25', 10, 11, 10), bar('2026-09-28', 12, 13, 11), bar('2026-09-30', 13, 12, 13), bar('2026-10-08', 12, 14, 12)]
  test('weeks respect Monday boundaries and retain real first trading dates', () => {
    const weeks = aggregateCandles(data, 'week')
    expect(weeks.map((candle) => candle.time)).toEqual(['2026-09-25', '2026-09-28', '2026-10-08'])
    expect(weeks[1]).toMatchObject({ open: 12, close: 12, high: 14, low: 11, volume: 200, amount: 2000, preClose: 11 })
    expect(weeks[1].pctChange).toBeCloseTo((12 / 11 - 1) * 100)
  })
  test('month rollup preserves OHLC and totals without fabricating holiday bars', () => {
    expect(aggregateCandles(data, 'month')).toHaveLength(2)
    expect(aggregateCandles(data, 'month')[0]).toMatchObject({ time: '2026-09-25', open: 10, close: 12, high: 14, low: 9, volume: 300 })
    expect(data[0].volume).toBe(100)
  })
  test('moving averages use only the trailing history and require a full window', () => {
    expect(movingAverage(data, 3)).toEqual([{ time: '2026-09-30', value: 12 }, { time: '2026-10-08', value: 13 }])
    expect(movingAverage(data.slice(0, 2), 3)).toEqual([])
    expect(() => movingAverage(data, 0)).toThrow()
  })
})

test('missing reference prices and amounts remain missing in aggregate bars', () => {
  const first = { ...bar('2026-09-28', 12, 13, 11), preClose: null, pctChange: null, amount: null }
  const second = bar('2026-09-30', 13, 12, 13)
  expect(aggregateCandles([first, second], 'week')[0]).toMatchObject({ preClose: null, pctChange: null, amount: null, volume: 200 })
})
