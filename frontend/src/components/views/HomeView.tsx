import { Moon, Sun } from 'lucide-react'
import { PageShell } from '@/components/ui/page-shell'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { StatusCard, type ConnectionState } from '@/components/ui/status-card'
import { useTheme } from '@/hooks/interaction/useTheme'
interface HomeViewProps {
  service: ConnectionState
  database: ConnectionState
  refreshing: boolean
  onRefresh: () => void
}
export function HomeView({ service, database, refreshing, onRefresh }: HomeViewProps) {
  const { theme, toggle } = useTheme()
  return (
    <PageShell>
      <PageHeader eyebrow="CEDAR" title="从这里开始。" description="Cedar 已准备好，接下来一起把想法做出来。" />
      <section aria-label="连接状态" className="mt-10 mb-6 grid gap-4 sm:grid-cols-2">
        <StatusCard id="api-status" eyebrow="SERVICE" title="服务连接" successText="服务已连接" state={service} />
        <StatusCard id="database-status" eyebrow="DATABASE" title="数据连接" successText="数据库已连接" state={database} />
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={refreshing} onClick={onRefresh}>{refreshing ? '正在检查…' : '刷新连接状态'}</Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </Button>
      </div>
    </PageShell>
  )
}
