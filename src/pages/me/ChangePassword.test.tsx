// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangePassword from './ChangePassword'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const loggedIn = { '/api/auth/me': () => ok({ id: 'u1', username: 'sv24520264', fullName: 'Trần Minh An', role: 'student', email: 'sv24520264@gm.uit.edu.vn' }) }

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(await screen.findByLabelText(/^Mật khẩu hiện tại/), current)
  await userEvent.type(screen.getByLabelText(/^Mật khẩu mới/), next)
  await userEvent.type(screen.getByLabelText(/^Nhập lại mật khẩu mới/), confirm)
  await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
}

test('chưa đăng nhập thì chuyển sang trang đăng nhập, giữ đường quay lại', async () => {
  mockApi({ '/api/auth/me': () => reply(401), '/api/auth/refresh': () => reply(401) })
  renderPage('/me/password', '/me/password', <ChangePassword />)
  await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/login?next=%2Fme%2Fpassword'))
})

test('validate trước khi gửi: nhập lại không khớp thì không gọi API', async () => {
  const api = mockApi(loggedIn)
  renderPage('/me/password', '/me/password', <ChangePassword />)
  await fill('mat-khau-cu', 'mat-khau-moi', 'mat-khau-khac')

  expect(screen.getByText('Mật khẩu nhập lại không khớp với mật khẩu mới.')).toBeTruthy()
  expect(api.calls('/api/auth/change-password')).toHaveLength(0)
})

test('reauth thất bại (400 CurrentPassword): lỗi dưới ô mật khẩu hiện tại, không bị đăng xuất', async () => {
  const api = mockApi({
    ...loggedIn,
    '/api/auth/change-password': () => reply(400, { title: 'One or more validation errors occurred.', errors: { CurrentPassword: ['Mật khẩu hiện tại không chính xác.'] } }),
  })
  renderPage('/me/password', '/me/password', <ChangePassword />)
  await fill('mat-khau-sai', 'mat-khau-moi', 'mat-khau-moi')

  const current = screen.getByLabelText(/^Mật khẩu hiện tại/)
  expect(await screen.findByText('Mật khẩu hiện tại không chính xác.')).toBeTruthy()
  expect(current.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(current)
  expect(api.calls('/api/auth/refresh')).toHaveLength(0)
  expect(screen.queryByTestId('path')).toBeNull() // vẫn ở trang đổi mật khẩu
})

test('thành công: báo thành công và xóa trắng form', async () => {
  const api = mockApi({ ...loggedIn, '/api/auth/change-password': () => ok(undefined, 'Đổi mật khẩu thành công.') })
  renderPage('/me/password', '/me/password', <ChangePassword />)
  await fill('mat-khau-cu', 'mat-khau-moi', 'mat-khau-moi')

  expect(await screen.findByText('Đổi mật khẩu thành công.')).toBeTruthy()
  expect((screen.getByLabelText(/^Mật khẩu hiện tại/) as HTMLInputElement).value).toBe('')
  const [, init] = api.calls('/api/auth/change-password')[0]
  expect(JSON.parse(String(init?.body))).toEqual({ currentPassword: 'mat-khau-cu', newPassword: 'mat-khau-moi', confirmNewPassword: 'mat-khau-moi' })
})

test('bắt đổi mật khẩu lần đầu: hiện lý do, đổi xong vào trang định vào và không bị chặn nữa', async () => {
  const api = mockApi({
    '/api/auth/me': () => ok({ id: 'u1', username: '24520264', fullName: 'Trần Minh An', role: 'student', email: '24520264@gm.uit.edu.vn', mustChangePassword: true }),
    '/api/auth/change-password': () => ok(undefined, 'Đổi mật khẩu thành công.'),
  })
  renderPage('/me/password?next=%2Fme', '/me/password', <ChangePassword />)
  expect(await screen.findByText('Bạn cần đổi mật khẩu trước khi tiếp tục.')).toBeTruthy()
  expect(screen.queryByText('Về tài khoản của tôi')).toBeNull()

  await fill('Uit@24520264', 'MatKhauMoi#2026', 'MatKhauMoi#2026')
  await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/me'))
  expect(api.calls('/api/auth/change-password')).toHaveLength(1)
})
