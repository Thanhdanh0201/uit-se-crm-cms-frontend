import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../lib/auth'

const HOME = { admin: '/admin', editor: '/editor', student: '/' } as const

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
    <form className="card narrow" onSubmit={onSubmit}>
      <h1>Đăng nhập</h1>
      <label htmlFor="usernameOrEmail">Email hoặc tên đăng nhập</label>
      <input id="usernameOrEmail" name="usernameOrEmail" autoComplete="username" required />
      <label htmlFor="password">Mật khẩu</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
    </form>
  )
}
