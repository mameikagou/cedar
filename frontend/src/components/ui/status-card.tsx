import { Surface } from '@/components/design-system'
import { cn } from '@/lib/utils'
export interface ConnectionState { connected: boolean; loading: boolean; error?: string }
interface StatusCardProps { id: string; eyebrow: string; title: string; successText: string; state: ConnectionState }
export function StatusCard({ id, eyebrow, title, successText, state }: StatusCardProps) {
  return (
    <Surface bordered rounded="xl" className="p-6">
      <p className="text-xs font-bold tracking-widest text-accent">{eyebrow}</p><h2 className="my-4 font-serif text-2xl font-medium">{title}</h2>
      <p id={id} role="status" aria-live="polite" className={cn('text-text-muted', state.connected && 'text-accent', state.error && 'text-error')}>
        {state.loading ? '正在连接…' : state.connected ? successText : '暂时无法连接'}
      </p>
      {state.error && <p className="mt-2 text-sm text-text-muted">{state.error}</p>}
    </Surface>
  )
}
