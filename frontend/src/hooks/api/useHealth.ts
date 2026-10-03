import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet } from '@/api/client'
const healthSchema = z.object({ status: z.literal('ok'), service: z.string(), revision: z.string() })
const readinessSchema = z.object({ status: z.literal('ok'), database: z.literal('connected') })
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async ({ signal }) => healthSchema.parse(await apiGet('/health', undefined, signal)),
    staleTime: 15_000,
  })
}
export function useReadiness() {
  return useQuery({
    queryKey: ['readiness'],
    queryFn: async ({ signal }) => readinessSchema.parse(await apiGet('/ready', undefined, signal)),
    staleTime: 15_000,
  })
}
