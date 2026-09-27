import { useEffect, useId, useRef, type ReactNode } from 'react'
import Button from './Button'

type Props = {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Xác nhận trước thao tác phá hủy (xóa mềm, khóa tài khoản, lưu trữ bài). Dùng <dialog> gốc: focus trap và Esc có sẵn.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (!loading) onCancel()
      }}
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <div className="ui-dialog__body">
        <h2 id={titleId} className="ui-dialog__title">{title}</h2>
        {children && <div className="muted">{children}</div>}
      </div>
      <div className="ui-dialog__actions">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </dialog>
  )
}
