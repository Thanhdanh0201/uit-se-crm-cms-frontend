// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, isRouteErrorResponse, RouterProvider, useLoaderData, useRouteError, type LoaderFunctionArgs } from 'react-router'
import { AuthProvider } from '../../lib/auth'
import { deferred, mockApi, ok, reply } from '../../lib/test-utils'
import PublicLayout, { loader as layoutLoader } from '../../layouts/PublicLayout'
import Home, { loader as homeLoader } from './Home'
import Category, { loader as categoryLoader } from './Category'
import PostDetail, { loader as postLoader } from './PostDetail'
import Search, { loader as searchLoader } from './Search'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Trang public nhận loaderData qua props (framework mode). Router dữ liệu trong test không truyền props nên bọc lại.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withData = (Page: ComponentType<any>) => () => <Page loaderData={useLoaderData()} />

// Giống ErrorBoundary ở root.tsx: 404 hiện "Không tìm thấy trang".
function RouteError() {
  const error = useRouteError()
  return <h1>{isRouteErrorResponse(error) && error.status === 404 ? 'Không tìm thấy trang' : 'Đã có lỗi xảy ra'}</h1>
}

type PageRoute = { path?: string; index?: boolean; loader: (args: LoaderFunctionArgs) => unknown; Component: ComponentType }

// Render trong layout public thật (menu từ loader), giống cây route của ứng dụng.
function openPublic(path: string, page: PageRoute) {
  const router = createMemoryRouter(
    [
      {
        id: 'layouts/PublicLayout',
        loader: layoutLoader,
        Component: PublicLayout,
        children: [{ ErrorBoundary: RouteError, children: [page] }, { path: '*', element: <p>Trang khác</p> }],
      },
    ],
    { initialEntries: [path] },
  )
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>)
  return router
}

const guest = { '/api/auth/me': () => reply(401) }
const menu = {
  '/api/public/menus/main': () =>
    ok({ code: 'main', items: [
      { id: 'm1', label: 'Giới thiệu Khoa', kind: 'page', url: '/pages/gioi-thieu-khoa', children: [] },
      { id: 'm2', label: 'Đào tạo', kind: 'category', url: '/categories/chuong-trinh-dao-tao', children: [] },
    ] }),
}
const card = (slug: string, title: string, categorySlug: string | null = 'thong-bao-hoc-vu') => ({
  id: slug, slug, title, summary: null, coverUrl: null, coverAlt: null, publishedAt: '2026-10-10T02:00:00Z', categoryName: 'Thông báo học vụ', categorySlug,
})
const home = {
  featured: [card('hoc-bong-2026', 'Học bổng Tài năng Công nghệ 2026')],
  latest: [card('lich-thi-hk1', 'Lịch thi cuối kỳ HK1 năm học 2026-2027')],
  sections: [
    { title: 'Thông báo học vụ', categorySlug: 'thong-bao-hoc-vu', posts: [card('lich-thi-hk1', 'Lịch thi cuối kỳ HK1 năm học 2026-2027')] },
    { title: 'Tin mới khác', categorySlug: null, posts: [card('hoi-thao-ai', 'Hội thảo AI-SE 2026')] },
  ],
  events: [],
}
const tree = [
  { id: 'c1', name: 'Thông báo học vụ', slug: 'thong-bao-hoc-vu', description: 'Lịch học, thi, đồ án', postCount: 4, children: [] },
  { id: 'c2', name: 'Nghiên cứu khoa học', slug: 'nghien-cuu-khoa-hoc', description: null, postCount: 2, children: [] },
]
const homeRoute = { index: true, loader: homeLoader, Component: withData(Home) } as unknown as PageRoute

test('trang chủ: truy cập nhanh, nút giới thiệu và footer lấy từ API, không cố định slug', async () => {
  mockApi({ ...guest, ...menu, '/api/public/home': () => ok(home), '/api/public/categories/tree': () => ok(tree) })
  openPublic('/', homeRoute)

  const quick = await screen.findByRole('navigation', { name: 'Truy cập nhanh' })
  expect(within(quick).getByRole('link', { name: /Thông báo học vụ/ }).getAttribute('href')).toBe('/categories/thong-bao-hoc-vu')
  expect(within(quick).getByRole('link', { name: /Nghiên cứu khoa học\s*2 bài viết/ }).getAttribute('href')).toBe('/categories/nghien-cuu-khoa-hoc')
  // Nút giới thiệu theo mục trang tĩnh đầu tiên của menu chính.
  expect(screen.getAllByRole('link', { name: 'Giới thiệu Khoa' }).map((a) => a.getAttribute('href'))).toContain('/pages/gioi-thieu-khoa')
  const footer = screen.getByRole('navigation', { name: 'Liên kết cuối trang' })
  expect(within(footer).getByRole('link', { name: 'Đào tạo' }).getAttribute('href')).toBe('/categories/chuong-trinh-dao-tao')
  // Nhóm không gắn chuyên mục: không có link "Xem tất cả" trỏ tới /categories/null.
  expect(screen.getByRole('link', { name: 'Xem tất cả Thông báo học vụ' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Xem tất cả Tin mới khác' })).toBeNull()
  expect(document.querySelector('a[href="/categories/null"]')).toBeNull()
})

test('trang chủ: API lỗi thì báo lỗi; chưa có bài thì hiện trạng thái rỗng; menu lỗi dùng menu dự phòng', async () => {
  mockApi({ ...guest, '/api/public/home': () => reply(500), '/api/public/categories/tree': () => reply(500) })
  openPublic('/', homeRoute)
  expect(await screen.findByText('Chưa tải được tin tức')).toBeTruthy()
  expect(screen.queryByText('Chưa có bài viết nào')).toBeNull()
  const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
  expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/search'])
  cleanup()

  mockApi({ ...guest, ...menu, '/api/public/home': () => ok({ featured: [], latest: [], sections: [], events: [] }), '/api/public/categories/tree': () => ok([]) })
  openPublic('/', homeRoute)
  expect(await screen.findByText('Chưa có bài viết nào')).toBeTruthy()
})

const categoryRoute = { path: 'categories/:slug', loader: categoryLoader, Component: withData(Category) } as unknown as PageRoute
const tbhv = { id: 'c1', name: 'Thông báo học vụ', slug: 'thong-bao-hoc-vu', description: 'Lịch học, thi, đồ án', parentName: null }
const pageOf = (items: unknown[], page = 1, totalItems = items.length, pageSize = 10) => ({ items, totalItems, page, pageSize, totalPages: Math.ceil(totalItems / pageSize) })

test('chuyên mục: danh sách bài mới trước, phân trang giữ trên URL, ảnh lỗi có ô thay thế', async () => {
  const api = mockApi({
    ...guest, ...menu,
    '/api/public/categories/thong-bao-hoc-vu': () => ok(tbhv),
    '/api/public/categories/thong-bao-hoc-vu/posts': (url) =>
      ok(url.includes('page=2')
        ? pageOf([card('dang-ky-hp', 'Đăng ký học phần HK2')], 2, 11)
        : pageOf([{ ...card('lich-thi-hk1', 'Lịch thi cuối kỳ HK1'), coverUrl: 'https://storage.test/het-han.jpg' }], 1, 11)),
  })
  const router = openPublic('/categories/thong-bao-hoc-vu', categoryRoute)
  expect(await screen.findByRole('heading', { level: 1, name: 'Thông báo học vụ' })).toBeTruthy()
  expect(screen.getByText('11 bài viết')).toBeTruthy()
  // Signed URL hết hạn: ảnh lỗi thì thay bằng ô biểu tượng.
  const img = document.querySelector('img.post-row__thumb') as HTMLImageElement
  img.dispatchEvent(new Event('error'))
  await waitFor(() => expect(document.querySelector('img.post-row__thumb')).toBeNull())
  expect(document.querySelector('.post-thumb--empty')).toBeTruthy()

  await userEvent.click(screen.getByRole('button', { name: '2' }))
  expect(await screen.findByRole('link', { name: 'Đăng ký học phần HK2' })).toBeTruthy()
  expect(router.state.location.search).toBe('?page=2')
  expect(api.calls('/api/public/categories/thong-bao-hoc-vu/posts').at(-1)![0]).toContain('page=2&pageSize=10')
})

test('chuyên mục ẩn hoặc không tồn tại: trang 404; chưa có bài: trạng thái rỗng', async () => {
  mockApi({ ...guest, ...menu, '/api/public/categories/an-di': () => reply(404), '/api/public/categories/an-di/posts': () => reply(404) })
  openPublic('/categories/an-di', categoryRoute)
  expect(await screen.findByText('Không tìm thấy trang')).toBeTruthy()
  cleanup()

  mockApi({ ...guest, ...menu, '/api/public/categories/thong-bao-hoc-vu': () => ok(tbhv), '/api/public/categories/thong-bao-hoc-vu/posts': () => ok(pageOf([])) })
  openPublic('/categories/thong-bao-hoc-vu', categoryRoute)
  expect(await screen.findByText('Chuyên mục chưa có bài viết')).toBeTruthy()
})

const postRoute = { path: 'posts/:slug', loader: postLoader, Component: withData(PostDetail) } as unknown as PageRoute
const post = {
  id: 'p1', slug: 'lich-thi-hk1', title: 'Lịch thi cuối kỳ HK1', summary: 'Lịch thi và phòng thi.', status: 'published',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sinh viên xem phòng thi trên cổng thông tin.' }] }] },
  cover: null, media: {}, authorName: 'Phòng Đào tạo', category: { id: 'c1', name: 'Thông báo học vụ' },
  tags: [{ id: 't1', name: 'lịch thi' }], publishedAt: '2026-10-10T02:00:00Z', viewCount: 41,
}

test('chi tiết bài: ghi lượt xem đúng một lần, hiện thẻ và link bài cùng chuyên mục', async () => {
  const api = mockApi({ ...guest, ...menu, '/api/public/posts/lich-thi-hk1': () => ok(post), '/api/public/posts/lich-thi-hk1/view': () => ok({ viewCount: 42 }) })
  const router = openPublic('/posts/lich-thi-hk1', postRoute)
  expect(await screen.findByText('Sinh viên xem phòng thi trên cổng thông tin.')).toBeTruthy()
  expect(await screen.findByText(/42 lượt xem/)).toBeTruthy()
  expect(screen.getByRole('link', { name: '#lịch thi' }).getAttribute('href')).toBe('/search?tag=t1')
  expect(screen.getByRole('link', { name: 'Bài khác trong Thông báo học vụ' }).getAttribute('href')).toBe('/search?category=c1')

  // Loader chạy lại cùng bài (ví dụ đổi query) không ghi thêm lượt xem.
  await router.navigate('/posts/lich-thi-hk1?ref=home')
  await waitFor(() => expect(api.calls('/api/public/posts/lich-thi-hk1').length).toBe(2))
  expect(api.calls('/api/public/posts/lich-thi-hk1/view')).toHaveLength(1)
})

test('bài nháp, hết hạn hoặc không tồn tại: trang 404', async () => {
  mockApi({ ...guest, ...menu, '/api/public/posts/ban-nhap': () => reply(404) })
  openPublic('/posts/ban-nhap', postRoute)
  expect(await screen.findByText('Không tìm thấy trang')).toBeTruthy()
})

const searchRoute = { path: 'search', loader: searchLoader, Component: withData(Search) } as unknown as PageRoute
const filters = {
  '/api/public/categories': () => ok([{ id: 'c1', name: 'Thông báo học vụ' }, { id: 'c2', name: 'Nghiên cứu khoa học' }]),
  '/api/public/tags': () => ok([{ id: 't1', name: 'học bổng' }]),
}
const query = (call: unknown[]) => new URL(String(call[0]), 'http://x').searchParams

test('tìm kiếm: tiêu chí gửi lên server, đổi bộ lọc về trang 1, Back giữ tiêu chí', async () => {
  const api = mockApi({
    ...guest, ...menu, ...filters,
    '/api/public/posts': (url) => {
      const q = new URL(url, 'http://x').searchParams
      return ok(pageOf([card(`ket-qua-${q.get('page')}`, `Kết quả ${q.get('keyword') ?? 'tất cả'} trang ${q.get('page')}`)], Number(q.get('page')), 25))
    },
  })
  const router = openPublic('/search?q=học bổng&page=2', searchRoute)
  expect(await screen.findByRole('link', { name: 'Kết quả học bổng trang 2' })).toBeTruthy()
  expect(screen.getByText('Tìm thấy 25 bài cho "học bổng"')).toBeTruthy()

  // Đổi chuyên mục: về trang 1, gửi categoryId; ngày theo giờ Việt Nam, "đến ngày" lấy hết ngày.
  await userEvent.selectOptions(screen.getByLabelText('Chuyên mục'), 'c2')
  await userEvent.click(screen.getByRole('button', { name: 'Tìm' }))
  await waitFor(() => expect(router.state.location.search).toBe('?q=h%E1%BB%8Dc+b%E1%BB%95ng&category=c2'))
  expect(await screen.findByRole('link', { name: 'Kết quả học bổng trang 1' })).toBeTruthy()
  const last = query(api.calls('/api/public/posts').at(-1)!)
  expect([last.get('keyword'), last.get('categoryId'), last.get('page'), last.get('pageSize')]).toEqual(['học bổng', 'c2', '1', '10'])

  await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-10-31')
  await userEvent.click(screen.getByRole('button', { name: 'Tìm' }))
  await waitFor(() => expect(query(api.calls('/api/public/posts').at(-1)!).get('toDate')).toBe('2026-10-31T23:59:59.999+07:00'))

  // Back: URL và ô lọc quay về tiêu chí trước.
  await router.navigate(-1)
  await waitFor(() => expect(router.state.location.search).toBe('?q=h%E1%BB%8Dc+b%E1%BB%95ng&category=c2'))
  await waitFor(() => expect((screen.getByLabelText('Đến ngày') as HTMLInputElement).value).toBe(''))
  await router.navigate(-1)
  await waitFor(() => expect((screen.getByLabelText('Chuyên mục') as HTMLSelectElement).value).toBe(''))
  expect((screen.getByLabelText('Từ khóa') as HTMLInputElement).value).toBe('học bổng')
})

test('tìm kiếm: kết quả của tiêu chí cũ về sau không đè kết quả mới', async () => {
  const slow = deferred<Response>()
  mockApi({
    ...guest, ...menu, ...filters,
    '/api/public/posts': (url) => (url.includes('keyword=lich')
      ? slow.promise
      : ok(pageOf([card('hoc-bong', url.includes('keyword=hoc') ? 'Kết quả học bổng' : 'Bài mới nhất')]))),
  })
  const router = openPublic('/search', searchRoute)
  expect(await screen.findByRole('link', { name: 'Bài mới nhất' })).toBeTruthy()
  // Không await: request của "lich" treo cho tới khi resolve ở dưới.
  void router.navigate('/search?q=lich')
  void router.navigate('/search?q=hoc')
  expect(await screen.findByRole('link', { name: 'Kết quả học bổng' })).toBeTruthy()
  slow.resolve(ok(pageOf([card('lich-thi', 'Kết quả lịch thi')])))
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('link', { name: 'Kết quả lịch thi' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Kết quả học bổng' })).toBeTruthy()
})

test('tìm kiếm: ngày bắt đầu sau ngày kết thúc thì báo lỗi, không gọi API; không có bài thì trạng thái rỗng', async () => {
  const api = mockApi({ ...guest, ...menu, ...filters, '/api/public/posts': () => ok(pageOf([])) })
  openPublic('/search?from=2026-10-20&to=2026-10-01', searchRoute)
  expect(await screen.findByText('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')).toBeTruthy()
  expect(api.calls('/api/public/posts')).toHaveLength(0)
  cleanup()

  mockApi({ ...guest, ...menu, ...filters, '/api/public/posts': () => ok(pageOf([])) })
  openPublic('/search?q=khong-co', searchRoute)
  expect(await screen.findByText('Không có bài phù hợp')).toBeTruthy()
})

const student = { '/api/auth/me': () => ok({ id: 'u1', username: '24520100', fullName: 'Trần Minh An', role: 'student', email: 'an@gm.uit.edu.vn' }) }

test('lưu bài: khách được mời đăng nhập rồi quay lại đúng bài', async () => {
  mockApi({ ...guest, ...menu, '/api/public/posts/lich-thi-hk1': () => ok(post), '/api/public/posts/lich-thi-hk1/view': () => ok({ viewCount: 42 }) })
  openPublic('/posts/lich-thi-hk1', postRoute)
  const link = await screen.findByRole('link', { name: 'Đăng nhập để lưu bài' })
  expect(link.getAttribute('href')).toBe('/login?next=%2Fposts%2Flich-thi-hk1')
})

test('lưu bài ở site tiếng Anh: link tới /login (không có /en/login), next giữ tiền tố /en', async () => {
  mockApi({ ...guest, ...menu, '/api/public/posts/lich-thi-hk1': () => ok(post), '/api/public/posts/lich-thi-hk1/view': () => ok({ viewCount: 42 }) })
  openPublic('/en/posts/lich-thi-hk1', { ...postRoute, path: 'en/posts/:slug' })
  const link = await screen.findByRole('link', { name: 'Sign in to save post' })
  expect(link.getAttribute('href')).toBe('/login?next=%2Fen%2Fposts%2Flich-thi-hk1')
})

test('lưu bài: bấm nhiều lần chỉ gửi một request, chỉ đổi trạng thái khi API thành công', async () => {
  const put = deferred<Response>()
  const api = mockApi({
    ...student, ...menu,
    '/api/public/posts/lich-thi-hk1': () => ok(post),
    '/api/public/posts/lich-thi-hk1/view': () => ok({ viewCount: 42 }),
    '/api/me/bookmarks/p1': (_url, init) => (init?.method === 'PUT' ? put.promise : init?.method === 'DELETE' ? reply(404) : ok({ bookmarked: false })),
  })
  openPublic('/posts/lich-thi-hk1', postRoute)
  const button = await screen.findByRole('button', { name: 'Lưu bài' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  await userEvent.click(button)
  await userEvent.click(button)
  expect(api.calls('/api/me/bookmarks/p1').filter(([, i]) => (i as RequestInit)?.method === 'PUT')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Đã lưu' })).toBeNull()

  put.resolve(ok({ bookmarked: true }))
  const saved = await screen.findByRole('button', { name: 'Đã lưu' })
  expect(saved.getAttribute('aria-pressed')).toBe('true')

  // Bài bị gỡ trong lúc đang xem: báo rõ, giữ trạng thái cũ.
  await userEvent.click(saved)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Bài này không còn công khai nên không lưu được.')
  expect(screen.getByRole('button', { name: 'Đã lưu' })).toBeTruthy()
})

const slides = [
  { id: 's1', title: 'Học bổng Tài năng Công nghệ 2026', caption: 'Nhận hồ sơ đến 30/11/2026.', imageUrl: 'https://storage.test/hb.jpg', imageAlt: 'Lễ trao học bổng', linkUrl: '/posts/hoc-bong-2026', buttonLabel: 'Xem chi tiết' },
  { id: 's2', title: 'Ngày hội việc làm SE 2026', caption: null, imageUrl: 'https://storage.test/jf.jpg', imageAlt: 'Doanh nghiệp phỏng vấn sinh viên', linkUrl: 'https://se.uit.edu.vn', buttonLabel: null },
]

test('slider trang chủ: thay phần giới thiệu, giữ tiêu đề trang, điều khiển bằng nút, slide ẩn không nhận focus', async () => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  mockApi({ ...guest, ...menu, '/api/public/home': () => ok({ ...home, slides }), '/api/public/categories/tree': () => ok(tree) })
  openPublic('/', homeRoute)

  const slider = await screen.findByRole('region', { name: 'Tin nổi bật của Khoa' })
  expect(slider.getAttribute('aria-roledescription')).toBe('carousel')
  expect(screen.getByRole('heading', { level: 1, name: 'Khoa Công nghệ Phần mềm' }).className).toContain('visually-hidden')
  expect(screen.queryByRole('link', { name: 'Xem tin mới' })).toBeNull()
  expect(screen.getByRole('img', { name: 'Lễ trao học bổng' })).toBeTruthy()
  expect(within(slider).getByRole('link', { name: 'Xem chi tiết' }).getAttribute('href')).toBe('/posts/hoc-bong-2026')

  // Slide 2 đang ẩn: không vào được bằng Tab. Bấm "Slide sau" thì slide 2 thành slide hiện tại.
  const [first, second] = slider.querySelectorAll('[aria-roledescription="slide"]')
  expect(second.hasAttribute('inert')).toBe(true)
  await userEvent.click(within(slider).getByRole('button', { name: 'Slide sau' }))
  expect(second.hasAttribute('inert')).toBe(false)
  expect(first.hasAttribute('inert')).toBe(true)
  expect(within(slider).getByRole('button', { name: 'Xem slide 2: Ngày hội việc làm SE 2026' }).getAttribute('aria-current')).toBe('true')
  // Slide không có chữ nút: cả slide là link ngoài, mở tab mới an toàn.
  const external = second.querySelector('a')!
  expect([external.getAttribute('href'), external.getAttribute('rel')]).toEqual(['https://se.uit.edu.vn', 'noopener noreferrer'])
  expect(within(slider).getByRole('button', { name: 'Tạm dừng tự chuyển slide' })).toBeTruthy()
})

test('slider trang chủ: không có slide thì giữ phần giới thiệu mặc định', async () => {
  mockApi({ ...guest, ...menu, '/api/public/home': () => ok({ ...home, slides: [] }), '/api/public/categories/tree': () => ok(tree) })
  openPublic('/', homeRoute)
  expect(await screen.findByRole('link', { name: 'Xem tin mới' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Tin nổi bật của Khoa' })).toBeNull()
})

test('slider cuối trang: hiện trên khối hỏi đáp, tách riêng slider đầu trang', async () => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  mockApi({ ...guest, ...menu, '/api/public/home': () => ok({ ...home, slides: [], bottomSlides: [slides[1]] }), '/api/public/categories/tree': () => ok(tree) })
  openPublic('/', homeRoute)
  const bottom = await screen.findByRole('region', { name: 'Hoạt động và đối tác của Khoa' })
  expect(bottom.className).toContain('home-slider--wide')
  expect(within(bottom).queryByRole('button', { name: 'Slide sau' })).toBeNull() // một slide thì không có nút điều khiển
  expect(screen.getByRole('link', { name: 'Xem tin mới' })).toBeTruthy() // đầu trang không có slide: giữ phần giới thiệu
  expect(bottom.compareDocumentPosition(screen.getByRole('heading', { name: 'Có câu hỏi cho Khoa?' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
