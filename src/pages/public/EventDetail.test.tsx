// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, isRouteErrorResponse, RouterProvider, useLoaderData, useRouteError, type LoaderFunction } from 'react-router'
import { AuthProvider } from '../../lib/auth'
import { deferred, mockApi, ok, reply } from '../../lib/test-utils'
import EventDetail, { loader } from './EventDetail'
import type { PublicEvent } from './events.data'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// jsdom chưa có showModal/close của <dialog>: giả lập bằng thuộc tính open.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const confirmBtn = () => within(document.querySelector('dialog[open]') as HTMLElement).getByRole('button', { name: 'Hủy đăng ký' })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Page = () => <EventDetail {...({ loaderData: useLoaderData() } as any)} />
function RouteError() {
  const error = useRouteError()
  return <h1>{isRouteErrorResponse(error) && error.status === 404 ? 'Không tìm thấy trang' : 'Đã có lỗi xảy ra'}</h1>
}

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const ev = (o: Partial<PublicEvent> = {}): PublicEvent => ({
  id: 'e1', title: 'Hội thảo AI-SE 2026', description: 'Seminar về AI trong kỹ thuật phần mềm.', startAt: future(10), endAt: null, venue: 'Hội trường A',
  registrationDeadline: future(5), capacity: 50, registeredCount: 10, status: 'published', createdAt: '', updatedAt: '', myRegistration: null, ...o,
})

const guest = { '/api/auth/me': () => reply(401) }
const student = { '/api/auth/me': () => ok({ id: 'u1', username: '24520100', fullName: 'Trần Minh An', role: 'student', email: 'an@gm.uit.edu.vn' }) }

function open(path = '/events/e1') {
  const router = createMemoryRouter(
    [
      { path: 'events/:id', loader: loader as unknown as LoaderFunction, Component: Page as ComponentType, ErrorBoundary: RouteError },
      { path: 'en/events/:id', loader: loader as unknown as LoaderFunction, Component: Page as ComponentType, ErrorBoundary: RouteError },
    ],
    { initialEntries: [path] },
  )
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>)
  return router
}

// GET trả `state.current` (đổi được giữa chừng), POST/DELETE do test cấp.
function backend(state: { current: PublicEvent }, extra: Record<string, (url: string, init?: RequestInit) => Response | Promise<Response>> = {}) {
  return mockApi({ ...student, '/api/public/events/e1': () => ok(state.current), ...extra })
}

test('khách: link đăng nhập giữ next, bản /en giữ tiền tố trong next', async () => {
  mockApi({ ...guest, '/api/public/events/e1': () => ok(ev()) })
  open('/events/e1')
  const link = await screen.findByRole('link', { name: 'Đăng nhập để đăng ký' })
  expect(link.getAttribute('href')).toBe('/login?next=%2Fevents%2Fe1')
  cleanup()

  open('/en/events/e1')
  const en = await screen.findByRole('link', { name: 'Sign in to register' })
  expect(en.getAttribute('href')).toBe('/login?next=%2Fen%2Fevents%2Fe1')
  expect(en.getAttribute('href')).not.toMatch(/^\/en\//)
})

test('khách + sự kiện hết hạn: không có link đăng nhập, hiện lý do', async () => {
  mockApi({ ...guest, '/api/public/events/e1': () => ok(ev({ registrationDeadline: future(-1) })) })
  open()
  expect((await screen.findAllByText('Hết hạn đăng ký')).length).toBeGreaterThan(0)
  expect(screen.queryByRole('link', { name: 'Đăng nhập để đăng ký' })).toBeNull()
})

test('đăng ký: giữ request thì nút disabled, bấm 2 lần chỉ 1 POST, chưa báo thành công; xong thì báo và cập nhật số chỗ', async () => {
  const state = { current: ev() }
  const d = deferred<Response>()
  const api = backend(state, { '/api/events/e1/registrations': () => d.promise })
  open()
  expect(await screen.findByText('10/50')).toBeTruthy()
  const btn = await screen.findByRole('button', { name: 'Đăng ký' })
  await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
  await userEvent.click(btn)
  await userEvent.click(btn)
  await waitFor(() => expect((screen.getByRole('button', { name: /Đăng ký/ }) as HTMLButtonElement).disabled).toBe(true))
  expect(api.calls('/api/events/e1/registrations')).toHaveLength(1)
  expect((api.calls('/api/events/e1/registrations')[0][1] as RequestInit).method).toBe('POST')
  expect(screen.queryByText('Đăng ký thành công.')).toBeNull()

  state.current = ev({ registeredCount: 11, myRegistration: 'active' })
  d.resolve(ok(state.current))
  expect(await screen.findByText('Đăng ký thành công.')).toBeTruthy()
  expect(screen.getByText('11/50')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Hủy đăng ký' })).toBeTruthy()
  expect(screen.getByText('Bạn đã đăng ký')).toBeTruthy()
})

test.each([
  [422, 'event_full', 'Sự kiện đã đủ chỗ.'],
  [422, 'registration_closed', 'Sự kiện đã hết hạn đăng ký.'],
  [409, 'already_registered', 'Bạn đã đăng ký sự kiện này rồi.'],
])('đăng ký lỗi %i %s: hiện thông báo, tải lại sự kiện, không báo thành công', async (status, code, text) => {
  const state = { current: ev() }
  const api = backend(state, { '/api/events/e1/registrations': () => reply(status, { title: 'x', detail: 'Chi tiết server', code }) })
  open()
  const btn = await screen.findByRole('button', { name: 'Đăng ký' })
  await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false))
  const before = api.calls('/api/public/events/e1').length
  await userEvent.click(btn)
  expect(await screen.findByText(text)).toBeTruthy()
  await waitFor(() => expect(api.calls('/api/public/events/e1').length).toBeGreaterThan(before))
  expect(screen.queryByText('Đăng ký thành công.')).toBeNull()
})

test('hủy: ConfirmDialog, xác nhận gửi 1 DELETE, nút về "Đăng ký"', async () => {
  const state = { current: ev({ registeredCount: 11, myRegistration: 'active' }) }
  const api = backend(state, {
    '/api/events/e1/registrations/me': () => {
      state.current = ev({ registeredCount: 10 })
      return ok(state.current)
    },
  })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Hủy đăng ký' }))
  expect(api.calls('/api/events/e1/registrations/me')).toHaveLength(0)
  expect(await screen.findByText('Hủy đăng ký sự kiện này?')).toBeTruthy()
  await userEvent.click(confirmBtn())
  expect(await screen.findByText('Đã hủy đăng ký.')).toBeTruthy()
  expect(api.calls('/api/events/e1/registrations/me')).toHaveLength(1)
  expect((api.calls('/api/events/e1/registrations/me')[0][1] as RequestInit).method).toBe('DELETE')
  expect(screen.getByRole('button', { name: 'Đăng ký' })).toBeTruthy()
  expect(screen.getByText('10/50')).toBeTruthy()
})

test('hủy bị từ chối cancel_closed: hiện thông báo, không báo thành công', async () => {
  const state = { current: ev({ myRegistration: 'active' }) }
  backend(state, { '/api/events/e1/registrations/me': () => reply(422, { title: 'x', code: 'cancel_closed' }) })
  open()
  await userEvent.click(await screen.findByRole('button', { name: 'Hủy đăng ký' }))
  await userEvent.click(confirmBtn())
  expect(await screen.findByText('Đã quá hạn hủy đăng ký sự kiện này.')).toBeTruthy()
  expect(screen.queryByText('Đã hủy đăng ký.')).toBeNull()
})

test('đã đăng ký nhưng quá hạn: không có nút Hủy, hiện gợi ý', async () => {
  backend({ current: ev({ myRegistration: 'active', registrationDeadline: future(-1) }) })
  open()
  expect(await screen.findByText('Đã quá hạn đăng ký nên không hủy được.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Hủy đăng ký' })).toBeNull()
})

test('hết hạn hoặc cancelled: không có nút Đăng ký', async () => {
  backend({ current: ev({ registrationDeadline: future(-1) }) })
  open()
  expect((await screen.findAllByText('Hết hạn đăng ký')).length).toBeGreaterThan(1)
  expect(screen.queryByRole('button', { name: 'Đăng ký' })).toBeNull()
  cleanup()

  backend({ current: ev({ status: 'cancelled' }) })
  open()
  expect((await screen.findAllByText('Sự kiện đã hủy')).length).toBeGreaterThan(1)
  expect(screen.queryByRole('button', { name: 'Đăng ký' })).toBeNull()
})

test('loader: 404 và 400 thành trang không tìm thấy; lỗi khác không bị nuốt', async () => {
  mockApi({ ...guest, '/api/public/events/e1': () => reply(404, { title: 'Not found' }) })
  open()
  expect(await screen.findByText('Không tìm thấy trang')).toBeTruthy()
  cleanup()

  mockApi({ ...guest, '/api/public/events/e1': () => reply(400, { title: 'bad' }) })
  open()
  expect(await screen.findByText('Không tìm thấy trang')).toBeTruthy()
  cleanup()

  mockApi({ ...guest, '/api/public/events/e1': () => reply(500, { title: 'boom' }) })
  open()
  expect(await screen.findByText('Đã có lỗi xảy ra')).toBeTruthy()
})
