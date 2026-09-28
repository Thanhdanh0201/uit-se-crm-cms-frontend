import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'

type A11y = { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; required?: boolean }

type FieldProps = {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: (a11y: A11y) => ReactNode
}

// Label ở trên, hint và lỗi ở dưới, id/aria tự nối. Không dùng placeholder thay label.
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={id}>
        {label}
        {required && <span className="ui-required" aria-hidden>*</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {hint && <span id={`${id}-hint`} className="ui-hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="ui-error">{error}</span>}
    </div>
  )
}

type Common = { label: string; hint?: string; error?: string }

export function TextField({ label, hint, error, required, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(a11y) => <input className={`ui-input ${className ?? ''}`} {...a11y} {...rest} />}
    </Field>
  )
}

// Ô mật khẩu có nút hiện/ẩn. autoComplete: "current-password" (đăng nhập, mật khẩu cũ) hoặc "new-password".
export function PasswordField({ label, hint, error, required, className, ...rest }: Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(a11y) => (
        <div className="ui-password">
          <input className={`ui-input ${className ?? ''}`} {...a11y} {...rest} type={visible ? 'text' : 'password'} />
          <button
            type="button"
            className="ui-password__reveal"
            aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeSlash size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      )}
    </Field>
  )
}

export function TextArea({ label, hint, error, required, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(a11y) => <textarea className={`ui-input ${className ?? ''}`} {...a11y} {...rest} />}
    </Field>
  )
}

export function Select({ label, hint, error, required, className, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(a11y) => (
        <select className={`ui-input ${className ?? ''}`} {...a11y} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}

export function Checkbox({ label, ...rest }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className="ui-check">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  )
}
