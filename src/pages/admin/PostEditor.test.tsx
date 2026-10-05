// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { App } from 'antd'
import PostEditor from './PostEditor'
import type { PostDetail } from '../../admin/posts'
import { AuthProvider } from '../../lib/auth'
import { mockApi, ok, reply } from '../../lib/test-utils'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  // ProseMirror cần các API đo vị trí mà jsdom không có.
  document.elementFromPoint ??= () => null
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

// Node mới có localStorage riêng (không dùng được khi thiếu --localstorage-file) đè lên của jsdom: dùng bản trong bộ nhớ.
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const editor = { '/api/auth/me': () => ok({ id: 'me', username: 'ha.le', fullName: 'Lê Thu Hà', role: 'editor', email: 'ha@uit.edu.vn' }) }
const lists = { '/api/admin/categories': () => ok([{ id: 'c1', name: 'Thông báo' }]), '/api/admin/tags': () => ok([{ id: 't1', name: 'Học bổng' }]) }

const POST: PostDetail = {
  id: 'p1', title: 'Thông báo học bổng học kỳ 1', slug: 'thong-bao-hoc-bong', summary: 'Hạn nộp 30/10.', status: 'draft', version: 4,
  author: { id: 'me', name: 'Lê Thu Hà' }, primaryCategoryId: 'c1', categories: [{ id: 'c1', name: 'Thông báo' }], tags: [],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sinh viên nộp hồ sơ tại văn phòng Khoa.' }] }] },
  cover: null, media: {}, reviewReason: null, isFeatured: false, priority: 0, publishedAt: null, expiresAt: null,
  createdAt: '2026-10-01T02:00:00Z', updatedAt: '2026-10-05T02:00:00Z', allowedStatuses: ['pending'],
}

function open(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/admin/posts/new', element: <PostEditor /> },
      { path: '/admin/posts/:id/edit', element: <PostEditor /> },
      { path: '*', element: <p>Trang khác</p> },
    ],
    { initialEntries: [path] },
  )
  render(<AuthProvider><App><RouterProvider router={router} /></App></AuthProvider>)
  return router
}

const body = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body))

test('bài mới: thiếu tiêu đề và chuyên mục thì không gửi', async () => {
  const api = mockApi({ ...editor, ...lists })
  open('/admin/posts/new')
  await userEvent.click(await screen.findByRole('button', { name: 'Lưu nháp' }))
  expect(await screen.findByText('Nhập tiêu đề bài viết.')).toBeTruthy()
  expect(screen.getByText('Chọn chuyên mục chính.')).toBeTruthy()
  expect(api.fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
})

test('lưu nháp: gửi version và nội dung JSON, cập nhật version mới', async () => {
  const api = mockApi({
    ...editor,
    ...lists,
    '/api/posts/p1': (_, init) => (init?.method === 'PUT' ? ok({ ...POST, title: 'Tiêu đề mới', version: 5 }) : ok(POST)),
  })
  open('/admin/posts/p1/edit')
  const title = await screen.findByLabelText('Tiêu đề')
  await waitFor(() => expect((title as HTMLInputElement).value).toBe('Thông báo học bổng học kỳ 1'))
  await userEvent.clear(title)
  await userEvent.type(title, 'Tiêu đề mới')
  expect(await screen.findByText('Chưa lưu')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))

  expect(await screen.findByText('Đã lưu bài viết.')).toBeTruthy()
  const put = api.calls('/api/posts/p1').find(([, i]) => i?.method === 'PUT')!
  expect(body(put)).toMatchObject({ title: 'Tiêu đề mới', version: 4, primaryCategoryId: 'c1', content: { type: 'doc' } })
  expect(body(put).content.content[0].content[0].text).toBe('Sinh viên nộp hồ sơ tại văn phòng Khoa.')
  await waitFor(() => expect(screen.queryByText('Chưa lưu')).toBeNull())
  expect(localStorage.getItem('post-backup:p1')).toBeNull()
})

test('API lỗi: giữ nội dung trên màn hình, sao lưu vào máy, mở lại thì gợi ý khôi phục', async () => {
  mockApi({
    ...editor,
    ...lists,
    '/api/posts/p1': (_, init) => (init?.method === 'PUT' ? reply(500, { title: 'Lỗi' }) : ok(POST)),
  })
  open('/admin/posts/p1/edit')
  const title = await screen.findByLabelText('Tiêu đề')
  await waitFor(() => expect((title as HTMLInputElement).value).toBe('Thông báo học bổng học kỳ 1'))
  await userEvent.type(title, ' (bổ sung)')
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))

  expect(await screen.findByText('Chưa lưu được')).toBeTruthy()
  expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Thông báo học bổng học kỳ 1 (bổ sung)')
  expect(JSON.parse(localStorage.getItem('post-backup:p1')!).values.title).toBe('Thông báo học bổng học kỳ 1 (bổ sung)')

  cleanup()
  open('/admin/posts/p1/edit')
  await userEvent.click(await screen.findByRole('button', { name: 'Khôi phục' }))
  await waitFor(() => expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Thông báo học bổng học kỳ 1 (bổ sung)'))
})

test('409: hỏi tải lại; đồng ý thì tải bản mới nhất từ server', async () => {
  let version = 4
  const api = mockApi({
    ...editor,
    ...lists,
    '/api/posts/p1': (_, init) =>
      init?.method === 'PUT'
        ? reply(409, { title: 'Bài đã thay đổi', status: 409, code: 'version_conflict', detail: 'x', currentVersion: 5 })
        : ok({ ...POST, version, title: version === 4 ? POST.title : 'Bản của người khác' }),
  })
  open('/admin/posts/p1/edit')
  const title = await screen.findByLabelText('Tiêu đề')
  await waitFor(() => expect((title as HTMLInputElement).value).toBe(POST.title))
  await userEvent.type(title, '!')
  version = 5
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))

  const dialog = await waitFor(() => {
    const d = screen.getAllByRole('dialog').find((x) => within(x).queryAllByText('Bài đã được sửa ở nơi khác').length > 0)
    if (!d) throw new Error('chưa có dialog')
    return d
  })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Tải lại' }))
  await waitFor(() => expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Bản của người khác'))
  expect(api.calls('/api/posts/p1').filter(([, i]) => !i?.method || i.method === 'GET')).toHaveLength(2)
})

test('gửi duyệt thiếu ảnh đại diện: hiện lỗi từ server, không rời trang', async () => {
  const router = (() => {
    mockApi({
      ...editor,
      ...lists,
      '/api/posts/p1': () => ok(POST),
      '/api/posts/p1/status': () => reply(400, { title: 'Validation', status: 400, errors: { CoverMediaId: ['Chọn ảnh đại diện trước khi gửi duyệt.'] } }),
    })
    return open('/admin/posts/p1/edit')
  })()
  await userEvent.click(await screen.findByRole('button', { name: /Gửi duyệt/ }))
  expect(await screen.findByText('Chọn ảnh đại diện trước khi gửi duyệt.')).toBeTruthy()
  expect(router.state.location.pathname).toBe('/admin/posts/p1/edit')
})

test('editor mở bài đang chờ duyệt: chỉ xem, không lưu được', async () => {
  mockApi({ ...editor, ...lists, '/api/posts/p1': () => ok({ ...POST, status: 'pending', allowedStatuses: [] }) })
  open('/admin/posts/p1/edit')
  expect(await screen.findByText(/nên bạn chỉ xem được/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Lưu nháp' }).hasAttribute('disabled')).toBe(true)
  expect(screen.queryByRole('button', { name: /Gửi duyệt/ })).toBeNull()
})

test('mở bài kết thúc bằng trích dẫn: không báo "Chưa lưu" khi chưa sửa gì', async () => {
  const quoteLast = { ...POST, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hạn nộp 30/10.' }] }, { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nộp trễ không được xét.' }] }] }] } }
  mockApi({ ...editor, ...lists, '/api/posts/p1': () => ok(quoteLast) })
  open('/admin/posts/p1/edit')
  expect(await screen.findByText('Nộp trễ không được xét.')).toBeTruthy()
  await new Promise((r) => setTimeout(r, 300))
  expect(screen.queryByText('Chưa lưu')).toBeNull()
})
