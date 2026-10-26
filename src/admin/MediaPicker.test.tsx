// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaPicker } from './MediaPicker'
import type { MediaDto } from './media'
import { mockApi, ok } from '../lib/test-utils'

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

const ANH: MediaDto = {
  id: 'm1', kind: 'image', name: 'Lễ trao học bổng 2026', description: null, altText: 'Sinh viên nhận học bổng', mimeType: 'image/png', sizeBytes: 204800,
  externalUrl: null, url: 'https://storage.test/m1', thumbnailUrl: 'https://storage.test/m1', urlExpiresAt: '2999-01-01T00:00:00Z',
  usageCount: 0, createdAt: '2026-10-01T02:00:00Z', createdBy: { id: 'me', fullName: 'Lê Thu Hà' },
}

test('chỉ ảnh: lọc kind=image ở server, chọn bằng bàn phím, trả về cả object', async () => {
  const api = mockApi({ '/api/media': () => ok({ items: [ANH], totalItems: 1, page: 1, pageSize: 24, totalPages: 1 }) })
  const onSelect = vi.fn()
  render(<MediaPicker open kinds={['image']} title="Chọn ảnh đại diện" onCancel={() => {}} onSelect={onSelect} />)

  const item = await screen.findByRole('button', { name: /Lễ trao học bổng 2026/ })
  expect(String(api.calls('/api/media')[0][0])).toContain('kind=image')
  expect(screen.queryByRole('radiogroup', { name: 'Lọc theo loại' })).toBeNull() // một loại thì không có bộ lọc loại
  const choose = screen.getByRole('button', { name: 'Chọn' })
  expect(choose.hasAttribute('disabled')).toBe(true)

  item.focus()
  await userEvent.keyboard('{Enter}')
  expect(item.getAttribute('aria-pressed')).toBe('true')
  await userEvent.click(choose)
  expect(onSelect).toHaveBeenCalledWith(ANH)
})

test('thư viện rỗng: hiện hướng dẫn, không lỗi', async () => {
  mockApi({ '/api/media': () => ok({ items: [], totalItems: 0, page: 1, pageSize: 24, totalPages: 0 }) })
  render(<MediaPicker open onCancel={() => {}} onSelect={() => {}} />)
  expect(await screen.findByText(/Thư viện chưa có tài nguyên phù hợp/)).toBeTruthy()
})

test('chỉ video: lọc kind=video ở server và hiển thị video', async () => {
  const VIDEO: MediaDto = {
    ...ANH,
    id: 'v1',
    kind: 'video',
    name: 'Video Gioi Thieu Khoa',
    altText: null,
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  }
  const api = mockApi({ '/api/media': () => ok({ items: [VIDEO], totalItems: 1, page: 1, pageSize: 24, totalPages: 1 }) })
  const onSelect = vi.fn()
  render(<MediaPicker open kinds={['video']} title="Chèn video" onCancel={() => {}} onSelect={onSelect} />)

  const item = await screen.findByRole('button', { name: /Video Gioi Thieu Khoa/ })
  expect(String(api.calls('/api/media')[0][0])).toContain('kind=video')
  await userEvent.click(item)
  await userEvent.click(screen.getByRole('button', { name: 'Chọn' }))
  expect(onSelect).toHaveBeenCalledWith(VIDEO)
})

