// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AuthProvider, useAuth } from './auth'
import { deferred, mockApi, ok } from './test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Account() {
  const { user, loading, logout, loggingOut } = useAuth()
  if (loading) return <p>Đang tải</p>
  return user ? (
    <button type="button" onClick={logout} disabled={loggingOut}>Đăng xuất {user.email}</button>
  ) : (
    <p>Khách</p>
  )
}

// Mỗi AuthProvider giả lập một tab trình duyệt.
const tab = (name: string) => (
  <section aria-label={name}>
    <MemoryRouter>
      <AuthProvider>
        <Account />
      </AuthProvider>
    </MemoryRouter>
  </section>
)

test('đăng xuất: bấm lặp chỉ gọi API một lần, xóa phiên ở tab này và tab khác', async () => {
  const pending = deferred<Response>()
  const api = mockApi({
    '/api/auth/me': () => ok({ id: 'u1', username: 'gv', fullName: 'Lê Thu Hà', role: 'admin', email: 'gv@uit.edu.vn' }),
    '/api/auth/logout': () => pending.promise,
  })
  render(
    <>
      {tab('Tab A')}
      {tab('Tab B')}
    </>,
  )
  const tabA = within(screen.getByRole('region', { name: 'Tab A' }))
  const tabB = within(screen.getByRole('region', { name: 'Tab B' }))

  const button = await tabA.findByRole('button', { name: /Đăng xuất/ })
  await tabB.findByRole('button', { name: /Đăng xuất/ })
  await userEvent.click(button)
  await userEvent.click(button)
  expect(api.calls('/api/auth/logout')).toHaveLength(1)

  pending.resolve(ok(undefined, 'Đăng xuất thành công.'))
  expect(await tabA.findByText('Khách')).toBeTruthy()
  await waitFor(() => expect(tabB.getByText('Khách')).toBeTruthy())
})

test('đăng xuất khi mạng lỗi: vẫn về trạng thái khách', async () => {
  mockApi({
    '/api/auth/me': () => ok({ id: 'u1', username: 'sv', fullName: 'Trần Minh An', role: 'student', email: 'sv@gm.uit.edu.vn' }),
    '/api/auth/logout': () => Promise.reject(new TypeError('Failed to fetch')),
  })
  render(tab('Tab A'))
  await userEvent.click(await screen.findByRole('button', { name: /Đăng xuất/ }))
  expect(await screen.findByText('Khách')).toBeTruthy()
})
