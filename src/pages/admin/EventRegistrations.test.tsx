// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import EventRegistrations from './EventRegistrations'
import { fileNameFrom } from '../../lib/api'
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
const EV = { id: 'e1', title: 'Hội thảo AI', description: '', venue: 'E', capacity: 100, registeredCount: 2, startAt: '2026-11-20T01:00:00Z', endAt: null, registrationDeadline: '2026-11-18T10:00:00Z', status: 'published', createdAt: '', updatedAt: '' }
const REGS = { items: [{ id: 'r1', userId: 'u1', fullName: 'Trần Minh An', username: '24520100', status: 'active', registeredAt: '2026-10-05T02:00:00Z', cancelledAt: null }], totalItems: 1, page: 1, pageSize: 20 }
const open = (path = '/admin/events/e1') => renderPage(path, '/admin/events/:id', <App><EventRegistrations /></App>)

test('fileNameFrom: ưu tiên filename* UTF-8', () => {
  expect(fileNameFrom("attachment; filename=dang-ky.csv; filename*=UTF-8''dang-ky-h%E1%BB%99i-th%E1%BA%A3o.csv")).toBe('dang-ky-hội-thảo.csv')
  expect(fileNameFrom('attachment; filename="dang-ky.csv"')).toBe('dang-ky.csv')
  expect(fileNameFrom(null)).toBeNull()
})

test('tìm kiếm và lọc giữ trên URL, gửi đúng query', async () => {
  const api = mockApi({ ...admin, '/api/admin/events/e1': () => ok(EV), '/api/admin/events/e1/registrations': () => ok(REGS) })
  open('/admin/events/e1?status=active&keyword=an')
  expect(await screen.findByText('Trần Minh An')).toBeTruthy()
  expect(String(api.calls('/api/admin/events/e1/registrations')[0][0])).toContain('status=active&search=an')
})

test('xuất CSV: tải file từ server với tên trong header', async () => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  mockApi({
    ...admin,
    '/api/admin/events/e1': () => ok(EV),
    '/api/admin/events/e1/registrations': () => ok(REGS),
    '/api/admin/events/e1/registrations/export': () => new Response('﻿STT,Họ và tên\r\n', { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': "attachment; filename*=UTF-8''dang-ky-hoi-thao-ai-20261006.csv" } }),
  })
  open()
  await screen.findByText('Trần Minh An')
  await userEvent.click(screen.getByRole('button', { name: /Xuất CSV/ }))
  expect(await screen.findByText('Đã tải dang-ky-hoi-thao-ai-20261006.csv.')).toBeTruthy()
  expect(click).toHaveBeenCalledTimes(1)
  click.mockRestore()
})

test('xuất CSV lỗi: hiện lý do, không báo thành công', async () => {
  mockApi({
    ...admin,
    '/api/admin/events/e1': () => ok(EV),
    '/api/admin/events/e1/registrations': () => ok(REGS),
    '/api/admin/events/e1/registrations/export': () => reply(403, { title: 'Forbidden', status: 403 }),
  })
  open()
  await screen.findByText('Trần Minh An')
  await userEvent.click(screen.getByRole('button', { name: /Xuất CSV/ }))
  expect(await screen.findByText('Chưa xuất được CSV')).toBeTruthy()
  await waitFor(() => expect(screen.queryByText(/Đã tải/)).toBeNull())
})
