import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { safeNext, useAuth, type Role } from '../../lib/auth'
import { ApiError } from '../../lib/api'
import { noIndex } from '../../lib/seo'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { Field, TextField } from '../../components/ui/Field'
import './login.css'

export const meta = () => noIndex('Đăng nhập')

const HOME: Record<Role, string> = { admin: '/admin', editor: '/admin', student: '/' }

type Errors = { form?: string; usernameOrEmail?: string; password?: string }

// Lỗi chung cho sai tài khoản (FR-AUTH-01): không cho biết tài khoản có tồn tại hay không,
// và không hiện message 401 của backend (có message lộ thông tin cấu hình server).
export function loginErrors(err: unknown): Errors {
  if (!(err instanceof ApiError)) return { form: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' }
  if (err.status === 400 && err.errors) {
    return { usernameOrEmail: err.field('usernameOrEmail'), password: err.field('password') }
  }
  if (err.status === 401) return { form: 'Tên đăng nhập, email hoặc mật khẩu không đúng.' }
  if (err.status === 429) return { form: 'Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.' }
  return { form: 'Không đăng nhập được lúc này. Vui lòng thử lại sau.' }
}

export default function Login() {
  const { user, login, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const next = safeNext(params.get('next'))

  if (user) return <Navigate to={next ?? HOME[user.role]} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setErrors({})
    try {
      const u = await login(String(form.get('usernameOrEmail')).trim(), String(form.get('password')))
      navigate(next ?? HOME[u.role], { replace: true })
    } catch (err) {
      setErrors(loginErrors(err))
      setPending(false)
    }
  }

  return (
    <div className="login">
      <div className="login__intro">
        <h1>Đăng nhập</h1>
        <p className="muted">Dùng tài khoản do Khoa Công nghệ Phần mềm cấp cho sinh viên, giảng viên và cán bộ.</p>
      </div>

      <form className="login__card stack" onSubmit={onSubmit}>
        {sessionExpired && !errors.form && <Alert tone="warning">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</Alert>}
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}

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

        <Field label="Mật khẩu" required error={errors.password}>
          {(a11y) => (
            <div className="login__password">
              <input
                {...a11y}
                className="ui-input"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login__reveal"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? <EyeSlash size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" block loading={pending}>{pending ? 'Đang đăng nhập' : 'Đăng nhập'}</Button>

        <p className="login__help">
          Quên mật khẩu hoặc tài khoản bị khóa? Liên hệ Văn phòng Khoa qua <a href="mailto:se@uit.edu.vn">se@uit.edu.vn</a> để được cấp lại.
        </p>
      </form>
    </div>
  )
}
