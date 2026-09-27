import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CircleNotch } from '@phosphor-icons/react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Dùng cho <Link> cần trông như nút: <Link className={buttonClass('secondary')}>
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', block = false) {
  return `ui-btn ui-btn--${variant} ui-btn--${size}${block ? ' ui-btn--block' : ''}`
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

// Nút chỉ có icon: bắt buộc truyền aria-label (và title để hiện tooltip).
export default function Button({ variant, size, block, loading, icon, className, disabled, type = 'button', children, ...rest }: Props) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant, size, block)}${children ? '' : ' ui-btn--icon'} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <CircleNotch size={16} className="ui-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
