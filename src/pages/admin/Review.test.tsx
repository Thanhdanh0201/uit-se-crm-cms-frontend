// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Review from './Review'
import type { PostListItem } from '../../admin/posts'
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

const VI_PENDING: PostListItem = {
  id: 'p-vi', title: 'Thông báo xét học vụ HK1', slug: 'thong-bao-xet-hoc-vu-hk1', locale: 'vi', status: 'pending',
  author: { id: 'u1', name: 'Nguyễn Văn A' }, primaryCategory: { id: 'c1', name: 'Học vụ' }, isFeatured: false, priority: 0,
  reviewReason: null, version: 1, publishedAt: null, expiresAt: null, updatedAt: '2026-10-10T02:00:00Z', allowedStatuses: ['published', 'changes_requested'],
}

const EN_PENDING: PostListItem = {
  id: 'p-en', title: 'Academic Notice Semester 1', slug: 'academic-notice-sem-1', locale: 'en', status: 'pending',
  author: { id: 'u2', name: 'John Smith' }, primaryCategory: { id: 'c2', name: 'Academic' }, isFeatured: false, priority: 0,
  reviewReason: null, version: 1, publishedAt: null, expiresAt: null, updatedAt: '2026-10-10T03:00:00Z', allowedStatuses: ['published', 'changes_requested'],
}

const page = (items: PostListItem[]) => ok({ items, totalItems: items.length, page: 1, pageSize: 20, totalPages: 1 })
const open = (path = '/admin/review') => renderPage(path, '/admin/review', <App><Review /></App>)

test('review: lọc danh sách theo locale, hiển thị đúng tag ngôn ngữ và gửi query', async () => {
  const api = mockApi({
    ...admin,
    '/api/posts': (url) => {
      const u = new URL(url, 'http://localhost')
      const loc = u.searchParams.get('locale')
      if (loc === 'en') return page([EN_PENDING])
      return page([VI_PENDING])
    },
  })

  // Mặc định Tiếng Việt
  open('/admin/review')
  expect(await screen.findByText('Thông báo xét học vụ HK1')).toBeTruthy()
  expect(within(screen.getByRole('row', { name: /Thông báo xét học vụ/ })).getByText('Tiếng Việt')).toBeTruthy()
  expect(String(api.calls('/api/posts')[0][0])).toContain('locale=vi')

  // Chuyển sang English bằng cách click vào label English trên thanh lọc
  await userEvent.click(screen.getByText('English'))
  expect(await screen.findByText('Academic Notice Semester 1')).toBeTruthy()
  expect(within(screen.getByRole('row', { name: /Academic Notice/ })).getByText('English')).toBeTruthy()
  const lastCall = api.calls('/api/posts').at(-1)!
  expect(String(lastCall[0])).toContain('locale=en')
})
