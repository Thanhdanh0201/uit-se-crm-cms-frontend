import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../lib/auth'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { TextField } from '../../components/ui/Field'
import { noIndex } from '../../lib/seo'

export const meta = () => noIndex('Đăng nhập')

const HOME = { admin: '/admin', editor: '/admin', student: '/' } as const

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (user) return <Navigate to={HOME[user.role]} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError('')
    try {
      const u = await login(String(form.get('usernameOrEmail')), String(form.get('password')))
      navigate(params.get('next') || HOME[u.role], { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '32px auto' }}>
      <Card>
        <form className="stack" onSubmit={onSubmit}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)' }}>Đăng nhập</h1>
            <p className="muted">Dùng tài khoản do Khoa cấp.</p>
          </div>
          <TextField label="Email hoặc tên đăng nhập" name="usernameOrEmail" autoComplete="username" required />
          <TextField label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" block loading={pending}>{pending ? 'Đang đăng nhập' : 'Đăng nhập'}</Button>
        </form>
      </Card>
    </div>
  )
}
