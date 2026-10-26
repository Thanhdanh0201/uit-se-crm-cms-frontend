// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import HomeSlides, { isSafeLink, reorderWithin, type HomeSlide } from './HomeSlides'
import { mockApi, ok, renderPage } from '../../lib/test-utils'

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

const admin = { '/api/auth/me': () => ok({ id: 'ad', username: 'admin.khoa', fullName: 'Quản trị Khoa', role: 'admin', email: 'admin@uit.edu.vn' }) }
const slide = (n: number, extra: Partial<HomeSlide> = {}): HomeSlide => ({
  id: `s${n}`, title: `Slide ${n}`, caption: null, image: { id: 'm1', name: 'Banner', altText: 'Lễ trao học bổng', url: 'https://storage.test/m1' },
  linkUrl: null, buttonLabel: null, position: 'top', sortOrder: n, isVisible: true, startsAt: null, endsAt: null, status: 'showing', ...extra,
})
const media = {
  '/api/media': () => ok({ items: [
    { id: 'm2', kind: 'image', name: 'Ngày hội việc làm', description: null, altText: 'Doanh nghiệp phỏng vấn sinh viên', mimeType: 'image/jpeg', sizeBytes: 1000, externalUrl: null, url: 'https://storage.test/m2', thumbnailUrl: 'https://storage.test/m2', urlExpiresAt: '2999-01-01T00:00:00Z', usageCount: 0, createdAt: '2026-10-01T02:00:00Z', createdBy: { id: 'ad', fullName: 'Quản trị Khoa' } },
  ], totalItems: 1, page: 1, pageSize: 24, totalPages: 1 }),
}
const open = (path = '/admin/home-slides') => renderPage(path, '/admin/home-slides', <App><HomeSlides /></App>)
const body = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body))

test('isSafeLink: chỉ trang trong website hoặc http/https', () => {
  expect(['/posts/hoc-bong', 'https://se.uit.edu.vn'].map(isSafeLink)).toEqual([true, true])
  expect(['javascript:alert(1)', '//evil.example', 'ftp://x.vn', 'posts/khong-co-gach'].map(isSafeLink)).toEqual([false, false, false, false])
})

test('danh sách: nhãn trạng thái, đủ 10 slide đang bật thì không bật thêm được', async () => {
  const list = [...Array.from({ length: 10 }, (_, i) => slide(i + 1)), slide(11, { isVisible: false, status: 'hidden' }), slide(12, { status: 'scheduled', isVisible: false })]
  list[11] = slide(12, { status: 'expired', isVisible: true })
  mockApi({ ...admin, '/api/admin/home-slides': () => ok(list.filter((s) => s.id !== 's10')) })
  open()
  expect(await screen.findByText('Slide 11')).toBeTruthy()
  expect(screen.getAllByText('Đang hiện')).toHaveLength(9)
  expect(screen.getByText('Đang ẩn')).toBeTruthy()
  expect(screen.getByText('Đã hết hạn')).toBeTruthy()
  // 9 slide "đang hiện" + 1 slide bật nhưng hết hạn = 10 slide đang bật (backend đếm theo IsVisible).
  expect((screen.getByRole('switch', { name: 'Bật slide Slide 11' }) as HTMLButtonElement).disabled).toBe(true)
})

test('thêm slide: bắt buộc ảnh và tiêu đề, chặn link không an toàn, gửi đúng dữ liệu rồi tải lại', async () => {
  let slides: HomeSlide[] = []
  const api = mockApi({
    ...admin, ...media,
    '/api/admin/home-slides': (_url, init) => {
      if (init?.method === 'POST') {
        slides = [slide(1, { title: 'Ngày hội việc làm SE 2026', linkUrl: '/posts/ngay-hoi-viec-lam' })]
        return ok(slides[0], '', 201)
      }
      return ok(slides)
    },
  })
  open('/admin/home-slides?action=create')
  const drawer = await screen.findByRole('dialog')
  await userEvent.click(within(drawer).getByText('Lưu').closest('button')!)
  expect(await within(drawer).findByText('Chọn ảnh cho slide.')).toBeTruthy()
  expect(within(drawer).getByText('Nhập tiêu đề slide.')).toBeTruthy()

  await userEvent.click(within(drawer).getByRole('button', { name: /Chọn ảnh từ thư viện/ }))
  const picker = (await screen.findAllByRole('dialog')).at(-1)!
  await userEvent.click(await within(picker).findByRole('button', { name: /Ngày hội việc làm/ }))
  await userEvent.click(within(picker).getByRole('button', { name: 'Chọn' }))
  expect(await within(drawer).findByRole('img', { name: 'Doanh nghiệp phỏng vấn sinh viên' })).toBeTruthy()

  await userEvent.type(within(drawer).getByLabelText('Tiêu đề'), 'Ngày hội việc làm SE 2026')
  await userEvent.type(within(drawer).getByLabelText('Đường dẫn'), 'javascript:alert(1)')
  await userEvent.type(within(drawer).getByLabelText('Chữ trên nút'), 'Đăng ký')
  await userEvent.click(within(drawer).getByText('Lưu').closest('button')!)
  expect(await within(drawer).findByText(/Đường dẫn phải bắt đầu bằng/)).toBeTruthy()
  expect(api.calls('/api/admin/home-slides').filter(([, i]) => (i as RequestInit)?.method === 'POST')).toHaveLength(0)

  await userEvent.clear(within(drawer).getByLabelText('Đường dẫn'))
  await userEvent.type(within(drawer).getByLabelText('Đường dẫn'), '/posts/ngay-hoi-viec-lam')
  await userEvent.click(within(drawer).getByText('Lưu').closest('button')!)
  await waitFor(() => expect(api.calls('/api/admin/home-slides').some(([, i]) => (i as RequestInit)?.method === 'POST')).toBe(true))
  const post = api.calls('/api/admin/home-slides').find(([, i]) => (i as RequestInit)?.method === 'POST')!
  expect(body(post)).toEqual({ title: 'Ngày hội việc làm SE 2026', caption: null, mediaId: 'm2', linkUrl: '/posts/ngay-hoi-viec-lam', buttonLabel: 'Đăng ký', position: 'top', isVisible: true, startsAt: null, endsAt: null, locale: 'vi' })
  expect(await screen.findByText('Ngày hội việc làm SE 2026')).toBeTruthy()
})

test('đổi thứ tự: gửi toàn bộ id theo thứ tự mới', async () => {
  const api = mockApi({ ...admin, '/api/admin/home-slides': () => ok([slide(1), slide(2)]), '/api/admin/home-slides/order': () => ok([]) })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Đưa Slide 2 lên trên' }))
  await waitFor(() => expect(api.calls('/api/admin/home-slides/order')).toHaveLength(1))
  expect(body(api.calls('/api/admin/home-slides/order')[0])).toEqual({ ids: ['s2', 's1'] })
})

test('slider cuối trang: tab theo vị trí trên URL, giới hạn tính riêng, đổi thứ tự chỉ trong vị trí đó', async () => {
  expect(reorderWithin([{ id: 'a', position: 'top' }, { id: 'b', position: 'bottom' }, { id: 'c', position: 'top' }, { id: 'd', position: 'bottom' }], 'bottom', 1, -1)).toEqual(['a', 'd', 'c', 'b'])

  const list = [...Array.from({ length: 10 }, (_, i) => slide(i + 1)), slide(11, { position: 'bottom', title: 'Đối tác doanh nghiệp' }), slide(12, { position: 'bottom', title: 'Cựu sinh viên tiêu biểu', isVisible: false, status: 'hidden' })]
  const api = mockApi({ ...admin, '/api/admin/home-slides': () => ok(list), '/api/admin/home-slides/order': () => ok(list) })
  open('/admin/home-slides?position=bottom')
  expect(await screen.findByText('Đối tác doanh nghiệp')).toBeTruthy()
  expect(screen.queryByText('Slide 1')).toBeNull()
  // Đầu trang đủ 10 không ảnh hưởng cuối trang: vẫn bật được slide đang tắt ở cuối trang.
  expect((screen.getByRole('switch', { name: 'Bật slide Cựu sinh viên tiêu biểu' }) as HTMLButtonElement).disabled).toBe(false)
  await userEvent.click(screen.getByRole('button', { name: 'Đưa Cựu sinh viên tiêu biểu lên trên' }))
  await waitFor(() => expect(api.calls('/api/admin/home-slides/order')).toHaveLength(1))
  expect(body(api.calls('/api/admin/home-slides/order')[0]).ids.slice(-2)).toEqual(['s12', 's11'])
})

test('lọc slide theo ngôn ngữ và tạo slide mới gửi kèm locale', async () => {
  let createdBody: any = null
  const api = mockApi({
    ...admin, ...media,
    '/api/admin/home-slides': (url, init) => {
      if (init?.method === 'POST') {
        createdBody = JSON.parse(String(init.body))
        return ok(slide(1, { title: createdBody.title, locale: createdBody.locale }), '', 201)
      }
      if (url.includes('locale=en')) {
        return ok([slide(1, { title: 'SE Job Fair 2026', locale: 'en' })])
      }
      return ok([slide(1, { title: 'Ngày hội việc làm SE 2026', locale: 'vi' })])
    },
  })

  open('/admin/home-slides?locale=en&action=create')
  expect(await screen.findByText('SE Job Fair 2026')).toBeTruthy()

  const drawer = await screen.findByRole('dialog')
  expect(within(drawer).getByText('English')).toBeTruthy()

  // Chọn ảnh
  await userEvent.click(within(drawer).getByRole('button', { name: /Chọn ảnh từ thư viện/ }))
  const picker = (await screen.findAllByRole('dialog')).at(-1)!
  await userEvent.click(await within(picker).findByRole('button', { name: /Ngày hội việc làm/ }))
  await userEvent.click(within(picker).getByRole('button', { name: 'Chọn' }))

  await userEvent.type(within(drawer).getByLabelText('Tiêu đề'), 'Welcome Freshmen 2026')
  await userEvent.click(within(drawer).getByRole('button', { name: 'Lưu' }))

  await waitFor(() => expect(createdBody).toBeTruthy())
  expect(createdBody).toMatchObject({ title: 'Welcome Freshmen 2026', locale: 'en' })
})
