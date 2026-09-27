import type { ReactNode } from 'react'
import { Tray } from '@phosphor-icons/react'

// Ba trạng thái mọi danh sách cần có: đang tải (Skeleton), rỗng (EmptyState), lỗi (Alert).

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-empty">
      <span className="ui-empty__icon" aria-hidden>{icon ?? <Tray size={24} />}</span>
      <h3 className="ui-empty__title">{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  )
}

export function Skeleton({ lines = 3, width = '100%', height }: { lines?: number; width?: string; height?: number }) {
  return (
    <div className="ui-skeleton-group" role="status" aria-label="Đang tải">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="ui-skeleton" style={{ width: i === lines - 1 && lines > 1 ? '60%' : width, height }} />
      ))}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header__text">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </div>
  )
}
