import { useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { CHANGE_PASSWORD_PATH, safeNext, useAuth, type Role } from '../../lib/auth'
import { ApiError } from '../../lib/api'
import type { Locale } from '../../lib/dictionary'
import { getLocaleFromPath, useLocale } from '../../lib/locale'
import { noIndex } from '../../lib/seo'
import { focusFirstError, validateLogin, type FieldErrors, type LoginInput } from '../../lib/validate'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { PasswordField, TextField } from '../../components/ui/Field'
import '../../styles/auth.css'

export const meta = ({ location }: { location?: { pathname?: string } } = {}) => {
  const locale = getLocaleFromPath(location?.pathname ?? '')
  return noIndex(locale === 'en' ? 'Sign In' : 'Đăng nhập')
}

type Errors = FieldErrors<keyof LoginInput> & { form?: string }

const TEXT = {
  vi: {
    title: 'Đăng nhập',
    intro: 'Dùng tài khoản do Khoa Công nghệ Phần mềm cấp cho sinh viên, giảng viên và cán bộ.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    usernameOrEmail: 'Tên đăng nhập hoặc email',
    usernameOrEmailRequired: 'Nhập tên đăng nhập hoặc email.',
    password: 'Mật khẩu',
    passwordRequired: 'Nhập mật khẩu.',
    submit: 'Đăng nhập',
    submitting: 'Đang đăng nhập',
    help: 'Quên mật khẩu hoặc tài khoản bị khóa? Liên hệ Văn phòng Khoa qua',
    helpAction: 'để được cấp lại.',
  },
  en: {
    title: 'Sign In',
    intro: 'Use your account issued by the Faculty of Software Engineering for students, lecturers, and staff.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    usernameOrEmail: 'Username or email',
    usernameOrEmailRequired: 'Enter username or email.',
    password: 'Password',
    passwordRequired: 'Enter password.',
    submit: 'Sign In',
    submitting: 'Signing in',
    help: 'Forgot password or locked account? Contact the Faculty Office via',
    helpAction: 'for assistance.',
  },
} satisfies Record<Locale, unknown>

// Lỗi chung cho sai tài khoản (FR-AUTH-01): không cho biết tài khoản có tồn tại hay không.
export function loginErrors(err: unknown, locale: Locale = 'vi'): Errors {
  const isEn = locale === 'en'
  if (!(err instanceof ApiError)) {
    return { form: isEn ? 'Cannot connect to server. Check your network and try again.' : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' }
  }
  if (err.status === 400 && err.errors) {
    return { usernameOrEmail: err.field('usernameOrEmail'), password: err.field('password') }
  }
  if (err.status === 401) {
    return { form: isEn ? 'Incorrect username, email, or password.' : 'Tên đăng nhập, email hoặc mật khẩu không đúng.' }
  }
  if (err.status === 429) {
    return { form: isEn ? 'Too many attempts. Please wait a few minutes and try again.' : 'Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.' }
  }
  return { form: isEn ? 'Cannot sign in right now. Please try again later.' : 'Không đăng nhập được lúc này. Vui lòng thử lại sau.' }
}

export function targetFor(
  user: { role: Role; mustChangePassword?: boolean },
  next: string | null,
  locale: Locale = 'vi'
): { to: string; state?: unknown } {
  const homePath = locale === 'en' ? '/en' : '/'
  const HOME: Record<Role, string> = { admin: '/admin', editor: '/admin', student: homePath }

  // Đăng nhập bằng mật khẩu admin cấp: đổi mật khẩu trước, xong quay lại trang định vào.
  if (user.mustChangePassword) {
    const changePasswordPath = locale === 'en' ? '/en/me/password' : CHANGE_PASSWORD_PATH
    const after = targetFor({ role: user.role }, next, locale)
    const forbiddenPath = locale === 'en' ? '/en/403' : '/403'
    return after.to === forbiddenPath ? after : { to: `${changePasswordPath}?next=${encodeURIComponent(after.to)}` }
  }
  if (next) {
    // Sinh viên không có quyền mở /admin: chuyển thẳng về 403 thay vì điều hướng vào admin gây lỗi.
    if ((next.startsWith('/admin') || next.startsWith('/dev/admin')) && user.role === 'student') {
      return { to: locale === 'en' ? '/en/403' : '/403', state: { from: next } }
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
  const locale = useLocale()
  const t = TEXT[locale]
  const next = safeNext(params.get('next'))

  const target = user ? targetFor(user, next, locale) : null
  if (target && !pending) return <Navigate to={target.to} state={target.state} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return // chống submit lặp (Enter nhiều lần khi đang gửi)
    const form = e.currentTarget
    const data = new FormData(form)
    const input = { usernameOrEmail: String(data.get('usernameOrEmail')).trim(), password: String(data.get('password')) }

    const invalid = locale === 'en'
      ? (() => {
          const errs: Errors = {}
          if (!input.usernameOrEmail) errs.usernameOrEmail = t.usernameOrEmailRequired
          if (!input.password) errs.password = t.passwordRequired
          return errs
        })()
      : validateLogin(input)

    setErrors(invalid)
    if (Object.keys(invalid).length) return focusFirstError(form, invalid)

    setPending(true)
    try {
      const u = await login(input.usernameOrEmail, input.password)
      const targetRoute = targetFor(u, next, locale)
      navigate(targetRoute.to, { replace: true, state: targetRoute.state })
    } catch (err) {
      const apiErrors = loginErrors(err, locale)
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
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>

        <form className="auth__card stack" onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
          {sessionExpired && !errors.form && <Alert tone="warning">{t.sessionExpired}</Alert>}
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}

          <fieldset className="auth__fields" disabled={pending}>
            <TextField
              label={t.usernameOrEmail}
              name="usernameOrEmail"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              error={errors.usernameOrEmail}
            />
            <PasswordField label={t.password} name="password" autoComplete="current-password" required error={errors.password} />
          </fieldset>

          <Button type="submit" size="lg" block loading={pending}>{pending ? t.submitting : t.submit}</Button>

          <p className="auth__help">
            {t.help} <a href="mailto:se@uit.edu.vn">se@uit.edu.vn</a> {t.helpAction}
          </p>
        </form>
      </div>
    </div>
  )
}
