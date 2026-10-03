import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Surface } from '@/components/design-system/Surface'

interface PageShellProps {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <Surface variant="canvas" className={cn('page-shell', className)}>
      <div className="w-full">{children}</div>
    </Surface>
  )
}
