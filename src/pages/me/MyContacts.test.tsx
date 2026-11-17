// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyContacts from './MyContacts'
import { ContactStatusBadge } from '../../components/ui/Badge'
import { deferred, mockApi, ok, renderPage, reply } from '../../lib/test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const me = { '/api/auth/me': () => ok({ id: 'u1', username: '24520100', fullName: 'Trần Minh An', role: 'student', email: 'an@gm.uit.edu.vn' }) }
const item = (id: string, subject: string, status: string) => ({ id, subject, message: 'Nội dung', status, createdAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-11T02:00:00Z' })
const pageOf = (items: unknown[], page: number, totalItems: number) => ({ items, totalItems, page, pageSize: 10, totalPages: Math.ceil(totalItems / 10) })
const open = (path = '/me/contacts') => renderPage(path, '/me/contacts', <MyContacts />)

test('AC7: khách chuyển tới đăng nhập, next trỏ về /me/contacts', async () => {
  mockApi({ '/api/auth/me': () => reply(401) })
  open()
  expect(await screen.findByTestId('path')).toHaveProperty('textContent', '/login?next=%2Fme%2Fcontacts')
})

test('AC1: danh sách hiện tiêu đề, ngày gửi, badge đủ 4 trạng thái, link tới chi tiết', async () => {
  const items = [
    item('c1', 'Xin xác nhận sinh viên', 'new'),
    item('c2', 'Hỏi lịch bảo vệ', 'in_progress'),
    item('c3', 'Đổi thông tin hồ sơ', 'resolved'),
    item('c4', 'Yêu cầu cũ', 'closed'),
  ]
  mockApi({ ...me, '/api/me/contact-requests': () => ok(pageOf(items, 1, 4)) })
  open()
  const link = await screen.findByRole('link', { name: /Xin xác nhận sinh viên/ })
  expect(link.getAttribute('href')).toBe('/me/contacts/c1')
  expect(within(link).getByText('Mới')).toBeTruthy()
  expect(within(link).getByText(/10\/10\/2026/)).toBeTruthy()
  expect(within(screen.getByRole('link', { name: /Hỏi lịch bảo vệ/ })).getByText('Đang xử lý')).toBeTruthy()
  expect(within(screen.getByRole('link', { name: /Đổi thông tin hồ sơ/ })).getByText('Đã giải quyết')).toBeTruthy()
  expect(within(screen.getByRole('link', { name: /Yêu cầu cũ/ })).getByText('Đóng')).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: /Phân trang|Pagination/ })).toBeNull()
})

test('đang tải: chưa hiện danh sách lẫn trạng thái rỗng', async () => {
  const d = deferred<Response>()
  mockApi({ ...me, '/api/me/contact-requests': () => d.promise })
  open()
  await screen.findByRole('heading', { name: 'Yêu cầu đã gửi' })
  expect(screen.queryByText('Chưa gửi yêu cầu nào')).toBeNull()
  d.resolve(ok(pageOf([], 1, 0)))
  expect(await screen.findByText('Chưa gửi yêu cầu nào')).toBeTruthy()
})

test('AC2: ?page=2 gọi API page=2&pageSize=10, có phân trang, bấm trang 1 gọi lại', async () => {
  const api = mockApi({ ...me, '/api/me/contact-requests': (url) => ok(url.includes('page=2') ? pageOf([item('c11', 'Yêu cầu thứ 11', 'new')], 2, 11) : pageOf([item('c1', 'Yêu cầu đầu', 'new')], 1, 11)) })
  open('/me/contacts?page=2')
  expect(await screen.findByText('Yêu cầu thứ 11')).toBeTruthy()
  expect(String(api.calls('/api/me/contact-requests')[0][0])).toContain('page=2&pageSize=10')
  await userEvent.click(within(screen.getByRole('navigation', { name: /Phân trang|Pagination/ })).getByRole('button', { name: '1' }))
  expect(await screen.findByText('Yêu cầu đầu')).toBeTruthy()
  expect(String(api.calls('/api/me/contact-requests').at(-1)![0])).toContain('page=1&pageSize=10')
})

test('AC3: rỗng hiện EmptyState', async () => {
  mockApi({ ...me, '/api/me/contact-requests': () => ok(pageOf([], 1, 0)) })
  open()
  expect(await screen.findByText('Chưa gửi yêu cầu nào')).toBeTruthy()
})

test('?page vượt số trang: báo trang không có yêu cầu và vẫn có phân trang, không hiện trạng thái rỗng', async () => {
  mockApi({ ...me, '/api/me/contact-requests': () => ok({ ...pageOf([], 99, 11), page: 99 }) })
  open('/me/contacts?page=99')
  expect(await screen.findByText('Trang này không có yêu cầu')).toBeTruthy()
  expect(screen.queryByText('Chưa gửi yêu cầu nào')).toBeNull()
  expect(screen.getByRole('navigation', { name: /Phân trang|Pagination/ })).toBeTruthy()
})

test('AC4: lỗi 500 hiện Alert, không hiện trạng thái rỗng', async () => {
  mockApi({ ...me, '/api/me/contact-requests': () => reply(500) })
  open()
  expect(await screen.findByText(/Chưa tải được danh sách yêu cầu/)).toBeTruthy()
  expect(screen.queryByText('Chưa gửi yêu cầu nào')).toBeNull()
})

test('ContactStatusBadge: trạng thái lạ hiện nguyên giá trị, không vỡ', () => {
  // @ts-expect-error cố ý truyền trạng thái ngoài danh sách
  render(<ContactStatusBadge status="spam" />)
  expect(screen.getByText('spam')).toBeTruthy()
})
