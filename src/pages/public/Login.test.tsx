// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './Login'
import { deferred, mockApi, ok, renderPage, reply } from '../../lib/test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const guest = { '/api/auth/me': () => reply(401), '/api/auth/refresh': () => reply(401) }
const user = { id: 'u1', username: 'sv24520264', fullName: 'Nguyễn Minh Anh', role: 'Student', email: 'sv24520264@gm.uit.edu.vn' }

test('validate trước khi gửi: trống thì báo lỗi, không gọi API, focus ô đầu tiên', async () => {
  const api = mockApi(guest)
  renderPage('/login', '/login', <Login />)
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect(screen.getByText('Nhập tên đăng nhập hoặc email.')).toBeTruthy()
  expect(screen.getByText('Nhập mật khẩu.')).toBeTruthy()
  expect(api.calls('/api/auth/login')).toHaveLength(0)
  expect(document.activeElement).toBe(screen.getByLabelText(/Tên đăng nhập hoặc email/))
})

test('đang gửi: nút và ô nhập bị khóa, bấm lặp chỉ gửi một request', async () => {
  const pending = deferred<Response>()
  const api = mockApi({ ...guest, '/api/auth/login': () => pending.promise })
  renderPage('/login?next=/me/password', '/login', <Login />)

  await userEvent.type(screen.getByLabelText(/Tên đăng nhập hoặc email/), 'sv24520264')
  await userEvent.type(screen.getByLabelText(/^Mật khẩu/), 'mat-khau-dung')
  const submit = screen.getByRole('button', { name: 'Đăng nhập' })
  await userEvent.click(submit)
  await userEvent.click(submit)
  await userEvent.keyboard('{Enter}')

  expect(api.calls('/api/auth/login')).toHaveLength(1)
  expect(screen.getByRole('button', { name: /Đang đăng nhập/ }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByLabelText(/Tên đăng nhập hoặc email/).closest('fieldset')?.disabled).toBe(true)

  pending.resolve(ok({ accessToken: 'x', expiresIn: 3600, user }, 'Đăng nhập thành công.'))
  await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/me/password'))
})

test('sai mật khẩu: hiện lỗi chung, mở khóa form để nhập lại', async () => {
  mockApi({ ...guest, '/api/auth/login': () => reply(401, { message: 'Không thể tra cứu email... ServiceRoleSecret' }) })
  renderPage('/login', '/login', <Login />)

  await userEvent.type(screen.getByLabelText(/Tên đăng nhập hoặc email/), 'sv24520264')
  await userEvent.type(screen.getByLabelText(/^Mật khẩu/), 'sai')
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect((await screen.findByRole('alert')).textContent).toBe('Tên đăng nhập, email hoặc mật khẩu không đúng.')
  expect(screen.queryByText(/ServiceRoleSecret/)).toBeNull()
  expect(screen.getByLabelText(/Tên đăng nhập hoặc email/).closest('fieldset')?.disabled).toBe(false)
})

test('lỗi validation từ API: gắn vào field và focus field đó', async () => {
  mockApi({ ...guest, '/api/auth/login': () => reply(400, { title: 'One or more validation errors occurred.', errors: { Password: ['Mật khẩu không được để trống.'] } }) })
  renderPage('/login', '/login', <Login />)
  await userEvent.type(screen.getByLabelText(/Tên đăng nhập hoặc email/), 'sv24520264')
  await userEvent.type(screen.getByLabelText(/^Mật khẩu/), 'x')
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect(await screen.findByText('Mật khẩu không được để trống.')).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByLabelText(/^Mật khẩu/))
})

test('sinh viên đăng nhập khi next là trang admin: chuyển về /403 thay vì văng vào admin', async () => {
  mockApi({ ...guest, '/api/auth/login': () => ok({ accessToken: 'x', expiresIn: 3600, user }, 'Đăng nhập thành công.') })
  renderPage('/login?next=/admin/users', '/login', <Login />)

  await userEvent.type(screen.getByLabelText(/Tên đăng nhập hoặc email/), 'sv24520264')
  await userEvent.type(screen.getByLabelText(/^Mật khẩu/), 'mat-khau-dung')
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/403'))
})

