// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Contacts, { type ContactDetail } from './Contacts'
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
export const C: ContactDetail = {
  id: 'c1', senderName: 'Trần Minh An', senderEmail: 'an24520100@gm.uit.edu.vn', subject: 'Hỏi về học bổng', status: 'new', classification: null,
  assignee: null, userId: null, createdAt: '2026-10-05T02:00:00Z', updatedAt: '2026-10-05T02:00:00Z',
  message: '<img src=x onerror=alert(1)>\nEm muốn hỏi hạn nộp hồ sơ.', notes: [],
}
const page = (items: ContactDetail[]) => ok({ items, totalItems: items.length, page: 1, pageSize: 20 })
const option = async (title: string) => (await screen.findAllByTitle(title)).find((el) => el.classList.contains('ant-select-item-option'))!
const open = (path = '/admin/contact-requests') => renderPage(path, '/admin/contacts', <App><Contacts /></App>)

test('lọc trạng thái, phân loại, từ khóa trên URL gửi đúng query', async () => {
  const api = mockApi({ ...admin, '/api/admin/contact-requests': () => page([C]) })
  open('/admin/contacts?status=new&classification=academic&keyword=học bổng')
  expect(await screen.findByRole('button', { name: 'Hỏi về học bổng' })).toBeTruthy()
  expect(String(api.calls('/api/admin/contact-requests')[0][0])).toContain('status=new&classification=academic&search=h')
})

test('chi tiết: nội dung hiện dạng chữ (không chạy HTML); đổi trạng thái chỉ cập nhật sau khi API thành công', async () => {
  const api = mockApi({
    ...admin,
    '/api/admin/contact-requests': () => page([C]),
    '/api/admin/contact-requests/c1': (_, init) => init?.method === 'PATCH' ? ok({ ...C, status: 'in_progress' }) : ok(C),
  })
  open('/admin/contacts?action=edit&id=c1')
  expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeTruthy()
  expect(document.querySelector('img[src="x"]')).toBeNull()

  fireEvent.mouseDown(screen.getByLabelText('Trạng thái xử lý'))
  await userEvent.click(await option('Đang xử lý'))
  expect(await screen.findByText('Đã chuyển sang Đang xử lý.')).toBeTruthy()
  expect(JSON.parse(String(api.calls('/api/admin/contact-requests/c1').find(([, i]) => i?.method === 'PATCH')![1]?.body))).toEqual({ status: 'in_progress' })
})

test('đổi trạng thái lỗi 403: báo lỗi, giữ trạng thái cũ', async () => {
  mockApi({
    ...admin,
    '/api/admin/contact-requests': () => page([C]),
    '/api/admin/contact-requests/c1': (_, init) => init?.method === 'PATCH' ? reply(403, { title: 'Forbidden', status: 403 }) : ok(C),
  })
  open('/admin/contacts?action=edit&id=c1')
  const sel = await screen.findByLabelText('Trạng thái xử lý')
  fireEvent.mouseDown(sel)
  await userEvent.click(await option('Đã giải quyết'))
  expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeTruthy()
  await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByText('Mới').length).toBeGreaterThan(0))
})
