import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet } from '@/api/client'
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const candleSchema = z.object({
  time: dateSchema, open: z.number().positive(), high: z.number().positive(),
  low: z.number().positive(), close: z.number().positive(), preClose: z.number().positive().nullable(),
  pctChange: z.number().nullable(), volume: z.number().nonnegative(), amount: z.number().nonnegative().nullable(),
})
const snapshotSchema = z.object({
  symbol: z.literal('601975.SH'), name: z.string(), source: z.literal('analyze2quant 数据湖'), sourceDataset: z.string(), sourceVersion: z.string().uuid(), sourcePublishedAt: z.string().datetime({ offset: true }),
  adjustment: z.literal('none'), currency: z.literal('CNY'), volumeUnit: z.literal('share'),
  amountUnit: z.literal('CNY'), latestTradingDate: dateSchema, syncedAt: z.string().datetime({ offset: true }),
  stale: z.boolean(), candles: z.array(candleSchema).min(1),
})
export type KlineSnapshot = z.infer<typeof snapshotSchema>
export function useKline() {
  return useQuery({
    queryKey: ['market', 'kline', '601975.SH'],
    queryFn: async ({ signal }) => snapshotSchema.parse(await apiGet('/market/kline', undefined, signal, 20000)),
    staleTime: 5 * 60_000, refetchInterval: 15 * 60_000, retry: 1,
  })
}
