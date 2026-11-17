// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import MyContactDetail from './MyContactDetail'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const me = { '/api/auth/me': () => ok({ id: 'u1', username: '24520100', fullName: 'Trần Minh An', role: 'student', email: 'an@gm.uit.edu.vn' }) }
const open = (id = 'c1') => renderPage(`/me/contacts/${id}`, '/me/contacts/:id', <MyContactDetail />)
const NOT_FOUND = 'Không tìm thấy yêu cầu hoặc bạn không có quyền xem'

test('AC7: khách chuyển tới đăng nhập với next của trang chi tiết', async () => {
  mockApi({ '/api/auth/me': () => reply(401) })
  open()
  expect(await screen.findByTestId('path')).toHaveProperty('textContent', '/login?next=%2Fme%2Fcontacts%2Fc1')
})

test('AC5: hiện subject, message, trạng thái; không render ghi chú nội bộ dù payload có notes', async () => {
  mockApi({
    ...me,
    '/api/me/contact-requests/c1': () =>
      ok({ id: 'c1', subject: 'Xin xác nhận sinh viên', message: 'Em cần giấy xác nhận để xin visa.', status: 'in_progress', createdAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-11T02:00:00Z', notes: 'GHI CHU NOI BO TUYET MAT', internalNotes: 'NOI BO 2' }),
  })
  const { container } = open()
  expect(await screen.findByRole('heading', { name: 'Xin xác nhận sinh viên' })).toBeTruthy()
  expect(screen.getByText('Em cần giấy xác nhận để xin visa.')).toBeTruthy()
  expect(screen.getByText('Đang xử lý')).toBeTruthy()
  expect(container.textContent).not.toContain('NOI BO')
})

test('AC6: 404 và 403 hiện thông báo chung kèm link về danh sách, không hiện dữ liệu', async () => {
  for (const status of [404, 403]) {
    mockApi({ ...me, '/api/me/contact-requests/c9': () => reply(status, { title: 'x', detail: 'Yêu cầu của Lê Văn B' }) })
    const { container } = open('c9')
    expect(await screen.findByText(NOT_FOUND)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Về danh sách yêu cầu' }).getAttribute('href')).toBe('/me/contacts')
    expect(container.textContent).not.toContain('Lê Văn B')
    expect(screen.queryByText(/Chưa tải được yêu cầu/)).toBeNull()
    cleanup()
  }
})

test('AC4: lỗi 500 hiện Alert, không hiện "không tìm thấy"', async () => {
  mockApi({ ...me, '/api/me/contact-requests/c1': () => reply(500) })
  open()
  expect(await screen.findByText(/Chưa tải được yêu cầu/)).toBeTruthy()
  expect(screen.queryByText(NOT_FOUND)).toBeNull()
})
