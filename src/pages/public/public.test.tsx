// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, isRouteErrorResponse, RouterProvider, useLoaderData, useRouteError, type LoaderFunctionArgs } from 'react-router'
import { AuthProvider } from '../../lib/auth'
import { mockApi, ok, reply } from '../../lib/test-utils'
import PublicLayout, { loader as layoutLoader } from '../../layouts/PublicLayout'
import Home, { loader as homeLoader } from './Home'
import Category, { loader as categoryLoader } from './Category'
import PostDetail, { loader as postLoader } from './PostDetail'

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
const homeRoute = { index: true, loader: homeLoader, Component: withData(Home) } as PageRoute

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

const categoryRoute = { path: 'categories/:slug', loader: categoryLoader, Component: withData(Category) } as PageRoute
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

const postRoute = { path: 'posts/:slug', loader: postLoader, Component: withData(PostDetail) } as PageRoute
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
