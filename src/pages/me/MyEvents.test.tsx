// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyEvents from './MyEvents'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom chưa có showModal/close của <dialog>: giả lập bằng thuộc tính open.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const confirmBtn = () => within(document.querySelector('dialog[open]') as HTMLElement).getByRole('button', { name: 'Hủy đăng ký' })

const me = { '/api/auth/me': () => ok({ id: 'u1', username: '24520100', fullName: 'Trần Minh An', role: 'student', email: 'an@gm.uit.edu.vn' }) }
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const event = (id: string, title: string) => ({
  id, title, description: '', startAt: future(10), endAt: null, venue: 'Hội trường A', registrationDeadline: future(5),
  capacity: 50, registeredCount: 10, status: 'published', myRegistration: null,
})
const reg = (id: string, title: string, status: 'active' | 'cancelled') => ({ event: event(id, title), status, registeredAt: future(-1), cancelledAt: status === 'cancelled' ? future(-0.5) : null })
const pageOf = (items: unknown[]) => ({ items, totalItems: items.length, page: 1, pageSize: 10, totalPages: items.length ? 1 : 0 })
const open = () => renderPage('/me/events', '/me/events', <MyEvents />)

test('khách: chuyển tới đăng nhập kèm next', async () => {
  mockApi({ '/api/auth/me': () => reply(401) })
  open()
  expect(await screen.findByTestId('path')).toHaveProperty('textContent', '/login?next=%2Fme%2Fevents')
})

test('danh sách: badge Đang đăng ký / Đã hủy; chỉ lượt đang đăng ký có nút hủy', async () => {
  mockApi({ ...me, '/api/me/registrations': () => ok(pageOf([reg('e1', 'Hội thảo AI-SE 2026', 'active'), reg('e2', 'Workshop DevOps', 'cancelled')])) })
  open()
  expect(await screen.findByText('Đang đăng ký')).toBeTruthy()
  expect(screen.getByText('Đã hủy')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Hủy đăng ký Hội thảo AI-SE 2026' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Hủy đăng ký Workshop DevOps' })).toBeNull()
})

test('hủy: xác nhận mới gọi DELETE, sau đó tải lại danh sách', async () => {
  let items = [reg('e1', 'Hội thảo AI-SE 2026', 'active')]
  const api = mockApi({
    ...me,
    '/api/me/registrations': () => ok(pageOf(items)),
    '/api/events/e1/registrations/me': () => {
      items = [reg('e1', 'Hội thảo AI-SE 2026', 'cancelled')]
      return ok(event('e1', 'Hội thảo AI-SE 2026'))
    },
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Hủy đăng ký Hội thảo AI-SE 2026' }))
  expect(api.calls('/api/events/e1/registrations/me')).toHaveLength(0)
  await screen.findByText('Hủy đăng ký sự kiện này?')
  const before = api.calls('/api/me/registrations').length
  await userEvent.click(confirmBtn())
  await waitFor(() => expect(api.calls('/api/events/e1/registrations/me')).toHaveLength(1))
  expect((api.calls('/api/events/e1/registrations/me')[0][1] as RequestInit).method).toBe('DELETE')
  expect(await screen.findByText(/Đã hủy đăng ký "Hội thảo AI-SE 2026"/)).toBeTruthy()
  await waitFor(() => expect(api.calls('/api/me/registrations').length).toBeGreaterThan(before))
  expect(screen.queryByRole('button', { name: 'Hủy đăng ký Hội thảo AI-SE 2026' })).toBeNull()
})

test('hủy lỗi cancel_closed: báo lý do và vẫn tải lại', async () => {
  const api = mockApi({
    ...me,
    '/api/me/registrations': () => ok(pageOf([reg('e1', 'Hội thảo AI-SE 2026', 'active')])),
    '/api/events/e1/registrations/me': () => reply(422, { title: 'x', code: 'cancel_closed' }),
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Hủy đăng ký Hội thảo AI-SE 2026' }))
  await userEvent.click(confirmBtn())
  expect(await screen.findByText('Đã quá hạn hủy đăng ký sự kiện này.')).toBeTruthy()
  expect(api.calls('/api/me/registrations').length).toBeGreaterThan(1)
})

test('rỗng: trạng thái rỗng; API lỗi: báo lỗi', async () => {
  mockApi({ ...me, '/api/me/registrations': () => ok(pageOf([])) })
  open()
  expect(await screen.findByText('Bạn chưa đăng ký sự kiện nào')).toBeTruthy()
  cleanup()
  mockApi({ ...me, '/api/me/registrations': () => reply(500) })
  open()
  expect(await screen.findByText(/Chưa tải được danh sách/)).toBeTruthy()
})
