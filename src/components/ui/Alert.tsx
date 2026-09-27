import type { ReactNode } from 'react'
import { CheckCircle, Info, Warning, WarningCircle } from '@phosphor-icons/react'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const ICON = { info: Info, success: CheckCircle, warning: Warning, danger: WarningCircle }

export default function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  const Icon = ICON[tone]
  return (
    <div className={`ui-alert ui-alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} weight="fill" aria-hidden />
      <div>
        {title && <p className="ui-alert__title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}
