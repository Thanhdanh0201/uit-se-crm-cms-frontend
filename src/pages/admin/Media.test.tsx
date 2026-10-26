// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Media from './Media'
import type { MediaDto } from '../../admin/media'
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

const me = { '/api/auth/me': () => ok({ id: 'me', username: 'ha.le', fullName: 'Lê Thu Hà', role: 'editor', email: 'ha@uit.edu.vn' }) }
const ANH: MediaDto = {
  id: 'm1', kind: 'image', name: 'Lễ trao học bổng 2026', description: null, altText: 'Sinh viên nhận học bổng', mimeType: 'image/png', sizeBytes: 204800,
  externalUrl: null, url: 'https://storage.test/m1', thumbnailUrl: 'https://storage.test/m1', urlExpiresAt: '2999-01-01T00:00:00Z',
  usageCount: 0, createdAt: '2026-10-01T02:00:00Z', createdBy: { id: 'me', fullName: 'Lê Thu Hà' },
}
const LICH: MediaDto = { ...ANH, id: 'm2', kind: 'document', name: 'Lịch thi học kỳ 1', altText: null, mimeType: 'application/pdf', thumbnailUrl: null }
const page = (items: MediaDto[]) => ok({ items, totalItems: items.length, page: 1, pageSize: 24, totalPages: 1 })
const USAGES = { coverOf: [{ id: 'p1', title: 'Thông báo học bổng', status: 'published' }], posts: [], pages: [], total: 1 }

function open(path = '/admin/media') {
  return renderPage(path, '/admin/media', <App><Media /></App>)
}

test('tải danh sách theo bộ lọc trên URL, hiện dạng lưới', async () => {
  const api = mockApi({ ...me, '/api/media': () => page([ANH, LICH]) })
  open('/admin/media?kind=image&keyword=học bổng')
  expect(await screen.findByRole('button', { name: /Lễ trao học bổng 2026/ })).toBeTruthy()
  expect(String(api.calls('/api/media')[0][0])).toContain('kind=image&search=h')
})

test('media đang được dùng: hiện nơi dùng, khóa nút xóa', async () => {
  mockApi({
    ...me,
    '/api/media': () => page([ANH]),
    '/api/media/m1': () => ok({ ...ANH, usageCount: 1 }),
    '/api/media/m1/usages': () => ok(USAGES),
  })
  open('/admin/media?action=edit&id=m1')
  expect(await screen.findByText('Ảnh đại diện bài: Thông báo học bổng (Đã xuất bản)')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Xóa/ }).hasAttribute('disabled')).toBe(true)
})

test('xóa nhưng server báo 409 media_in_use: không xóa trên UI, hiện danh sách nơi dùng từ server', async () => {
  const api = mockApi({
    ...me,
    '/api/media': () => page([ANH]),
    '/api/media/m1': (_, init) =>
      init?.method === 'DELETE'
        ? reply(409, { title: 'Tài nguyên đang được sử dụng', status: 409, code: 'media_in_use', detail: '"Lễ trao học bổng 2026" đang được dùng ở 1 bài viết hoặc trang.', usages: USAGES })
        : ok(ANH),
  })
  open('/admin/media?action=edit&id=m1')
  await userEvent.click(await screen.findByRole('button', { name: /Xóa/ }))
  expect((await screen.findAllByText('Xóa "Lễ trao học bổng 2026"?')).length).toBeGreaterThan(0)
  await userEvent.click(screen.getAllByRole('button', { name: 'Xóa' }).at(-1)!) // nút trong modal.confirm

  expect(await screen.findByText(/đang được dùng ở 1 bài viết hoặc trang/)).toBeTruthy()
  expect(screen.getByText('Ảnh đại diện bài: Thông báo học bổng (Đã xuất bản)')).toBeTruthy()
  expect(api.calls('/api/media/m1').filter(([, i]) => i?.method === 'DELETE')).toHaveLength(1)
  expect(screen.queryByText(/Đã xóa/)).toBeNull()
})

test('editor không sửa được media của người khác', async () => {
  mockApi({ ...me, '/api/media': () => page([ANH]), '/api/media/m1': () => ok({ ...ANH, createdBy: { id: 'u9', fullName: 'Phạm Quốc Bảo' } }) })
  open('/admin/media?action=edit&id=m1')
  expect(await screen.findByText(/Bạn chỉ xem được/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull()
})

// XHR giả cho upload() (fetch không có tiến độ upload nên api.ts dùng XMLHttpRequest).
function mockXhr(handle: (form: FormData) => { status: number; body: unknown }) {
  const sent: FormData[] = []
  class FakeXhr {
    status = 0
    responseText = ''
    withCredentials = false
    upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    open() {}
    setRequestHeader() {}
    send(form: FormData) {
      sent.push(form)
      setTimeout(() => {
        const r = handle(form)
        this.status = r.status
        this.responseText = JSON.stringify(r.body)
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 } as ProgressEvent)
        this.onload?.()
      })
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  return sent
}

test('upload: chặn file sai loại ở client, ảnh bắt buộc alt text, hiện lý do server từ chối', async () => {
  mockApi({ ...me, '/api/media': () => page([]) })
  const sent = mockXhr(() => ({ status: 415, body: { title: 'Loại file không được hỗ trợ', status: 415, code: 'unsupported_type', detail: 'Nội dung file không khớp với định dạng .png.' } }))
  const user = userEvent.setup({ applyAccept: false })
  open('/admin/media?action=create')

  const input = await waitFor(() => {
    const el = document.body.querySelector<HTMLInputElement>('input[type=file]')
    if (!el) throw new Error('chưa có input file')
    return el
  })
  await user.upload(input, [new File(['MZ'], 'setup.exe'), new File(['x'], 'anh-bia.png', { type: 'image/png' })])

  expect(await screen.findByText(/Chỉ nhận ảnh JPG, PNG, WebP/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Tải lên 1 file' }))
  expect(await screen.findByText('Nhập văn bản thay thế mô tả nội dung ảnh.')).toBeTruthy()
  expect(sent).toHaveLength(0)

  await user.type(screen.getByLabelText(/Văn bản thay thế/), 'Ảnh bìa thông báo')
  await user.click(screen.getByRole('button', { name: 'Tải lên 1 file' }))
  expect(await screen.findByText('Nội dung file không khớp với định dạng .png.')).toBeTruthy()
  expect(sent).toHaveLength(1)
  expect(sent[0].get('altText')).toBe('Ảnh bìa thông báo')
  expect(within(document.body).queryByText('Đã tải lên')).toBeNull()
})

test('them video: gui URL hoac ma nhung iframe len /api/media/videos', async () => {
  const VIDEO_DTO: MediaDto = {
    ...ANH,
    id: 'v1',
    kind: 'video',
    name: 'Video Gioi Thieu',
    altText: null,
    externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  }
  const api = mockApi({
    ...me,
    '/api/media': () => page([]),
    '/api/media/videos': (_, init) => ok(VIDEO_DTO),
  })
  const user = userEvent.setup()
  open('/admin/media?action=video')

  expect(await screen.findByRole('dialog')).toBeTruthy()
  const urlInput = screen.getByLabelText(/Đường dẫn hoặc mã nhúng video/)
  const nameInput = screen.getByLabelText(/Tên video/)

  await user.type(urlInput, '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')
  await user.type(nameInput, 'Video Gioi Thieu')
  await user.click(screen.getByRole('button', { name: 'Thêm' }))

  await waitFor(() => {
    expect(api.calls('/api/media/videos')).toHaveLength(1)
  })
  const reqBody = JSON.parse(api.calls('/api/media/videos')[0][1]?.body as string)
  expect(reqBody.url).toContain('<iframe')
  expect(reqBody.name).toBe('Video Gioi Thieu')
})

test('them video: server tra 422 video_url_not_allowed thi hien loi tren o nhap', async () => {
  mockApi({
    ...me,
    '/api/media': () => page([]),
    '/api/media/videos': () => reply(422, {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.21',
      title: 'Đường dẫn video không hợp lệ',
      status: 422,
      code: 'video_url_not_allowed',
      detail: 'Chỉ nhận video YouTube (youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...).',
    }),
  })
  const user = userEvent.setup()
  open('/admin/media?action=video')

  expect(await screen.findByRole('dialog')).toBeTruthy()
  const urlInput = screen.getByLabelText(/Đường dẫn hoặc mã nhúng video/)
  const nameInput = screen.getByLabelText(/Tên video/)

  await user.type(urlInput, 'https://vimeo.com/123456')
  await user.type(nameInput, 'Video Vimeo')
  await user.click(screen.getByRole('button', { name: 'Thêm' }))

  expect(await screen.findByText(/Chỉ nhận video YouTube/)).toBeTruthy()
})

