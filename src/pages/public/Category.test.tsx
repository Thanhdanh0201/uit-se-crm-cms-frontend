// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import Category, { loader } from './Category'
import { mockApi, ok, reply } from '../../lib/test-utils'
import type { CategoryDetailDto } from '../../admin/categories'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CATEGORY: CategoryDetailDto = {
  id: 'c1',
  name: 'Tin tức & Hoạt động',
  slug: 'tin-tuc',
  description: 'Thông tin và sự kiện mới nhất của Khoa CNPM.',
  parentId: null,
  sortOrder: 1,
  isVisible: true,
  postCount: 5,
  childrenCount: 0,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

test('hiển thị thông tin chuyên mục và danh sách bài viết', () => {
  const posts = [
    {
      slug: 'bai-viet-1',
      title: 'Chào đón tân sinh viên khóa 2026',
      summary: 'Lễ khai giảng và chào đón các bạn tân sinh viên.',
      coverUrl: '/test-cover.jpg',
      publishedAt: '2026-10-02T08:00:00Z',
      categoryName: 'Tin tức & Hoạt động',
    },
  ]

  render(
    <MemoryRouter>
      <Category
        loaderData={{ category: CATEGORY, posts, url: 'http://localhost/categories/tin-tuc' }}
        params={{ slug: 'tin-tuc' }}
        matches={[] as never}
      />
    </MemoryRouter>
  )

  expect(screen.getByRole('heading', { level: 1, name: 'Tin tức & Hoạt động' })).toBeTruthy()
  expect(screen.getByText('Thông tin và sự kiện mới nhất của Khoa CNPM.')).toBeTruthy()
  expect(screen.getByText('5 bài viết')).toBeTruthy()
  expect(screen.getByText('Chào đón tân sinh viên khóa 2026')).toBeTruthy()
  expect(screen.getByText('Lễ khai giảng và chào đón các bạn tân sinh viên.')).toBeTruthy()
})

test('hiển thị EmptyState khi chuyên mục chưa có bài viết', () => {
  render(
    <MemoryRouter>
      <Category
        loaderData={{ category: { ...CATEGORY, postCount: 0 }, posts: [], url: 'http://localhost/categories/tin-tuc' }}
        params={{ slug: 'tin-tuc' }}
        matches={[] as never}
      />
    </MemoryRouter>
  )

  expect(screen.getByText('Chưa có bài viết hiển thị')).toBeTruthy()
  expect(screen.getByText('Chuyên mục này hiện chưa có bài viết nào được xuất bản.')).toBeTruthy()
})

test('loader gọi đúng API public category theo slug', async () => {
  mockApi({
    '/api/public/categories/tin-tuc': () => ok(CATEGORY),
    '/api/public/home': () => ok({ featured: [], latest: [], sections: [], events: [] }),
  })

  const res = await loader({
    params: { slug: 'tin-tuc' },
    request: new Request('http://localhost:3000/categories/tin-tuc'),
  } as never)

  expect(res.category.slug).toBe('tin-tuc')
  expect(res.category.name).toBe('Tin tức & Hoạt động')
})

test('loader ném 404 khi không tìm thấy chuyên mục', async () => {
  mockApi({
    '/api/public/categories/khong-ton-tai': () => reply(404, { title: 'Not Found' }),
  })

  await expect(
    loader({
      params: { slug: 'khong-ton-tai' },
      request: new Request('http://localhost:3000/categories/khong-ton-tai'),
    } as never)
  ).rejects.toThrow()
})
