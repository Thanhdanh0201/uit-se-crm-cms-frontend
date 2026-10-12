// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavedPosts from './SavedPosts'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const me = { '/api/auth/me': () => ok({ id: 'u1', username: '24520100', fullName: 'Trần Minh An', role: 'student', email: 'an@gm.uit.edu.vn' }) }
const card = (id: string, title: string) => ({ id, slug: id, title, summary: null, coverUrl: null, coverAlt: null, publishedAt: '2026-10-10T02:00:00Z', categoryName: 'Thông báo học vụ' })
const pageOf = (items: unknown[], page: number, totalItems: number) => ({ items, totalItems, page, pageSize: 10, totalPages: Math.ceil(totalItems / 10) })
const open = (path = '/me/saved') => renderPage(path, '/me/saved', <SavedPosts />)

test('chưa đăng nhập: chuyển tới trang đăng nhập rồi quay lại', async () => {
  mockApi({ '/api/auth/me': () => reply(401) })
  open()
  expect(await screen.findByTestId('path')).toHaveProperty('textContent', '/login?next=%2Fme%2Fsaved')
})

test('bỏ lưu: gọi DELETE theo id bài, tải lại danh sách; bỏ bài cuối của trang 2 thì lùi về trang 1', async () => {
  let items = [card('p1', 'Lịch thi cuối kỳ HK1'), card('p2', 'Học bổng Tài năng 2026')]
  const api = mockApi({
    ...me,
    '/api/me/bookmarks': (url) => ok(url.includes('page=2') ? pageOf([card('p11', 'Hội thảo AI-SE 2026')], 2, 11) : pageOf(items, 1, items.length)),
    '/api/me/bookmarks/p1': () => {
      items = items.filter((x) => x.id !== 'p1')
      return ok({ bookmarked: false })
    },
    '/api/me/bookmarks/p11': () => ok({ bookmarked: false }),
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Bỏ lưu Lịch thi cuối kỳ HK1' }))
  await waitFor(() => expect(screen.queryByText('Lịch thi cuối kỳ HK1')).toBeNull())
  expect(screen.getByText('Học bổng Tài năng 2026')).toBeTruthy()
  expect((api.calls('/api/me/bookmarks/p1')[0][1] as RequestInit).method).toBe('DELETE')
  cleanup()

  open('/me/saved?page=2')
  await userEvent.click(await screen.findByRole('button', { name: 'Bỏ lưu Hội thảo AI-SE 2026' }))
  expect(await screen.findByText('Học bổng Tài năng 2026')).toBeTruthy()
})

test('chưa lưu bài nào: trạng thái rỗng; API lỗi: báo lỗi', async () => {
  mockApi({ ...me, '/api/me/bookmarks': () => ok(pageOf([], 1, 0)) })
  open()
  expect(await screen.findByText('Chưa có bài nào được lưu')).toBeTruthy()
  cleanup()

  mockApi({ ...me, '/api/me/bookmarks': () => reply(500) })
  open()
  expect(await screen.findByText(/Chưa tải được danh sách/)).toBeTruthy()
})
