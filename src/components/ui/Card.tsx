import type { ReactNode } from 'react'

type Props = {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

// Chỉ dùng card khi cần tách lớp nội dung thật; nhóm đơn giản thì dùng khoảng trắng.
export default function Card({ title, actions, children, className }: Props) {
  return (
    <section className={`ui-card ${className ?? ''}`}>
      {(title || actions) && (
        <header className="ui-card__header">
          {title && <h2 className="ui-card__title">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  )
}
