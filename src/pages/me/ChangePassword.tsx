import { useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { RequireRole, safeNext, useAuth } from '../../lib/auth'
import { api, ApiError } from '../../lib/api'
import { noIndex } from '../../lib/seo'
import { focusFirstError, PASSWORD_MIN_LENGTH, validateChangePassword, type ChangePasswordInput, type FieldErrors } from '../../lib/validate'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { PasswordField } from '../../components/ui/Field'
import '../../styles/auth.css'

export const meta = () => noIndex('Đổi mật khẩu')

type Errors = FieldErrors<keyof ChangePasswordInput> & { form?: string }

// 400 validation (kể cả "Mật khẩu hiện tại không chính xác" ở errors.CurrentPassword) hiện dưới từng field.
// 401 đã được api.ts xử lý (refresh, hết phiên thì đưa về trang đăng nhập).
export function changePasswordErrors(err: unknown): Errors {
  if (!(err instanceof ApiError)) return { form: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' }
  if (err.status === 400 && err.errors) {
    return {
      currentPassword: err.field('currentPassword'),
      newPassword: err.field('newPassword'),
      confirmNewPassword: err.field('confirmNewPassword'),
    }
  }
  if (err.status === 400) return { form: err.message }
  if (err.status === 401) return { form: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }
  return { form: 'Không đổi được mật khẩu lúc này. Vui lòng thử lại sau.' }
}

function ChangePasswordForm() {
  const { user, passwordChanged } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Đang dùng mật khẩu admin cấp: đổi xong mới vào được các trang khác.
  const required = user?.mustChangePassword === true
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return // chống submit lặp
    const form = e.currentTarget
    const data = new FormData(form)
    const input: ChangePasswordInput = {
      currentPassword: String(data.get('currentPassword')),
      newPassword: String(data.get('newPassword')),
      confirmNewPassword: String(data.get('confirmNewPassword')),
    }

    setDone(false)
    const invalid = validateChangePassword(input)
    setErrors(invalid)
    if (Object.keys(invalid).length) return focusFirstError(form, invalid)

    setPending(true)
    try {
      // Backend xác thực lại bằng currentPassword trước khi đổi (FR-AUTH-05).
      await api('/api/auth/change-password', { method: 'POST', json: input })
      form.reset()
      if (required) {
        passwordChanged()
        // Đổi lần đầu xong: vào trang định vào lúc đăng nhập.
        navigate(safeNext(params.get('next')) ?? (user?.role === 'student' ? '/me' : '/admin'), { replace: true, state: { passwordChanged: true } })
        return
      }
      setDone(true)
      setPending(false)
    } catch (err) {
      const apiErrors = changePasswordErrors(err)
      // flushSync: fieldset phải hết disabled trong DOM thì mới focus được.
      flushSync(() => {
        setErrors(apiErrors)
        setPending(false)
      })
      focusFirstError(form, apiErrors)
    }
  }

  return (
    <form className="auth__card stack" onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
      {required && (
        <Alert tone="warning" title="Bạn cần đổi mật khẩu trước khi tiếp tục.">
          Mật khẩu hiện tại do quản trị viên cấp. Đặt mật khẩu mới chỉ mình bạn biết.
        </Alert>
      )}
      {done && <Alert tone="success" title="Đổi mật khẩu thành công.">Lần đăng nhập sau, dùng mật khẩu mới.</Alert>}
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <fieldset className="auth__fields" disabled={pending}>
        <PasswordField label="Mật khẩu hiện tại" name="currentPassword" autoComplete="current-password" required autoFocus error={errors.currentPassword} />
        <PasswordField
          label="Mật khẩu mới"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          hint={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, khác mật khẩu hiện tại.`}
          error={errors.newPassword}
        />
        <PasswordField label="Nhập lại mật khẩu mới" name="confirmNewPassword" autoComplete="new-password" required error={errors.confirmNewPassword} />
      </fieldset>

      <Button type="submit" size="lg" block loading={pending}>{pending ? 'Đang đổi mật khẩu' : 'Đổi mật khẩu'}</Button>
      {!required && <p className="auth__help"><Link to="/me">Về tài khoản của tôi</Link></p>}
    </form>
  )
}

export default function ChangePassword() {
  return (
    <RequireRole roles={['student', 'editor', 'admin']}>
      <div className="auth">
        <div className="auth__intro">
          <h1>Đổi mật khẩu</h1>
          <p className="muted">Nhập mật khẩu hiện tại để xác nhận đây là bạn.</p>
        </div>
        <ChangePasswordForm />
      </div>
    </RequireRole>
  )
}
