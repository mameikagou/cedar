import { PageTransition } from '@/components/design-system'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { PageShell } from '@/components/ui/page-shell'
import { Button } from '@/components/ui/button'
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <PageTransition><Outlet /></PageTransition>,
  errorComponent: ({ reset }) => (
    <PageShell><h1 className="font-serif text-3xl">页面暂时无法加载</h1><Button variant="outline" onClick={reset}>重试</Button></PageShell>
  ),
  notFoundComponent: () => (
    <PageShell><h1 className="font-serif text-3xl">页面未找到</h1><Button asChild variant="outline"><a href="/">回到首页</a></Button></PageShell>
  ),
})
