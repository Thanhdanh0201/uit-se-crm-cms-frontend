import { useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { CHANGE_PASSWORD_PATH, safeNext, useAuth, type Role } from '../../lib/auth'
import { ApiError } from '../../lib/api'
import { noIndex } from '../../lib/seo'
import { focusFirstError, validateLogin, type FieldErrors, type LoginInput } from '../../lib/validate'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { PasswordField, TextField } from '../../components/ui/Field'
import '../../styles/auth.css'

export const meta = () => noIndex('Đăng nhập')

const HOME: Record<Role, string> = { admin: '/admin', editor: '/admin', student: '/' }

type Errors = FieldErrors<keyof LoginInput> & { form?: string }

// Lỗi chung cho sai tài khoản (FR-AUTH-01): không cho biết tài khoản có tồn tại hay không.
export function loginErrors(err: unknown): Errors {
  if (!(err instanceof ApiError)) return { form: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' }
  if (err.status === 400 && err.errors) {
    return { usernameOrEmail: err.field('usernameOrEmail'), password: err.field('password') }
  }
  if (err.status === 401) return { form: 'Tên đăng nhập, email hoặc mật khẩu không đúng.' }
  if (err.status === 429) return { form: 'Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.' }
  return { form: 'Không đăng nhập được lúc này. Vui lòng thử lại sau.' }
}

function targetFor(user: { role: Role; mustChangePassword?: boolean }, next: string | null): { to: string; state?: unknown } {
  // Đăng nhập bằng mật khẩu admin cấp: đổi mật khẩu trước, xong quay lại trang định vào.
  if (user.mustChangePassword) {
    const after = targetFor({ role: user.role }, next)
    return after.to === '/403' ? after : { to: `${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(after.to)}` }
  }
  if (next) {
    // Sinh viên không có quyền mở /admin: chuyển thẳng về /403 thay vì điều hướng vào admin gây lỗi.
    if ((next.startsWith('/admin') || next.startsWith('/dev/admin')) && user.role === 'student') {
      return { to: '/403', state: { from: next } }
    }
    return { to: next }
  }
  return { to: HOME[user.role] }
}

export default function Login() {
  const { user, login, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const next = safeNext(params.get('next'))

  const target = user ? targetFor(user, next) : null
  if (target && !pending) return <Navigate to={target.to} state={target.state} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return // chống submit lặp (Enter nhiều lần khi đang gửi)
    const form = e.currentTarget
    const data = new FormData(form)
    const input = { usernameOrEmail: String(data.get('usernameOrEmail')).trim(), password: String(data.get('password')) }

    const invalid = validateLogin(input)
    setErrors(invalid)
    if (Object.keys(invalid).length) return focusFirstError(form, invalid)

    setPending(true)
    try {
      const u = await login(input.usernameOrEmail, input.password)
      const t = targetFor(u, next)
      navigate(t.to, { replace: true, state: t.state })
    } catch (err) {
      const apiErrors = loginErrors(err)
      // flushSync: fieldset phải hết disabled trong DOM thì mới focus được.
      flushSync(() => {
        setErrors(apiErrors)
        setPending(false)
      })
      focusFirstError(form, apiErrors)
    }
  }

  return (
    <div className="login-scene">
      <div className="auth auth--scene">
        <div className="auth__intro">
          <h1>Đăng nhập</h1>
          <p className="muted">Dùng tài khoản do Khoa Công nghệ Phần mềm cấp cho sinh viên, giảng viên và cán bộ.</p>
        </div>

        <form className="auth__card stack" onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
          {sessionExpired && !errors.form && <Alert tone="warning">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</Alert>}
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}

          <fieldset className="auth__fields" disabled={pending}>
            <TextField
              label="Tên đăng nhập hoặc email"
              name="usernameOrEmail"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              error={errors.usernameOrEmail}
            />
            <PasswordField label="Mật khẩu" name="password" autoComplete="current-password" required error={errors.password} />
          </fieldset>

          <Button type="submit" size="lg" block loading={pending}>{pending ? 'Đang đăng nhập' : 'Đăng nhập'}</Button>

          <p className="auth__help">
            Quên mật khẩu hoặc tài khoản bị khóa? Liên hệ Văn phòng Khoa qua <a href="mailto:se@uit.edu.vn">se@uit.edu.vn</a> để được cấp lại.
          </p>
        </form>
      </div>
    </div>
  )
}
