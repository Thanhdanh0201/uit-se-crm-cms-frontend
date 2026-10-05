// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Posts, { postsQuery } from './Posts'
import type { PostListItem } from '../../admin/posts'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

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

const editor = { '/api/auth/me': () => ok({ id: 'me', username: 'ha.le', fullName: 'Lê Thu Hà', role: 'editor', email: 'ha@uit.edu.vn' }) }
const admin = { '/api/auth/me': () => ok({ id: 'ad', username: 'admin.khoa', fullName: 'Quản trị Khoa', role: 'admin', email: 'admin@uit.edu.vn' }) }
const categories = { '/api/admin/categories': () => ok([{ id: 'c1', name: 'Thông báo' }]) }

const NHAP: PostListItem = {
  id: 'p1', title: 'Thông báo học bổng học kỳ 1', slug: 'thong-bao-hoc-bong', status: 'draft', author: { id: 'me', name: 'Lê Thu Hà' },
  primaryCategory: { id: 'c1', name: 'Thông báo' }, isFeatured: false, priority: 0, reviewReason: null, version: 3,
  publishedAt: null, updatedAt: '2026-10-05T02:00:00Z', allowedStatuses: ['pending'],
}
const CHO: PostListItem = { ...NHAP, id: 'p2', title: 'Lịch thi cuối kỳ', status: 'pending', allowedStatuses: [] }
const page = (items: PostListItem[]) => ok({ items, totalItems: items.length, page: 1, pageSize: 20, totalPages: 1 })

const open = (path = '/admin/posts') => renderPage(path, '/admin/posts', <App><Posts /></App>)

test('postsQuery: URL sang query API, bỏ giá trị lạ', () => {
  expect(postsQuery(new URLSearchParams('status=pending&keyword= thi &category=c1&mine=1&page=2'))).toBe('page=2&pageSize=20&status=pending&search=thi&categoryId=c1&mine=true')
  expect(postsQuery(new URLSearchParams('status=xoa&pageSize=999'))).toBe('page=1&pageSize=20')
})

test('editor: chỉ sửa bài nháp của mình, bài chờ duyệt không có nút sửa, không có cột tác giả', async () => {
  mockApi({ ...editor, ...categories, '/api/posts': () => page([NHAP, CHO]) })
  open()
  expect(await screen.findByRole('link', { name: 'Thông báo học bổng học kỳ 1' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sửa Thông báo học bổng học kỳ 1' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Sửa Lịch thi cuối kỳ' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Duyệt / })).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'Tác giả' })).toBeNull()
})

test('gửi duyệt: xác nhận, gửi kèm version, tải lại danh sách', async () => {
  let sent = false
  const api = mockApi({
    ...editor,
    ...categories,
    '/api/posts': () => page([sent ? { ...NHAP, status: 'pending', allowedStatuses: [] } : NHAP]),
    '/api/posts/p1/status': () => ((sent = true), ok({ ...NHAP, status: 'pending' })),
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt' }))
  await userEvent.click(within(await screen.findByRole('tooltip')).getByRole('button', { name: 'Gửi duyệt' }))

  expect(await screen.findByText('Đã gửi duyệt "Thông báo học bổng học kỳ 1".')).toBeTruthy()
  expect(JSON.parse(String(api.calls('/api/posts/p1/status')[0][1]?.body))).toEqual({ toStatus: 'pending', version: 3 })
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Thông báo học bổng/ })).getByText('Chờ duyệt')).toBeTruthy())
})

test('409 khi gửi duyệt: báo bài đã đổi ở nơi khác và tải lại', async () => {
  const api = mockApi({
    ...editor,
    ...categories,
    '/api/posts': () => page([NHAP]),
    '/api/posts/p1/status': () => reply(409, { title: 'Bài đã thay đổi', status: 409, code: 'version_conflict', detail: 'x' }),
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt' }))
  await userEvent.click(within(await screen.findByRole('tooltip')).getByRole('button', { name: 'Gửi duyệt' }))
  expect(await screen.findByText(/Bài đã được sửa ở nơi khác/)).toBeTruthy()
  await waitFor(() => expect(api.calls('/api/posts')).toHaveLength(2))
})

test('admin: có cột tác giả, lọc "Của tôi", nút duyệt bài chờ duyệt', async () => {
  const api = mockApi({ ...admin, ...categories, '/api/posts': () => page([CHO]) })
  open('/admin/posts?mine=1')
  expect(await screen.findByRole('button', { name: 'Duyệt Lịch thi cuối kỳ' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Tác giả' })).toBeTruthy()
  expect(String(api.calls('/api/posts')[0][0])).toContain('mine=true')
})
