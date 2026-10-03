import { Surface } from '@/components/design-system'
import { cn } from '@/lib/utils'
export interface ConnectionState { connected: boolean; loading: boolean; error?: string }
interface StatusCardProps { id: string; eyebrow: string; title: string; successText: string; state: ConnectionState }
export function StatusCard({ id, eyebrow, title, successText, state }: StatusCardProps) {
  return (
    <Surface bordered rounded="xl" className="connection-card">
      <p className="eyebrow">{eyebrow}</p><h2>{title}</h2>
      <p id={id} role="status" aria-live="polite" className={cn('connection-status', state.connected && 'text-accent', state.error && 'text-error')}>
        {state.loading ? '正在连接…' : state.connected ? successText : '暂时无法连接'}
      </p>
      {state.error && <p className="mt-2 text-sm text-text-muted">{state.error}</p>}
    </Surface>
  )
}
