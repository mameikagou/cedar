import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  statusSummary?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  statusSummary,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-3xl space-y-2">
        {eyebrow && (
          <div className="eyebrow">
            {eyebrow}
          </div>
        )}
        <div className="space-y-1">
          <h1 className="page-title">
            {title}
          </h1>
          {description && (
            <p className="page-description">
              {description}
            </p>
          )}
        </div>
        {statusSummary && <div className="text-sm text-text-secondary">{statusSummary}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
