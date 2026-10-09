// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { App } from 'antd'
import Menus, { type MenuItem } from './Menus'
import { AuthProvider } from '../../lib/auth'
import { mockApi, ok, reply } from '../../lib/test-utils'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: true, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const item = (id: string, label: string, children: MenuItem[] = [], extra: Partial<MenuItem> = {}): MenuItem => ({
  id, parentId: null, label, kind: 'category', pageId: null, pageTitle: null, categoryId: `c-${id}`, categoryName: label, externalUrl: null,
  resolvedUrl: `/categories/${id}`, targetWarning: null, targetWarningMessage: null, sortOrder: 1, isVisible: true, children, ...extra,
})
// Tin tức > Thông báo học vụ > Lịch thi (cấp 3), Tin tức > Học bổng; Biểu mẫu trỏ trang đã xóa.
const TREE = () => [
  item('tin-tuc', 'Tin tức', [
    item('thong-bao', 'Thông báo học vụ', [item('lich-thi', 'Lịch thi', [], { parentId: 'thong-bao' })], { parentId: 'tin-tuc' }),
    item('hoc-bong', 'Học bổng', [], { parentId: 'tin-tuc', sortOrder: 2 }),
  ]),
  item('bieu-mau', 'Biểu mẫu', [], { kind: 'page', categoryId: null, resolvedUrl: null, targetWarning: 'page_deleted', targetWarningMessage: 'Trang đích đã bị xóa, chọn trang khác', sortOrder: 2 }),
]

const admin = { '/api/auth/me': () => ok({ id: 'ad', username: 'admin', fullName: 'Quản trị', role: 'admin', email: 'ad@uit.edu.vn' }) }
const base = (tree = TREE) => ({
  ...admin,
  '/api/admin/menus': () => ok([{ id: 'm1', code: 'main', name: 'Menu chính', itemCount: 5 }]),
  '/api/admin/menus/m1/items': () => ok(tree()),
  '/api/admin/pages': () => ok({ items: [], totalItems: 0, page: 1, pageSize: 50 }),
  '/api/admin/categories': () => ok([{ id: 'c-new', name: 'Lịch thi bổ sung', slug: 'lich-thi-bo-sung', isVisible: true, parentName: null }]),
})

function open(path = '/admin/menus') {
  const router = createMemoryRouter([{ path: '/admin/menus', element: <Menus /> }], { initialEntries: [path] })
  render(<AuthProvider><App><RouterProvider router={router} /></App></AuthProvider>)
  return router
}
const labels = () => [...document.querySelectorAll('.menu-row__label')].map((e) => e.firstChild?.textContent)
const body = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body))

async function pickMove(label: string, action: string) {
  await userEvent.click(await screen.findByLabelText(`Di chuyển "${label}"`))
  await userEvent.click(await screen.findByText(action))
}

test('hiện cây menu, mục trỏ đích đã xóa và mục cấp 3 khóa nút thêm mục con', async () => {
  mockApi(base())
  open()
  expect(await screen.findByText('Trang đích đã bị xóa, chọn trang khác')).toBeTruthy()
  expect(labels()).toEqual(['Tin tức', 'Thông báo học vụ', 'Lịch thi', 'Học bổng', 'Biểu mẫu'])
  expect((screen.getByLabelText('Thêm mục con cho "Lịch thi"') as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByLabelText('Thêm mục con cho "Học bổng"') as HTMLButtonElement).disabled).toBe(false)
})

test('đổi thứ tự bằng nút Di chuyển: báo chưa lưu, khóa thao tác khác, lưu gửi cả cây', async () => {
  const api = mockApi({ ...base(), '/api/admin/menus/m1/tree': () => ok(TREE()) })
  open()
  await pickMove('Học bổng', 'Lên trên')
  expect(await screen.findByText('Đã đổi thứ tự 2 mục, chưa lưu.')).toBeTruthy()
  expect(labels()).toEqual(['Tin tức', 'Học bổng', 'Thông báo học vụ', 'Lịch thi', 'Biểu mẫu'])
  // Đang có thứ tự chưa lưu thì không sửa/xóa/bật tắt được, để lần tải lại không làm mất thứ tự.
  expect((screen.getByLabelText('Sửa "Tin tức"') as HTMLButtonElement).disabled).toBe(true)

  await userEvent.click(screen.getByText('Lưu thứ tự').closest('button')!)
  await waitFor(() => expect(api.calls('/api/admin/menus/m1/tree')).toHaveLength(1))
  expect(body(api.calls('/api/admin/menus/m1/tree')[0]).items).toEqual([
    { id: 'tin-tuc', parentId: null, sortOrder: 1 },
    { id: 'hoc-bong', parentId: 'tin-tuc', sortOrder: 1 },
    { id: 'thong-bao', parentId: 'tin-tuc', sortOrder: 2 },
    { id: 'lich-thi', parentId: 'thong-bao', sortOrder: 1 },
    { id: 'bieu-mau', parentId: null, sortOrder: 2 },
  ])
  await waitFor(() => expect(screen.queryByText(/chưa lưu/)).toBeNull())
})

test('lưu thứ tự bị từ chối: giữ nguyên thứ tự đang sửa và báo lỗi', async () => {
  mockApi({ ...base(), '/api/admin/menus/m1/tree': () => reply(400, { title: 'Bad Request', status: 400, detail: 'Cấu trúc phân cấp sau khi sắp xếp vượt quá giới hạn tối đa 3 cấp.' }) })
  open()
  await pickMove('Học bổng', 'Lên trên')
  await userEvent.click((await screen.findByText('Lưu thứ tự')).closest('button')!)
  expect(await screen.findByText(/vượt quá giới hạn tối đa 3 cấp/)).toBeTruthy()
  expect(screen.getByText('Đã đổi thứ tự 2 mục, chưa lưu.')).toBeTruthy()
  expect(labels()[1]).toBe('Học bổng')
})

test('thêm mục: chọn mục cha cấp 3 bị chặn trước khi gửi; lỗi cấp từ API hiện ở form', async () => {
  let created = 0
  const api = mockApi({
    ...base(),
    '/api/admin/menus/m1/items': (_u, init) => {
      if (init?.method !== 'POST') return ok(TREE())
      created++
      return reply(400, { title: 'Bad Request', status: 400, detail: 'Không thể tạo mục con vì mục cha đã ở cấp 3. Cây Menu chỉ cho phép tối đa 3 cấp (không chấp nhận cấp 4).' })
    },
  })
  open('/admin/menus?action=create&parent=lich-thi')
  const drawer = await screen.findByRole('dialog')
  await userEvent.type(within(drawer).getByLabelText('Tên hiển thị'), 'Lịch thi bổ sung')
  await userEvent.click(within(drawer).getByText('Chuyên mục'))
  await userEvent.click(await within(drawer).findByLabelText('Chuyên mục đích'))
  await userEvent.click(await screen.findByTitle('Lịch thi bổ sung'))
  await userEvent.click(within(drawer).getByRole('button', { name: 'Lưu' }))
  expect(await within(drawer).findByText('Không thể tạo mục con vì "Lịch thi" đã ở cấp 3. Menu chỉ cho phép tối đa 3 cấp.')).toBeTruthy()
  expect(created).toBe(0)

  // Đổi sang mục cha cấp 2 (client cho qua), server vẫn từ chối: hiện lý do của server.
  await userEvent.click(within(drawer).getByLabelText('Mục cha'))
  await userEvent.click(await screen.findByTitle('Tin tức / Học bổng'))
  await userEvent.click(within(drawer).getByRole('button', { name: 'Lưu' }))
  expect(await within(drawer).findByText('Chưa lưu được')).toBeTruthy()
  expect(created).toBe(1)
  expect(body(api.calls('/api/admin/menus/m1/items').find(([, i]) => i?.method === 'POST')!)).toMatchObject({ label: 'Lịch thi bổ sung', kind: 'category', categoryId: 'c-new', parentId: 'hoc-bong', pageId: null, externalUrl: null })
})

test('sửa mục: danh sách mục cha không có chính nó và cây con', async () => {
  mockApi(base())
  open('/admin/menus?action=edit&id=tin-tuc')
  const drawer = await screen.findByRole('dialog')
  await userEvent.click(within(drawer).getByLabelText('Mục cha'))
  const options = [...document.querySelectorAll('.ant-select-item-option')].map((o) => o.getAttribute('title'))
  expect(options).toEqual(['Không có (cấp 1 / mục gốc)', 'Biểu mẫu'])
})

test('tắt hiển thị: gọi PATCH rồi tải lại cây từ server', async () => {
  let loads = 0
  const api = mockApi({
    ...base(),
    '/api/admin/menus/m1/items': () => (loads++, ok(TREE())),
    '/api/admin/menu-items/hoc-bong/visibility': () => ok({}),
  })
  open()
  await userEvent.click(await screen.findByLabelText('Ẩn "Học bổng" trên website'))
  await waitFor(() => expect(api.calls('/api/admin/menu-items/hoc-bong/visibility')).toHaveLength(1))
  expect(body(api.calls('/api/admin/menu-items/hoc-bong/visibility')[0])).toEqual({ isVisible: false })
  await waitFor(() => expect(loads).toBe(2))
})

test('xóa menu: mở hộp thoại xác nhận, gọi DELETE, tải lại danh sách menu', async () => {
  let deleted = 0
  mockApi({
    ...base(),
    '/api/admin/menus/m1': (_u, init) => {
      if (init?.method === 'DELETE') {
        deleted++
        return ok({})
      }
      return ok({})
    },
  })
  open()
  await userEvent.click(await screen.findByLabelText('Xóa menu "Menu chính"'))
  expect((await screen.findAllByText('Xóa menu "Menu chính"?')).length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: 'Xóa' }))
  await waitFor(() => expect(deleted).toBe(1))
})

