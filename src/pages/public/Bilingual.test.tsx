// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { formatDate } from '../../lib/dictionary'
import { getLocaleFromPath, localePath } from '../../lib/locale'
import { seo } from '../../lib/seo'
import { PostList, type PostCard } from '../../components/PostList'
import NotFound, { loader as notFoundLoader } from './NotFound'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('getLocaleFromPath và localePath xử lý đúng quy tắc tiền tố URL', () => {
  expect(getLocaleFromPath('/')).toBe('vi')
  expect(getLocaleFromPath('/posts/bai-viet-1')).toBe('vi')
  expect(getLocaleFromPath('/categories/dao-tao')).toBe('vi')
  expect(getLocaleFromPath('/en')).toBe('en')
  expect(getLocaleFromPath('/en/')).toBe('en')
  expect(getLocaleFromPath('/en/posts/article-1')).toBe('en')
  expect(getLocaleFromPath('/en/search?q=test')).toBe('en')
  expect(getLocaleFromPath('/en.data')).toBe('en')
  expect(getLocaleFromPath('/en/posts/article-1.data')).toBe('en')
  expect(getLocaleFromPath('/posts/bai-viet-1.data')).toBe('vi')

  // localePath
  expect(localePath('/', 'vi')).toBe('/')
  expect(localePath('/', 'en')).toBe('/en')
  expect(localePath('/posts/hello', 'vi')).toBe('/posts/hello')
  expect(localePath('/posts/hello', 'en')).toBe('/en/posts/hello')
  expect(localePath('/en/posts/hello', 'vi')).toBe('/posts/hello')
  expect(localePath('/en/posts/hello', 'en')).toBe('/en/posts/hello')
  expect(localePath('/en/search?q=ai', 'vi')).toBe('/search?q=ai')
  expect(localePath('/search?q=ai', 'en')).toBe('/en/search?q=ai')
})

test('formatDate định dạng theo chuẩn vi-VN và en-US', () => {
  const iso = '2026-10-26T08:30:00Z'
  const viDate = formatDate(iso, 'vi', 'long')
  const enDate = formatDate(iso, 'en', 'long')

  expect(viDate).toContain('2026')
  expect(enDate).toContain('2026')
  expect(enDate).toMatch(/October/i)
})

test('seo tags sinh hreflang và og:locale theo locale', () => {
  const viMeta = seo({ title: 'Trang chủ', url: 'https://example.com/', locale: 'vi', isHome: true })
  const enMeta = seo({ title: 'Home', url: 'https://example.com/en', locale: 'en', isHome: true })

  // og:locale
  expect(viMeta.some((m) => 'property' in m && m.property === 'og:locale' && m.content === 'vi_VN')).toBe(true)
  expect(enMeta.some((m) => 'property' in m && m.property === 'og:locale' && m.content === 'en_US')).toBe(true)

  // alternate hreflang cho trang chủ
  expect(viMeta.some((m) => 'tagName' in m && m.tagName === 'link' && m.rel === 'alternate' && (m as any).hrefLang === 'vi')).toBe(true)
  expect(viMeta.some((m) => 'tagName' in m && m.tagName === 'link' && m.rel === 'alternate' && (m as any).hrefLang === 'en')).toBe(true)
  expect(viMeta.some((m) => 'tagName' in m && m.tagName === 'link' && m.rel === 'alternate' && (m as any).hrefLang === 'x-default')).toBe(true)
})

test('PostList bảo toàn tiền tố /en khi đang duyệt site tiếng Anh', () => {
  const posts: PostCard[] = [
    {
      id: 'p1',
      title: 'English Article',
      slug: 'english-article',
      summary: 'Summary in English',
      coverUrl: null,
      publishedAt: '2026-10-26T00:00:00Z',
      categoryName: 'Academics',
      categorySlug: 'academics',
    },
  ]

  const router = createMemoryRouter(
    [
      {
        path: '/en/search',
        element: <PostList posts={posts} />,
      },
    ],
    { initialEntries: ['/en/search'] },
  )

  render(<RouterProvider router={router} />)

  const articleLink = screen.getByRole('link', { name: 'English Article' })
  expect(articleLink.getAttribute('href')).toBe('/en/posts/english-article')
  expect(screen.getByText('Academics')).toBeTruthy()
})

test('PostList giữ tiền tố tiếng Việt bình thường khi ở site tiếng Việt', () => {
  const posts: PostCard[] = [
    {
      id: 'p1',
      title: 'Bài viết Tiếng Việt',
      slug: 'bai-viet-tieng-viet',
      summary: 'Tóm tắt bài viết',
      coverUrl: null,
      publishedAt: '2026-10-26T00:00:00Z',
      categoryName: 'Đào tạo',
      categorySlug: 'dao-tao',
    },
  ]

  const router = createMemoryRouter(
    [
      {
        path: '/search',
        element: <PostList posts={posts} />,
      },
    ],
    { initialEntries: ['/search'] },
  )

  render(<RouterProvider router={router} />)

  const articleLink = screen.getByRole('link', { name: 'Bài viết Tiếng Việt' })
  expect(articleLink.getAttribute('href')).toBe('/posts/bai-viet-tieng-viet')
  expect(screen.getByText('Đào tạo')).toBeTruthy()
})

test('NotFound hiển thị ngôn ngữ và link tương ứng theo URL', async () => {
  // Test site tiếng Anh /en/not-found
  const enRouter = createMemoryRouter(
    [
      {
        path: '/en/*',
        loader: notFoundLoader,
        element: <NotFound />,
      },
    ],
    { initialEntries: ['/en/unknown-page'] },
  )

  const { unmount } = render(<RouterProvider router={enRouter} />)
  expect(await screen.findByText(/Page Not Found/)).toBeTruthy()
  const enHomeLink = screen.getByRole('link', { name: 'Back to home' })
  expect(enHomeLink.getAttribute('href')).toBe('/en')

  unmount()

  // Test site tiếng Việt /not-found
  const viRouter = createMemoryRouter(
    [
      {
        path: '/*',
        loader: notFoundLoader,
        element: <NotFound />,
      },
    ],
    { initialEntries: ['/unknown-page'] },
  )

  render(<RouterProvider router={viRouter} />)
  expect(await screen.findByText(/Không tìm thấy trang/)).toBeTruthy()
  const viHomeLink = screen.getByRole('link', { name: 'Về trang chủ' })
  expect(viHomeLink.getAttribute('href')).toBe('/')
})
