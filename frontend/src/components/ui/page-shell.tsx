import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Surface } from '@/components/design-system/Surface'

interface PageShellProps {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <Surface variant="canvas" className={cn('mx-auto w-[min(960px,calc(100%-36px))] py-12 sm:py-18', className)}>
      <div className="w-full">{children}</div>
    </Surface>
  )
}
