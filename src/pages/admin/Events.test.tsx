// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import dayjs from 'dayjs'
import Events, { checkTimes, type EventDetail } from './Events'
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
const EV: EventDetail = {
  id: 'e1', title: 'Hội thảo khoa học sinh viên 2026', description: 'Báo cáo đề tài.', venue: 'Hội trường E', capacity: 100, registeredCount: 40,
  startAt: '2026-11-20T01:00:00Z', endAt: '2026-11-20T04:00:00Z', registrationDeadline: '2026-11-18T10:00:00Z', status: 'published',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z',
}
const open = (path = '/admin/events') => renderPage(path, '/admin/events', <App><Events /></App>)

test('checkTimes: kết thúc sau bắt đầu, hạn đăng ký không sau bắt đầu', () => {
  const start = dayjs('2026-11-20T08:00')
  expect(checkTimes({ startAt: start, endAt: start.subtract(1, 'hour'), registrationDeadline: start.add(1, 'day') }).map((e) => e.name)).toEqual(['endAt', 'registrationDeadline'])
  expect(checkTimes({ startAt: start, endAt: start.add(2, 'hour'), registrationDeadline: start })).toEqual([])
})

test('danh sách: hiện số đã đăng ký/sức chứa và trạng thái', async () => {
  mockApi({ ...admin, '/api/admin/events': () => ok({ items: [EV], totalItems: 1, page: 1, pageSize: 20 }) })
  open()
  const row = await screen.findByRole('row', { name: /Hội thảo khoa học sinh viên 2026/ })
  expect(within(row).getByText('40/100')).toBeTruthy()
  expect(within(row).getByText('Đang mở')).toBeTruthy()
})

test('sửa: giảm sức chứa dưới số đã đăng ký thì báo lỗi tại ô, không gửi', async () => {
  const api = mockApi({ ...admin, '/api/admin/events': () => ok({ items: [EV], totalItems: 1, page: 1, pageSize: 20 }), '/api/admin/events/e1': () => ok(EV) })
  open('/admin/events?action=edit&id=e1')
  const cap = await screen.findByLabelText('Sức chứa')
  await waitFor(() => expect((cap as HTMLInputElement).value).toBe('100'))
  await userEvent.clear(cap)
  await userEvent.type(cap, '10')
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Sức chứa từ 40 đến 10000.')).toBeTruthy()
  expect(api.calls('/api/admin/events/e1').filter(([, i]) => i?.method === 'PUT')).toHaveLength(0)
})

test('sửa: lỗi 422 capacity_below_registered từ server gắn vào ô Sức chứa; không gửi registeredCount', async () => {
  const api = mockApi({
    ...admin,
    '/api/admin/events': () => ok({ items: [EV], totalItems: 1, page: 1, pageSize: 20 }),
    '/api/admin/events/e1': (_, init) => init?.method === 'PUT'
      ? reply(422, { title: 'Sức chứa nhỏ hơn số đã đăng ký', status: 422, code: 'capacity_below_registered', detail: 'Sự kiện đã có 45 người đăng ký, không giảm sức chứa xuống 42 được.' })
      : ok(EV),
  })
  open('/admin/events?action=edit&id=e1')
  const cap = await screen.findByLabelText('Sức chứa')
  await waitFor(() => expect((cap as HTMLInputElement).value).toBe('100'))
  await userEvent.clear(cap)
  await userEvent.type(cap, '42')
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Sự kiện đã có 45 người đăng ký, không giảm sức chứa xuống 42 được.')).toBeTruthy()
  const body = JSON.parse(String(api.calls('/api/admin/events/e1').find(([, i]) => i?.method === 'PUT')![1]?.body))
  expect(body).not.toHaveProperty('registeredCount')
  expect(body.startAt).toBe('2026-11-20T01:00:00.000Z') // giờ Việt Nam 08:00 -> UTC
})
