// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { AuthProvider } from '../../lib/auth'
import { mockApi, ok, reply } from '../../lib/test-utils'
import PublicLayout, { loader as layoutLoader } from '../../layouts/PublicLayout'
import Home, { loader as homeLoader } from './Home'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Trang public nhận loaderData qua props (framework mode). Router dữ liệu trong test không truyền props nên bọc lại.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withData = (Page: ComponentType<any>) => () => <Page loaderData={useLoaderData()} />

type PageRoute = { path?: string; index?: boolean; loader: (args: LoaderFunctionArgs) => unknown; Component: ComponentType }

// Render trong layout public thật (menu từ loader), giống cây route của ứng dụng.
function openPublic(path: string, page: PageRoute) {
  const router = createMemoryRouter(
    [
      {
        id: 'layouts/PublicLayout',
        loader: layoutLoader,
        Component: PublicLayout,
        children: [page, { path: '*', element: <p>Trang khác</p> }],
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
