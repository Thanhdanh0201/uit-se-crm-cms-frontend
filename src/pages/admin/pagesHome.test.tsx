// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { App } from 'antd'
import StaticPages from './StaticPages'
import PageEditor, { type PageDetail } from './PageEditor'
import HomeSections, { moveId, type HomeSection } from './HomeSections'
import { firstText } from '../public/StaticPage'
import { AuthProvider } from '../../lib/auth'
import { mockApi, ok, reply } from '../../lib/test-utils'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  document.elementFromPoint ??= () => null
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), clear: () => data.clear() })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const admin = { '/api/auth/me': () => ok({ id: 'ad', username: 'admin.khoa', fullName: 'Quản trị Khoa', role: 'admin', email: 'admin@uit.edu.vn' }) }
const open = (path: string, routes: { path: string; element: React.ReactNode }[]) => {
  const router = createMemoryRouter([...routes, { path: '*', element: <p>Trang khác</p> }], { initialEntries: [path] })
  render(<AuthProvider><App><RouterProvider router={router} /></App></AuthProvider>)
  return router
}
const findDialog = (text: string) => waitFor(() => {
  const d = screen.getAllByRole('dialog').filter((x) => within(x).queryAllByText(text).length > 0).at(-1)
  if (!d) throw new Error('chưa có dialog ' + text)
  return d
})

test('moveId và firstText', () => {
  expect(moveId(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
  expect(moveId(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  expect(firstText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Khoa Công nghệ Phần mềm' }, { type: 'text', text: ' thành lập năm 2006.' }] }] })).toBe('Khoa Công nghệ Phần mềm thành lập năm 2006.')
})

test('xóa trang đang có trong menu: hiện danh sách mục menu từ API, không xóa khỏi bảng', async () => {
  mockApi({
    ...admin,
    '/api/admin/pages': () => ok({ items: [{ id: 'g1', title: 'Giới thiệu', slug: 'gioi-thieu', locale: 'vi', status: 'published', menuItemCount: 1, publishedAt: null, updatedAt: '2026-10-05T02:00:00Z' }], totalItems: 1, page: 1, pageSize: 20 }),
    '/api/admin/pages/g1': () => reply(409, { title: 'Trang đang có trong menu', status: 409, code: 'page_in_menu', detail: '"Giới thiệu" đang được 1 mục menu trỏ tới.', menuItems: [{ id: 'm1', label: 'Giới thiệu', menuName: 'Menu chính' }] }),
  })
  open('/admin/pages', [{ path: '/admin/pages', element: <StaticPages /> }])
  await userEvent.click(await screen.findByRole('button', { name: 'Xóa Giới thiệu' }))
  await userEvent.click(within(await screen.findByRole('tooltip')).getByRole('button', { name: 'Xóa' }))
  const d = await findDialog('Chưa xóa được trang')
  expect(within(d).getByText('Menu chính: Giới thiệu')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Giới thiệu' })).toBeTruthy()
})

const PAGE: PageDetail = {
  id: 'g1', title: 'Giới thiệu', slug: 'gioi-thieu', locale: 'vi', status: 'draft', media: {}, publishedAt: null, expiresAt: null,
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Khoa thành lập năm 2006.' }] }] },
  menuItems: [{ id: 'm1', label: 'Giới thiệu', menuName: 'Menu chính' }], createdAt: '2026-10-01T02:00:00Z', updatedAt: '2026-10-05T02:00:00Z',
}

test('sửa trang: slug trùng hiện lỗi tại ô, trang nháp có trong menu thì cảnh báo, ngôn ngữ bị khóa', async () => {
  const api = mockApi({
    ...admin,
    '/api/admin/pages/g1': (_, init) => init?.method === 'PUT' ? reply(400, { title: 'Validation', status: 400, errors: { Slug: ['Đường dẫn này đã được trang khác dùng.'] } }) : ok(PAGE),
  })
  open('/admin/pages/g1/edit', [{ path: '/admin/pages/:id/edit', element: <PageEditor /> }])
  expect(await screen.findByText('Trang chưa xuất bản nhưng đang có trong menu')).toBeTruthy()
  // Kiểm tra locale bị khóa
  const viRadio = screen.getByRole('radio', { name: 'Tiếng Việt' }) as HTMLInputElement
  expect(viRadio.disabled).toBe(true)
  const slug = screen.getByLabelText('Đường dẫn (slug)')
  await userEvent.clear(slug)
  await userEvent.type(slug, 'lien-he')
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Đường dẫn này đã được trang khác dùng.')).toBeTruthy()
  const put = api.calls('/api/admin/pages/g1').find(([, i]) => i?.method === 'PUT')!
  expect(JSON.parse(String(put[1]?.body))).toMatchObject({ title: 'Giới thiệu', slug: 'lien-he', status: 'draft', content: { type: 'doc' }, locale: 'vi' })
})

test('tạo trang mới theo locale: nhận locale từ URL, tự sinh slug và gửi locale trong body', async () => {
  let createdBody: Record<string, unknown> | null = null
  const api = mockApi({
    ...admin,
    '/api/admin/pages': (_, init) => {
      createdBody = JSON.parse(String(init?.body))
      return ok({ ...PAGE, id: 'g-new', locale: 'en' })
    },
  })
  open('/admin/pages/new?locale=en', [{ path: '/admin/pages/new', element: <PageEditor /> }, { path: '/admin/pages/:id/edit', element: <PageEditor /> }])
  const enRadio = (await screen.findByRole('radio', { name: 'English' })) as HTMLInputElement
  expect(enRadio.checked).toBe(true)

  const title = screen.getByLabelText('Tiêu đề')
  await userEvent.type(title, 'About Software Engineering')
  await userEvent.tab()
  const slug = screen.getByLabelText('Đường dẫn (slug)') as HTMLInputElement
  expect(slug.value).toBe('about-software-engineering')

  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(createdBody).not.toBeNull())
  expect(createdBody).toMatchObject({ title: 'About Software Engineering', slug: 'about-software-engineering', locale: 'en' })
})

const S = (id: string, title: string, sortOrder: number): HomeSection => ({ id, title, categoryId: null, categoryName: null, sortOrder, itemLimit: 6, isVisible: true })

test('cấu hình trang chủ: đưa khối lên gửi toàn bộ id theo thứ tự mới rồi tải lại', async () => {
  let order = [S('a', 'Thông báo học vụ', 0), S('b', 'Sự kiện', 1)]
  const api = mockApi({
    ...admin,
    '/api/admin/categories': () => ok([]),
    '/api/admin/home-sections': () => ok(order),
    '/api/admin/home-sections/order': () => { order = [order[1], order[0]]; return ok(order) },
  })
  open('/admin/home-sections', [{ path: '/admin/home-sections', element: <HomeSections /> }])
  await userEvent.click(await screen.findByRole('button', { name: 'Đưa Sự kiện lên trên' }))
  expect(await screen.findByText('Đã đổi thứ tự.')).toBeTruthy()
  expect(JSON.parse(String(api.calls('/api/admin/home-sections/order')[0][1]?.body))).toEqual({ ids: ['b', 'a'] })
  await waitFor(() => expect(screen.getAllByRole('listitem')[0].textContent).toContain('Sự kiện'))
})

test('thêm khối: validate số bài 1-12 trước khi gửi', async () => {
  const api = mockApi({ ...admin, '/api/admin/categories': () => ok([]), '/api/admin/home-sections': () => ok([]) })
  open('/admin/home-sections?action=create', [{ path: '/admin/home-sections', element: <HomeSections /> }])
  await userEvent.click(await screen.findByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Nhập tiêu đề khối.')).toBeTruthy()
  expect(api.fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
})

test('tổng quan: admin thấy cảnh báo mục menu trỏ tới trang lỗi', async () => {
  const { default: Dashboard } = await import('./Dashboard')
  mockApi({
    ...admin,
    '/api/admin/menu-items/warnings': () => ok([{ itemId: 'mi1', menuId: 'mn1', menuName: 'Menu chính', label: 'Liên hệ', kind: 'page', isVisible: true, code: 'page_not_published', message: 'Trang "Liên hệ" chưa xuất bản.' }]),
  })
  open('/admin', [{ path: '/admin', element: <Dashboard /> }])
  expect(await screen.findByText('1 mục menu đang dẫn tới trang lỗi hoặc bị ẩn')).toBeTruthy()
  expect(screen.getByText('Menu chính: Liên hệ')).toBeTruthy()
})

test('sửa trang: giờ nhập là giờ Việt Nam, gửi lên UTC', async () => {
  const api = mockApi({
    ...admin,
    '/api/admin/pages/g1': (_, init) => init?.method === 'PUT' ? ok({ ...PAGE, status: 'published', publishedAt: '2026-10-10T01:00:00.000Z' }) : ok({ ...PAGE, status: 'published', publishedAt: '2026-10-10T01:00:00.000Z' }),
  })
  open('/admin/pages/g1/edit', [{ path: '/admin/pages/:id/edit', element: <PageEditor /> }])
  const pub = await screen.findByLabelText('Xuất bản lúc (giờ Việt Nam)')
  await waitFor(() => expect((pub as HTMLInputElement).value).toBe('10/10/2026 08:00'))
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(api.calls('/api/admin/pages/g1').find(([, i]) => i?.method === 'PUT')).toBeTruthy())
  expect(JSON.parse(String(api.calls('/api/admin/pages/g1').find(([, i]) => i?.method === 'PUT')![1]?.body)).publishedAt).toBe('2026-10-10T01:00:00.000Z')
})
