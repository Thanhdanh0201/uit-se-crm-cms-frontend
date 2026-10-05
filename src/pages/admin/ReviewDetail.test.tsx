// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import ReviewDetail from './ReviewDetail'
import type { PostDetail, PostHistoryItem } from '../../admin/posts'
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

const admin = { '/api/auth/me': () => ok({ id: 'ad', username: 'admin.khoa', fullName: 'Quản trị Khoa', role: 'admin', email: 'admin@uit.edu.vn' }) }
const editor = { '/api/auth/me': () => ok({ id: 'me', username: 'ha.le', fullName: 'Lê Thu Hà', role: 'editor', email: 'ha@uit.edu.vn' }) }

const POST: PostDetail = {
  id: 'p1', title: 'Thông báo học bổng học kỳ 1', slug: 'thong-bao-hoc-bong', summary: 'Hạn nộp 30/10.', status: 'pending', version: 2,
  author: { id: 'me', name: 'Lê Thu Hà' }, primaryCategoryId: 'c1', categories: [{ id: 'c1', name: 'Thông báo' }], tags: [],
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sinh viên nộp hồ sơ tại văn phòng Khoa.' }] }] },
  cover: null, media: {}, reviewReason: null, isFeatured: false, priority: 0, publishedAt: null, expiresAt: null,
  createdAt: '2026-10-01T02:00:00Z', updatedAt: '2026-10-05T02:00:00Z', allowedStatuses: ['published', 'changes_requested'],
}
const SUBMITTED: PostHistoryItem[] = [
  { id: 'h2', fromStatus: 'draft', toStatus: 'pending', reason: null, actor: { id: 'me', name: 'Lê Thu Hà' }, createdAt: '2026-10-05T02:00:00Z' },
  { id: 'h1', fromStatus: null, toStatus: 'draft', reason: null, actor: { id: 'me', name: 'Lê Thu Hà' }, createdAt: '2026-10-01T02:00:00Z' },
]

const open = () => renderPage('/admin/review/p1', '/admin/review/:id', <App><ReviewDetail /></App>)
const findDialog = (text: string) =>
  waitFor(() => {
    const d = screen.getAllByRole('dialog').filter((x) => within(x).queryAllByText(text).length > 0).at(-1)
    if (!d) throw new Error(`chưa có dialog ${text}`)
    return d
  })

test('yêu cầu chỉnh sửa: bắt buộc lý do, gửi kèm version, tải lại lịch sử', async () => {
  let state: 'pending' | 'changes_requested' = 'pending'
  const api = mockApi({
    ...admin,
    '/api/posts/p1': () => ok(state === 'pending' ? POST : { ...POST, status: 'changes_requested', version: 3, reviewReason: 'Bổ sung địa điểm nộp.', allowedStatuses: [] }),
    '/api/posts/p1/history': () =>
      ok(state === 'pending' ? SUBMITTED : [{ id: 'h3', fromStatus: 'pending', toStatus: 'changes_requested', reason: 'Bổ sung địa điểm nộp.', actor: { id: 'ad', name: 'Quản trị Khoa' }, createdAt: '2026-10-05T03:00:00Z' }, ...SUBMITTED]),
    '/api/posts/p1/status': () => ((state = 'changes_requested'), ok({})),
  })
  open()
  expect(await screen.findByText('Sinh viên nộp hồ sơ tại văn phòng Khoa.')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Yêu cầu chỉnh sửa' }))
  const dialog = await findDialog('Gửi yêu cầu')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await within(dialog).findByText('Nhập lý do để tác giả biết cần sửa gì.')).toBeTruthy()
  expect(api.calls('/api/posts/p1/status')).toHaveLength(0)

  await userEvent.type(within(dialog).getByLabelText('Lý do'), 'Bổ sung địa điểm nộp.')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await screen.findByText('Đã gửi yêu cầu chỉnh sửa cho tác giả.')).toBeTruthy()
  expect(JSON.parse(String(api.calls('/api/posts/p1/status')[0][1]?.body))).toEqual({ toStatus: 'changes_requested', version: 2, reason: 'Bổ sung địa điểm nộp.' })
  expect(await screen.findByText(/chuyển từ Chờ duyệt sang Yêu cầu chỉnh sửa/)).toBeTruthy()
  expect(api.calls('/api/posts/p1/history')).toHaveLength(2)
})

test('xuất bản: phải xác nhận trong hộp thoại, xuất bản ngay khi không hẹn giờ', async () => {
  const api = mockApi({ ...admin, '/api/posts/p1': () => ok(POST), '/api/posts/p1/history': () => ok(SUBMITTED), '/api/posts/p1/status': () => ok({}) })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Xuất bản' }))
  expect(api.calls('/api/posts/p1/status')).toHaveLength(0) // mới mở hộp thoại, chưa gửi
  const dialog = await findDialog('Hẹn giờ xuất bản')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xuất bản' }))
  expect(await screen.findByText('Đã xuất bản "Thông báo học bổng học kỳ 1".')).toBeTruthy()
  expect(JSON.parse(String(api.calls('/api/posts/p1/status')[0][1]?.body))).toEqual({ toStatus: 'published', version: 2 })
})

test('lỗi API khi xuất bản: hiện lý do, không báo thành công', async () => {
  mockApi({
    ...admin,
    '/api/posts/p1': () => ok(POST),
    '/api/posts/p1/history': () => ok(SUBMITTED),
    '/api/posts/p1/status': () => reply(400, { title: 'Validation', status: 400, errors: { CoverMediaId: ['Chọn ảnh đại diện trước khi gửi duyệt.'] } }),
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Xuất bản' }))
  await userEvent.click(within(await findDialog('Hẹn giờ xuất bản')).getByRole('button', { name: 'Xuất bản' }))
  expect(await screen.findByText('Chọn ảnh đại diện trước khi gửi duyệt.')).toBeTruthy()
  expect(screen.queryByText(/Đã xuất bản/)).toBeNull()
})

test('editor vào trang duyệt: bị chuyển sang 403, không thấy nút duyệt', async () => {
  mockApi({ ...editor, '/api/posts/p1': () => ok(POST), '/api/posts/p1/history': () => ok(SUBMITTED) })
  open()
  await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/403'))
  expect(screen.queryByRole('button', { name: 'Xuất bản' })).toBeNull()
})
