// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Users, { type UserRow } from './Users'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const U = (id: string, fullName: string, username: string, role: UserRow['role'] = 'student'): UserRow => ({ id, email: `${username}@gm.uit.edu.vn`, username, fullName, role, isActive: true, createdAt: '2026-10-11T02:00:00Z' })
const ME = U('me', 'Quản trị Khoa', 'admin.khoa', 'admin')
const AN = U('u2', 'Trần Minh An', '24520100')
const HA = U('u3', 'Lê Thu Hà', 'ha.le', 'editor')
const base = {
  '/api/auth/me': () => ok({ id: 'me', username: ME.username, fullName: ME.fullName, role: 'admin', email: ME.email }),
  '/api/admin/users': () => ok({ items: [ME, AN, HA], totalItems: 3, page: 1, pageSize: 10, totalPages: 1 }),
}
const open = () => renderPage('/admin/users', '/admin/users', <App><Users /></App>)
const hasData = () => reply(409, { title: 'Tài khoản đã có dữ liệu', status: 409, code: 'user_has_data', detail: '"Lê Thu Hà" đã có 3 bài viết trong hệ thống. Khóa tài khoản thay vì xóa để giữ lịch sử.', usage: { posts: 3 } })

test('không xóa được chính mình: nút xóa và ô chọn bị khóa', async () => {
  mockApi(base)
  open()
  expect(((await screen.findByLabelText('Không thể xóa tài khoản của chính mình')) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByLabelText('Chọn Quản trị Khoa') as HTMLInputElement).disabled).toBe(true)
})

test('xóa một tài khoản: xác nhận rồi gọi DELETE, tải lại danh sách', async () => {
  let loads = 0
  const api = mockApi({ ...base, '/api/admin/users': () => (loads++, base['/api/admin/users']()), '/api/admin/users/u2': () => ok(undefined, 'Đã xóa tài khoản.') })
  open()
  await userEvent.click(await screen.findByLabelText('Xóa Trần Minh An'))
  const pop = (await screen.findByText('Xóa tài khoản Trần Minh An?')).closest('.ant-popover')! as HTMLElement
  await userEvent.click(within(pop).getByText('Xóa').closest('button')!)
  await waitFor(() => expect(api.calls('/api/admin/users/u2').filter(([, i]) => i?.method === 'DELETE')).toHaveLength(1))
  expect(await screen.findByText('Đã xóa tài khoản Trần Minh An.')).toBeTruthy()
  await waitFor(() => expect(loads).toBe(2))
})

test('tài khoản đã có dữ liệu: hiện lý do của server, gợi ý khóa', async () => {
  mockApi({ ...base, '/api/admin/users/u3': hasData })
  open()
  await userEvent.click(await screen.findByLabelText('Xóa Lê Thu Hà'))
  const pop = (await screen.findByText('Xóa tài khoản Lê Thu Hà?')).closest('.ant-popover')! as HTMLElement
  await userEvent.click(within(pop).getByText('Xóa').closest('button')!)
  expect(await screen.findByText(/Khóa tài khoản thay vì xóa/)).toBeTruthy()
})

test('xóa nhiều tài khoản đã chọn: xóa được thì xóa, cái bị từ chối liệt kê kèm lý do', async () => {
  const api = mockApi({ ...base, '/api/admin/users/u2': () => ok(undefined), '/api/admin/users/u3': hasData })
  open()
  await userEvent.click(await screen.findByLabelText('Chọn Trần Minh An'))
  await userEvent.click(screen.getByLabelText('Chọn Lê Thu Hà'))
  expect(await screen.findByText('Đã chọn 2 tài khoản')).toBeTruthy()

  await userEvent.click(screen.getByText('Xóa 2 tài khoản').closest('button')!)
  const confirm = (await screen.findAllByText('Xóa 2 tài khoản đã chọn?')).at(-1)!.closest('.ant-modal')! as HTMLElement
  await userEvent.click(within(confirm).getByText('Xóa').closest('button')!)

  expect((await screen.findAllByText('Đã xóa 1/2 tài khoản')).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/đã có 3 bài viết/).length).toBeGreaterThan(0)
  expect(api.calls('/api/admin/users/u2').filter(([, i]) => i?.method === 'DELETE')).toHaveLength(1)
  expect(api.calls('/api/admin/users/u3').filter(([, i]) => i?.method === 'DELETE')).toHaveLength(1)
})
