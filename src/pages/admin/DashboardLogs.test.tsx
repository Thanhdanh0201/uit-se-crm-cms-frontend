// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import Dashboard, { type DashboardData } from './Dashboard'
import ActivityLogs, { logsQuery } from './ActivityLogs'
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

const me = (role: string) => ({ '/api/auth/me': () => ok({ id: 'u', username: 'x', fullName: 'X', role, email: 'x@uit.edu.vn' }) })
const DASH: DashboardData = {
  posts: { draft: 4, pending: 2, published: 30 }, pendingPosts: [{ id: 'p2', title: 'Lịch thi cuối kỳ', authorName: 'Phạm Quốc Bảo', submittedAt: '2026-10-05T02:00:00Z' }],
  users: { activeByRole: { student: 120, editor: 5, admin: 2 }, locked: 1 }, events: { upcoming: 3, openForRegistration: 2, activeRegistrations: 85 },
  contacts: { new: 7, in_progress: 1 }, generatedAt: '2026-10-06T03:00:00Z',
}

test('logsQuery: ngày theo giờ Việt Nam đổi sang UTC, "đến ngày" tính hết ngày', () => {
  expect(logsQuery(new URLSearchParams('from=2026-10-01&to=2026-10-05&action=PUBLISH_POST'))).toBe(
    'page=1&pageSize=20&action=PUBLISH_POST&from=2026-09-30T17%3A00%3A00.000Z&to=2026-10-05T17%3A00%3A00.000Z',
  )
})

test('admin: dashboard hiện số liệu và bài chờ duyệt có link duyệt', async () => {
  mockApi({ ...me('admin'), '/api/admin/dashboard': () => ok(DASH), '/api/admin/menu-items/warnings': () => ok([]) })
  renderPage('/admin', '/admin', <App><Dashboard /></App>)
  expect(await screen.findByRole('link', { name: 'Lịch thi cuối kỳ' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Lịch thi cuối kỳ' }).getAttribute('href')).toBe('/admin/review/p2')
  expect(screen.getByText('85')).toBeTruthy()
  expect(screen.getByText('Đang xử lý')).toBeTruthy()
})

test('admin: lỗi dashboard không ẩn cảnh báo menu (tải độc lập)', async () => {
  mockApi({
    ...me('admin'),
    '/api/admin/dashboard': () => reply(500, { title: 'x' }),
    '/api/admin/menu-items/warnings': () => ok([{ itemId: 'i', menuId: 'm', menuName: 'Menu chính', label: 'Liên hệ', kind: 'page', isVisible: true, code: 'page_deleted', message: 'Trang đích đã bị xóa.' }]),
  })
  renderPage('/admin', '/admin', <App><Dashboard /></App>)
  expect(await screen.findByText('Không tải được số liệu tổng quan')).toBeTruthy()
  expect(await screen.findByText('1 mục menu đang dẫn tới trang lỗi hoặc bị ẩn')).toBeTruthy()
})

test('editor: không gọi API dashboard của admin', async () => {
  const api = mockApi({ ...me('editor') })
  renderPage('/admin', '/admin', <App><Dashboard /></App>)
  expect(await screen.findByRole('button', { name: 'Viết bài mới' })).toBeTruthy()
  expect(api.calls('/api/admin/dashboard')).toHaveLength(0)
})

test('nhật ký: lọc trên URL, nhãn tiếng Việt, không có nút sửa/xóa', async () => {
  const api = mockApi({
    ...me('admin'),
    '/api/admin/activity-logs': () => ok({ items: [{ id: 1, actor: { id: 'ad', fullName: 'Quản trị Khoa', username: 'admin.khoa' }, action: 'PUBLISH_POST', actionLabel: 'Xuất bản bài', entityType: 'Post', entityLabel: 'Bài viết', entityId: '8f0c1d2e-aaaa', changedFields: ['Status'], createdAt: '2026-10-05T02:00:00Z' }], totalItems: 1, page: 1, pageSize: 20 }),
    '/api/admin/activity-logs/filters': () => ok({ actions: [{ value: 'PUBLISH_POST', label: 'Xuất bản bài' }], entityTypes: [{ value: 'Post', label: 'Bài viết' }] }),
    '/api/admin/users': () => ok({ items: [] }),
  })
  renderPage('/admin/activity-logs?action=PUBLISH_POST', '/admin/activity-logs', <App><ActivityLogs /></App>)
  expect(await screen.findByText('Xuất bản bài', { selector: '.ant-tag' })).toBeTruthy()
  expect(screen.getByText('Quản trị Khoa')).toBeTruthy()
  await waitFor(() => expect(String(api.calls('/api/admin/activity-logs')[0][0])).toContain('action=PUBLISH_POST'))
  expect(screen.queryByRole('button', { name: /Sửa|Xóa nhật ký/ })).toBeNull()
})
