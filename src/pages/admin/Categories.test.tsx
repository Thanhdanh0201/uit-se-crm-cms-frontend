// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Categories, { slugify, type Category } from './Categories'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

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

const cat = (id: string, name: string, postCount: number, children: Category[] = [], extra: Partial<Category> = {}): Category => ({
  id, parentId: null, name, slug: slugify(name), description: null, sortOrder: 1, isVisible: true, postCount, children, ...extra,
})
const TREE = () => [
  cat('tin', 'Tin tức', 42, [cat('tbhv', 'Thông báo học vụ', 18, [], { parentId: 'tin' }), cat('hb', 'Học bổng', 9, [], { parentId: 'tin', sortOrder: 2 })]),
  cat('td', 'Tuyển dụng', 6, [cat('tt', 'Thực tập', 4, [], { parentId: 'td' })], { isVisible: false, sortOrder: 2 }),
  cat('dt', 'Đào tạo', 0, [], { sortOrder: 3 }),
]
const admin = { '/api/auth/me': () => ok({ id: 'ad', username: 'admin', fullName: 'Quản trị', role: 'admin', email: 'ad@uit.edu.vn' }) }
const open = (path = '/admin/categories') => renderPage(path, '/admin/categories', <App><Categories /></App>)
const body = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body))

test('slugify bỏ dấu tiếng Việt và ký tự lạ', () => {
  expect(slugify('Thông báo học vụ')).toBe('thong-bao-hoc-vu')
  expect(slugify('  Đào tạo & Sau đại học! ')).toBe('dao-tao-sau-dai-hoc')
})

test('cây chuyên mục: chuyên mục con của chuyên mục ẩn ghi rõ không hiện công khai', async () => {
  mockApi({ ...admin, '/api/admin/categories/tree': () => ok(TREE()) })
  open()
  expect(await screen.findByText('Thông báo học vụ')).toBeTruthy()
  expect(screen.getByText('Đang ẩn')).toBeTruthy()
  expect(screen.getByText('Không hiện công khai vì chuyên mục cha đang ẩn')).toBeTruthy()
  expect(screen.getByText('/categories/thong-bao-hoc-vu')).toBeTruthy()
})

test('sửa chuyên mục: đường dẫn sai quy tắc báo lỗi kèm gợi ý, không gửi', async () => {
  const api = mockApi({ ...admin, '/api/admin/categories/tree': () => ok(TREE()), '/api/admin/categories/tbhv': () => ok({}) })
  open('/admin/categories?action=edit&id=tbhv')
  const drawer = await screen.findByRole('dialog')
  const slug = within(drawer).getByLabelText('Đường dẫn (slug)')
  await userEvent.clear(slug)
  await userEvent.type(slug, 'Thông Báo học vụ')
  await userEvent.click(within(drawer).getByRole('button', { name: 'Lưu' }))
  expect(await within(drawer).findByText('Đường dẫn chỉ gồm chữ thường không dấu, chữ số và dấu gạch ngang. Ví dụ: thong-bao-hoc-vu')).toBeTruthy()
  expect(api.calls('/api/admin/categories/tbhv')).toHaveLength(0)

  // Chuyên mục cha không có chính nó.
  await userEvent.click(within(drawer).getByLabelText('Chuyên mục cha'))
  const options = [...document.querySelectorAll('.ant-select-item-option')].map((o) => o.getAttribute('title'))
  expect(options).not.toContain('Tin tức / Thông báo học vụ')
})

test('trùng đường dẫn từ server: lỗi hiện dưới ô đường dẫn, giữ drawer', async () => {
  mockApi({
    ...admin,
    '/api/admin/categories/tree': () => ok(TREE()),
    '/api/admin/categories/tbhv': () => reply(400, { title: 'Bad Request', status: 400, detail: "Slug 'hoc-bong' đã tồn tại trong hệ thống. Vui lòng chọn slug khác." }),
  })
  open('/admin/categories?action=edit&id=tbhv')
  const drawer = await screen.findByRole('dialog')
  const slug = within(drawer).getByLabelText('Đường dẫn (slug)')
  await userEvent.clear(slug)
  await userEvent.type(slug, 'hoc-bong')
  await userEvent.click(within(drawer).getByRole('button', { name: 'Lưu' }))
  expect(await within(drawer).findByText(/Slug 'hoc-bong' đã tồn tại/)).toBeTruthy()
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('xóa chuyên mục có bài: bắt chọn nơi nhận, không cho chọn chính nó và con; lỗi thì giữ nguyên danh sách', async () => {
  let fail = true
  const api = mockApi({
    ...admin,
    '/api/admin/categories/tree': () => ok(TREE()),
    '/api/admin/categories/tin': () => (fail ? reply(500, { title: 'Lỗi' }) : ok()),
  })
  open()
  await userEvent.click(await screen.findByLabelText('Xóa "Tin tức"'))
  expect(await screen.findByText('Chuyên mục đang có 42 bài viết và 2 chuyên mục con')).toBeTruthy()

  await userEvent.click(screen.getByText('Chuyển và xóa').closest('button')!)
  expect(await screen.findByText('Chọn chuyên mục nhận bài viết và chuyên mục con.')).toBeTruthy()
  expect(api.calls('/api/admin/categories/tin')).toHaveLength(0)

  await userEvent.click(screen.getByRole('combobox'))
  const options = [...document.querySelectorAll('.ant-select-item-option')].map((o) => o.getAttribute('title'))
  expect(options).toEqual(['Tuyển dụng', 'Tuyển dụng / Thực tập', 'Đào tạo'])
  await userEvent.click(await screen.findByTitle('Đào tạo'))
  await userEvent.click(screen.getByText('Chuyển và xóa').closest('button')!)
  expect(await screen.findByText('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.')).toBeTruthy()
  expect(api.calls('/api/admin/categories/tin')[0][0]).toContain('targetCategoryId=dt')
  // Không xóa lạc quan: dòng vẫn còn, hộp thoại vẫn mở.
  expect(screen.getAllByText('Tin tức').length).toBeGreaterThan(0)

  fail = false
  await userEvent.click(screen.getByText('Chuyển và xóa').closest('button')!)
  await waitFor(() => expect(screen.queryByText(/Chuyên mục đang có 42 bài viết/)).toBeNull())
  await waitFor(() => expect(api.calls('/api/admin/categories/tree').length).toBeGreaterThan(1))
})

test('thêm thẻ trùng: báo dưới ô tên, gửi slug null khi bỏ trống', async () => {
  const api = mockApi({
    ...admin,
    '/api/admin/tags': (_u, init) =>
      init?.method === 'POST'
        ? reply(400, { title: 'Bad Request', status: 400, detail: "Slug 'hoc-bong' đã tồn tại trong hệ thống. Vui lòng chọn slug khác." })
        : ok([{ id: 't1', name: 'Học bổng', slug: 'hoc-bong', postCount: 12 }]),
  })
  open('/admin/categories?tab=tags&action=create')
  const drawer = await screen.findByRole('dialog')
  await userEvent.type(within(drawer).getByLabelText('Tên thẻ'), 'Học Bổng')
  await userEvent.click(within(drawer).getByRole('button', { name: 'Lưu' }))
  expect(await within(drawer).findByText('Đã có thẻ dùng đường dẫn "hoc-bong". Dùng thẻ đó hoặc đổi tên khác.')).toBeTruthy()
  expect(body(api.calls('/api/admin/tags').find(([, i]) => i?.method === 'POST')!)).toEqual({ name: 'Học Bổng', slug: null })
})

test('xóa thẻ: mở hộp thoại xác nhận, gọi DELETE, tải lại danh sách thẻ', async () => {
  let deleted = 0
  mockApi({
    ...admin,
    '/api/admin/tags': () => ok([{ id: 't1', name: 'Học bổng', slug: 'hoc-bong', postCount: 0 }]),
    '/api/admin/tags/t1': (_u, init) => {
      if (init?.method === 'DELETE') {
        deleted++
        return ok({})
      }
      return ok({})
    },
  })
  open('/admin/categories?tab=tags')
  await userEvent.click(await screen.findByLabelText('Xóa thẻ "Học bổng"'))
  expect((await screen.findAllByText('Xóa thẻ "Học bổng"?')).length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: 'Xóa' }))
  await waitFor(() => expect(deleted).toBe(1))
})

test('lọc chuyên mục theo locale: gửi query locale và tạo chuyên mục gửi kèm locale tương ứng', async () => {
  let createdBody: Record<string, unknown> | null = null
  const api = mockApi({
    ...admin,
    '/api/admin/categories/tree': (url) => {
      const u = new URL(url, 'http://localhost')
      const loc = u.searchParams.get('locale')
      if (loc === 'en') return ok([cat('news', 'News', 5)])
      return ok([cat('tin', 'Tin tức', 10)])
    },
    '/api/admin/categories': (_u, init) => {
      if (init?.method === 'POST') {
        createdBody = JSON.parse(String(init.body))
        return ok({ id: 'c-new', name: 'Announcements', slug: 'announcements' })
      }
      return ok([])
    },
  })

  // Mở tab Chuyên mục với locale=en
  open('/admin/categories?locale=en&action=create')
  expect(await screen.findByText('News')).toBeTruthy()
  expect(String(api.calls('/api/admin/categories/tree')[0][0])).toContain('locale=en')

  // Trong Drawer thêm chuyên mục: hiển thị tag English và submit gửi locale=en
  const drawer = await screen.findByRole('dialog')
  expect(within(drawer).getByText('English')).toBeTruthy()
  await userEvent.type(within(drawer).getByLabelText('Tên chuyên mục'), 'Announcements')
  await userEvent.click(within(drawer).getByRole('button', { name: 'Lưu' }))

  await waitFor(() => expect(createdBody).not.toBeNull())
  expect(createdBody).toMatchObject({ name: 'Announcements', locale: 'en' })

  // Chuyển sang Tab Thẻ: không có bộ lọc locale
  await userEvent.click(screen.getByText('Thẻ'))
  await waitFor(() => {
    expect(screen.queryByRole('radiogroup', { name: 'Lọc theo ngôn ngữ' })).toBeNull()
  })
})

