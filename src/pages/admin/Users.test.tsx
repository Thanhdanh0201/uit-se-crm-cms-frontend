// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Users, { usersQuery, type UserRow } from './Users'
import { ok, renderPage, reply } from '../../lib/test-utils'

beforeAll(() => {
  // antd dùng matchMedia (responsive) và ResizeObserver (Table, Select); jsdom không có sẵn.
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

const ME: UserRow = { id: 'me', email: 'admin@uit.edu.vn', username: 'admin.khoa', fullName: 'Lê Thu Hà', role: 'admin', isActive: true, createdAt: '2026-09-01T02:00:00Z' }
const AN: UserRow = { id: 'u2', email: 'an24520100@gm.uit.edu.vn', username: 'an24520100', fullName: 'Trần Minh An', role: 'student', isActive: true, createdAt: '2026-09-20T02:00:00Z' }

// antd ở NODE_ENV=test gán aria-labelledby="test-id" cố định nên dialog không có tên: tìm theo nội dung.
// jsdom không chạy animation nên modal đã đóng vẫn còn trong DOM: lấy cái mới nhất, khác cái đã bỏ qua.
const findDialog = (title: string, not?: HTMLElement) =>
  waitFor(() => {
    const dialog = screen.getAllByRole('dialog').filter((d) => d !== not && within(d).queryAllByText(title).length > 0).at(-1)
    if (!dialog) throw new Error(`Không thấy dialog "${title}"`)
    return dialog
  })

const page = (items: UserRow[], total = items.length) => ok({ items, totalItems: total, page: 1, pageSize: 10, totalPages: 1 })
const asAdmin = { '/api/auth/me': () => ok({ id: 'me', username: ME.username, fullName: ME.fullName, role: 'admin', email: ME.email }) }

function open(path = '/admin/users') {
  return renderPage(path, '/admin/users', <App><Users /></App>)
}

// Mock theo URL đầy đủ (có query), không chỉ đuôi path.
function mockUsers(handlers: Record<string, (url: string, init?: RequestInit) => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const key = Object.keys(handlers).find((k) => (k.endsWith('*') ? url.includes(k.slice(0, -1)) : url.endsWith(k)))
    return key ? handlers[key](url, init) : reply(404)
  })
  vi.stubGlobal('fetch', fetchMock)
  const calls = (method: string, part: string) => fetchMock.mock.calls.filter(([u, i]) => String(u).includes(part) && (i?.method ?? 'GET') === method)
  return { calls }
}

test('usersQuery: URL của trang sang query của API, bỏ giá trị lạ', () => {
  expect(usersQuery(new URLSearchParams('keyword= an &status=locked&role=editor&page=2&pageSize=20'))).toBe('page=2&pageSize=20&search=an&role=editor&isActive=false')
  expect(usersQuery(new URLSearchParams('pageSize=5000&role=root'))).toBe('page=1&pageSize=10')
})

test('tải danh sách theo bộ lọc trên URL và hiện đúng dữ liệu', async () => {
  const api = mockUsers({ ...asAdmin, '/api/admin/users?*': () => page([ME, AN], 23) })
  open('/admin/users?status=active&keyword=an&page=1')

  expect(await screen.findByText('Trần Minh An')).toBeTruthy()
  expect(screen.getByText('Tổng 23 người dùng')).toBeTruthy()
  expect(String(api.calls('GET', '/api/admin/users?')[0][0])).toContain('search=an&isActive=true')
})

test('403 khi tải danh sách: hiện lỗi, không hiện "Chưa có người dùng"', async () => {
  mockUsers({ ...asAdmin, '/api/admin/users?*': () => reply(403, { title: 'Forbidden', status: 403 }) })
  open()
  expect(await screen.findByText('Không tải được danh sách người dùng')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy()
  expect(screen.queryByText('Chưa có người dùng nào.')).toBeNull()
})

test('khóa tài khoản: xác nhận, gọi PATCH, tải lại danh sách', async () => {
  let locked = false
  const api = mockUsers({
    ...asAdmin,
    '/api/admin/users?*': () => page([ME, { ...AN, isActive: !locked }]),
    '/api/admin/users/u2/status': () => ((locked = true), ok({ ...AN, isActive: false }, 'Cập nhật trạng thái tài khoản thành công.')),
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Khóa Trần Minh An' }))
  expect(api.calls('PATCH', '/status')).toHaveLength(0) // chưa xác nhận thì chưa gọi
  await userEvent.click(await screen.findByRole('button', { name: 'Khóa' }))

  expect(await screen.findByText('Đã khóa tài khoản Trần Minh An.')).toBeTruthy()
  expect(JSON.parse(String(api.calls('PATCH', '/status')[0][1]?.body))).toEqual({ isActive: false })
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Trần Minh An/ })).getByText('Đã khóa')).toBeTruthy())
  expect(api.calls('GET', '/api/admin/users?')).toHaveLength(2)
})

test('403 khi khóa: báo không có quyền, trạng thái trên UI không đổi', async () => {
  mockUsers({
    ...asAdmin,
    '/api/admin/users?*': () => page([ME, AN]),
    '/api/admin/users/u2/status': () => reply(403, { title: 'Forbidden', status: 403 }),
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Khóa Trần Minh An' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Khóa' }))

  expect(await screen.findByText(/Bạn không có quyền thực hiện thao tác này/)).toBeTruthy()
  expect(screen.queryByText('Đã khóa tài khoản Trần Minh An.')).toBeNull()
  expect(within(screen.getByRole('row', { name: /Trần Minh An/ })).getByText('Hoạt động')).toBeTruthy()
})

test('không tự khóa được tài khoản của chính mình', async () => {
  mockUsers({ ...asAdmin, '/api/admin/users?*': () => page([ME, AN]) })
  open()
  const selfLock = await screen.findByRole('button', { name: 'Không thể tự khóa tài khoản của chính mình' })
  expect(selfLock.hasAttribute('disabled')).toBe(true)
})

test('tạo người dùng: validate trước khi gửi', async () => {
  const api = mockUsers({ ...asAdmin, '/api/admin/users?*': () => page([ME]) })
  open('/admin/users?action=create')
  await userEvent.type(await screen.findByLabelText('Tên đăng nhập'), 'có dấu')
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))

  expect(await screen.findByText('Nhập họ và tên.')).toBeTruthy()
  expect(screen.getByText('Nhập email.')).toBeTruthy()
  expect(screen.getByText('Chỉ dùng chữ không dấu, chữ số và các ký tự . _ -')).toBeTruthy()
  expect(screen.getByText('Nhập mật khẩu ban đầu.')).toBeTruthy()
  expect(api.calls('POST', '/api/admin/users')).toHaveLength(0)
})

test('đổi vai trò: phải xác nhận; hủy thì không gửi, xác nhận thì PUT giữ nguyên isActive mới nhất', async () => {
  const fresh = { ...AN, isActive: false } // server: vừa bị khóa ở nơi khác, danh sách còn cũ
  const api = mockUsers({
    ...asAdmin,
    '/api/admin/users?*': () => page([ME, AN]),
    '/api/admin/users/u2': (_, init) =>
      init?.method === 'PUT' ? ok({ ...fresh, role: 'editor' }, 'Cập nhật thông tin người dùng thành công.') : ok(fresh),
  })
  open('/admin/users?action=edit&id=u2')

  await waitFor(() => expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Trần Minh An'))
  fireEvent.mouseDown(screen.getByLabelText('Vai trò'))
  await userEvent.click(await screen.findByTitle('Biên tập viên'))
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))

  const dialog = await findDialog('Đổi vai trò người dùng?')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }))
  expect(api.calls('PUT', '/api/admin/users/u2')).toHaveLength(0)

  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  await userEvent.click(within(await findDialog('Đổi vai trò người dùng?', dialog)).getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(api.calls('PUT', '/api/admin/users/u2')).toHaveLength(1))
  expect(JSON.parse(String(api.calls('PUT', '/api/admin/users/u2')[0][1]?.body))).toEqual({
    username: 'an24520100', fullName: 'Trần Minh An', role: 'editor', isActive: false,
  })
  expect(await screen.findByText('Đã lưu thay đổi của Trần Minh An.')).toBeTruthy()
})
