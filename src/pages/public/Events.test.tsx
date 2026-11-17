// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLoaderData, type LoaderFunction } from 'react-router'
import { AuthProvider } from '../../lib/auth'
import { mockApi, ok, reply } from '../../lib/test-utils'
import Events, { loader } from './Events'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Page = () => <Events {...({ loaderData: useLoaderData() } as any)} />
function open(path: string) {
  const router = createMemoryRouter([{ path: 'events', loader: loader as unknown as LoaderFunction, Component: Page as ComponentType }], { initialEntries: [path] })
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>)
}

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const item = (id: string, title: string, o: object = {}) => ({
  id, title, description: '', startAt: future(10), endAt: null, venue: 'Hội trường A', registrationDeadline: future(5),
  capacity: 50, registeredCount: 10, status: 'published', myRegistration: null, ...o,
})
const guest = { '/api/auth/me': () => reply(401) }
const pageOf = (items: unknown[]) => ({ items, totalItems: items.length, page: 1, pageSize: 10, totalPages: items.length ? 1 : 0 })

test('danh sách: tên, địa điểm, nhãn trạng thái; gọi upcoming=true pageSize=10', async () => {
  const api = mockApi({
    ...guest,
    '/api/public/events': () => ok(pageOf([item('e1', 'Hội thảo AI-SE 2026'), item('e2', 'Workshop DevOps', { registeredCount: 50 }), item('e3', 'Seminar cũ', { status: 'cancelled' })])),
  })
  open('/events')
  expect(await screen.findByText('Hội thảo AI-SE 2026')).toBeTruthy()
  expect(screen.getByText('Còn 40 chỗ')).toBeTruthy()
  expect(screen.getByText('Đã đủ chỗ')).toBeTruthy()
  expect(screen.getByText('Sự kiện đã hủy')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Hội thảo AI-SE 2026/ }).getAttribute('href')).toBe('/events/e1')
  const url = String(api.calls('/api/public/events')[0][0])
  expect(url).toContain('upcoming=true')
  expect(url).toContain('pageSize=10')
})

test('?past=1 gọi upcoming=false và tab "Đã diễn ra" được đánh dấu', async () => {
  const api = mockApi({ ...guest, '/api/public/events': () => ok(pageOf([item('e9', 'Seminar tháng 9')])) })
  open('/events?past=1')
  expect(await screen.findByText('Seminar tháng 9')).toBeTruthy()
  expect(String(api.calls('/api/public/events')[0][0])).toContain('upcoming=false')
  expect(screen.getByRole('link', { name: 'Đã diễn ra' }).getAttribute('aria-current')).toBe('page')
})

test('rỗng: EmptyState theo tab', async () => {
  mockApi({ ...guest, '/api/public/events': () => ok(pageOf([])) })
  open('/events')
  expect(await screen.findByText('Chưa có sự kiện sắp diễn ra')).toBeTruthy()
  cleanup()
  open('/events?past=1')
  expect(await screen.findByText('Chưa có sự kiện đã diễn ra')).toBeTruthy()
})

test('API lỗi: Alert, không crash', async () => {
  mockApi({ ...guest, '/api/public/events': () => reply(500, { title: 'boom' }) })
  open('/events')
  expect(await screen.findByText(/Chưa tải được danh sách sự kiện/)).toBeTruthy()
})
