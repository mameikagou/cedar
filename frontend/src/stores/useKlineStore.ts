import { create } from 'zustand'
import type { ChartRange, MovingAveragePeriod, Period } from '@/lib/kline'
interface KlineSettings {
  period: Period
  range: ChartRange
  averages: MovingAveragePeriod[]
  volume: boolean
  setPeriod: (period: Period) => void
  setRange: (range: ChartRange) => void
  toggleAverage: (period: MovingAveragePeriod) => void
  toggleVolume: () => void
}
export const useKlineStore = create<KlineSettings>((set) => ({
  period: 'day', range: '6M', averages: [5, 10, 20], volume: true,
  setPeriod: (period) => set({ period }),
  setRange: (range) => set({ range }),
  toggleAverage: (period) => set((state) => ({ averages: state.averages.includes(period) ? state.averages.filter((value) => value !== period) : [...state.averages, period] })),
  toggleVolume: () => set((state) => ({ volume: !state.volume })),
}))
