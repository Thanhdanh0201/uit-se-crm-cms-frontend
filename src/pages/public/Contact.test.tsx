// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Contact from './Contact'
import { deferred, mockApi, ok, renderPage, reply } from '../../lib/test-utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const guest = { '/api/auth/me': () => reply(401), '/api/auth/refresh': () => reply(401) }
const created = { id: 'a1b2c3d4-0000-4000-8000-000000000000', status: 'new', createdAt: '2026-11-17T03:00:00Z' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const sent = { senderName: 'Nguyễn Minh Anh', senderEmail: 'anh@gm.uit.edu.vn', subject: 'Hỏi về học bổng', message: 'Khoa cho em hỏi về học bổng.' }

const name = () => screen.getByLabelText(/^Họ và tên/)
const email = () => screen.getByLabelText(/^Email/)
const subject = () => screen.getByLabelText(/^Chủ đề/)
const message = () => screen.getByLabelText(/^Nội dung/)
const submit = () => screen.getByRole('button', { name: 'Gửi câu hỏi' })

async function fill(values = sent) {
  await userEvent.type(name(), values.senderName)
  await userEvent.type(email(), values.senderEmail)
  await userEvent.type(subject(), values.subject)
  await userEvent.type(message(), values.message)
}

const post = (api: ReturnType<typeof mockApi>) => api.calls('/api/contact-requests')
const keyOf = (call: unknown[]) => new Headers((call[1] as RequestInit).headers).get('Idempotency-Key')
const bodyOf = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body))

test('AC2: gửi trống báo 4 lỗi, không gọi API, focus ô Họ và tên', async () => {
  const api = mockApi({ ...guest, '/api/contact-requests': () => ok(created, '', 201) })
  renderPage('/contact', '/contact', <Contact />)
  await userEvent.click(submit())

  expect(screen.getByText('Nhập họ và tên.')).toBeTruthy()
  expect(screen.getByText('Nhập email để Khoa phản hồi.')).toBeTruthy()
  expect(screen.getByText('Nhập chủ đề.')).toBeTruthy()
  expect(screen.getByText('Nhập nội dung.')).toBeTruthy()
  expect(post(api)).toHaveLength(0)
  expect(document.activeElement).toBe(name())
})

test('AC3: đang gửi thì bấm lặp và Enter vẫn một request, có Idempotency-Key UUID, body đúng 4 key', async () => {
  const pending = deferred<Response>()
  const api = mockApi({ ...guest, '/api/contact-requests': () => pending.promise })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())
  await userEvent.click(screen.getByRole('button', { name: /Đang gửi/ }))
  await userEvent.type(subject(), '{Enter}').catch(() => {})
  await userEvent.keyboard('{Enter}')

  expect(post(api)).toHaveLength(1)
  expect(keyOf(post(api)[0])).toMatch(UUID)
  expect(bodyOf(post(api)[0])).toEqual(sent)
  expect(Object.keys(bodyOf(post(api)[0])).sort()).toEqual(['message', 'senderEmail', 'senderName', 'subject'])
  expect(name().closest('fieldset')?.disabled).toBe(true)

  pending.resolve(ok(created, '', 201))
  await screen.findByRole('status')
})

test('AC4: lỗi mạng rồi gửi lại thì cùng Idempotency-Key và dữ liệu còn nguyên', async () => {
  let n = 0
  const api = mockApi({
    ...guest,
    '/api/contact-requests': () => {
      if (n++ === 0) throw new TypeError('Failed to fetch')
      return ok(created, '', 201)
    },
  })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())

  expect((await screen.findByRole('alert')).textContent).toMatch(/Không kết nối được máy chủ/)
  expect((name() as HTMLInputElement).value).toBe(sent.senderName)
  expect((message() as HTMLTextAreaElement).value).toBe(sent.message)

  await userEvent.click(submit())
  await screen.findByRole('status')
  expect(post(api)).toHaveLength(2)
  expect(keyOf(post(api)[0])).toMatch(UUID)
  expect(keyOf(post(api)[1])).toBe(keyOf(post(api)[0]))
})

test('lỗi mạng rồi sửa nội dung thì gửi lại bằng Idempotency-Key khác', async () => {
  let n = 0
  const api = mockApi({
    ...guest,
    '/api/contact-requests': () => {
      if (n++ === 0) throw new TypeError('Failed to fetch')
      return ok(created, '', 201)
    },
  })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())
  await screen.findByRole('alert')

  await userEvent.type(message(), ' Em cảm ơn.')
  await userEvent.click(submit())
  await screen.findByRole('status')
  expect(post(api)).toHaveLength(2)
  expect(keyOf(post(api)[1])).toMatch(UUID)
  expect(keyOf(post(api)[1])).not.toBe(keyOf(post(api)[0]))
  expect(bodyOf(post(api)[1]).message).toBe(sent.message + ' Em cảm ơn.')
})

test('sau 201, gửi form trống thì Alert thành công biến mất và hiện 4 lỗi', async () => {
  const api = mockApi({ ...guest, '/api/contact-requests': () => ok(created, '', 201) })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())
  await screen.findByRole('status')

  await userEvent.click(submit())
  expect(screen.queryByText(/Đã gửi câu hỏi/)).toBeNull()
  expect(screen.getByText('Nhập họ và tên.')).toBeTruthy()
  expect(screen.getByText('Nhập email để Khoa phản hồi.')).toBeTruthy()
  expect(screen.getByText('Nhập chủ đề.')).toBeTruthy()
  expect(screen.getByText('Nhập nội dung.')).toBeTruthy()
  expect(post(api)).toHaveLength(1)
})

test('AC5: 429 hiện cảnh báo quá nhiều lần, mở khóa form, gửi lại cùng key', async () => {
  let n = 0
  const api = mockApi({
    ...guest,
    '/api/contact-requests': () => (n++ === 0 ? reply(429, { title: 'Too many', code: 'rate_limited' }) : ok(created, '', 201)),
  })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())

  expect((await screen.findByRole('alert')).textContent).toMatch(/quá nhiều lần/)
  expect(name().closest('fieldset')?.disabled).toBe(false)

  await userEvent.click(submit())
  await screen.findByRole('status')
  expect(keyOf(post(api)[1])).toBe(keyOf(post(api)[0]))
})

test('lỗi chung và thông báo thành công được cuộn vào tầm nhìn', async () => {
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  let n = 0
  mockApi({
    ...guest,
    '/api/contact-requests': () => (n++ === 0 ? reply(429, { title: 'Too many', code: 'rate_limited' }) : ok(created, '', 201)),
  })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())
  await screen.findByRole('alert')
  expect(scroll).toHaveBeenCalledTimes(1)

  await userEvent.click(submit())
  await screen.findByRole('status')
  expect(scroll).toHaveBeenCalledTimes(2)
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

test('AC6: 400 lỗi SenderEmail hiện dưới ô email và focus ô đó', async () => {
  mockApi({
    ...guest,
    '/api/contact-requests': () => reply(400, { title: 'Validation', errors: { SenderEmail: ['Email không hợp lệ từ server.'] } }),
  })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())

  expect(await screen.findByText('Email không hợp lệ từ server.')).toBeTruthy()
  expect(document.activeElement).toBe(email())
})

test('AC7: 201 hiện xác nhận có mã 8 ký tự, reset form, gửi tiếp dùng key khác', async () => {
  const api = mockApi({ ...guest, '/api/contact-requests': () => ok(created, '', 201) })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())

  const status = await screen.findByRole('status')
  expect(status.textContent).toContain('A1B2C3D4')
  expect(status.textContent).not.toContain('A1B2C3D4-')
  expect((name() as HTMLInputElement).value).toBe('')
  expect((message() as HTMLTextAreaElement).value).toBe('')

  // form.reset() bằng mã làm user-event giữ giá trị cũ, nên điền lần hai bằng fireEvent.
  fireEvent.change(name(), { target: { value: sent.senderName } })
  fireEvent.change(email(), { target: { value: sent.senderEmail } })
  fireEvent.change(subject(), { target: { value: sent.subject } })
  fireEvent.change(message(), { target: { value: sent.message } })
  await userEvent.click(submit())
  await waitFor(() => expect(post(api)).toHaveLength(2))
  expect(keyOf(post(api)[1])).toMatch(UUID)
  expect(keyOf(post(api)[1])).not.toBe(keyOf(post(api)[0]))
})

test('AC8: nội dung có thẻ HTML được gửi nguyên văn và không render thành phần tử', async () => {
  const api = mockApi({ ...guest, '/api/contact-requests': () => ok(created, '', 201) })
  renderPage('/contact', '/contact', <Contact />)
  const xss = '<img src=x onerror=alert(1)>'
  await fill({ ...sent, message: xss })
  await userEvent.click(submit())
  await screen.findByRole('status')

  expect(bodyOf(post(api)[0]).message).toBe(xss)
  expect(document.querySelector('img')).toBeNull()
})

test('AC9: trường lạ notes trong response 201 không được hiển thị', async () => {
  mockApi({ ...guest, '/api/contact-requests': () => ok({ ...created, notes: 'GHI-CHU-NOI-BO' }, '', 201) })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())
  await screen.findByRole('status')

  expect(screen.queryByText(/GHI-CHU-NOI-BO/)).toBeNull()
})

test('AC10: 409 hiện lỗi chung, lần gửi sau dùng key mới', async () => {
  let n = 0
  const api = mockApi({
    ...guest,
    '/api/contact-requests': () => (n++ === 0 ? reply(409, { title: 'Conflict', code: 'idempotency_conflict' }) : ok(created, '', 201)),
  })
  renderPage('/contact', '/contact', <Contact />)
  await fill()
  await userEvent.click(submit())

  expect((await screen.findByRole('alert')).textContent).toBe('Không gửi được, vui lòng gửi lại.')
  await userEvent.click(submit())
  await screen.findByRole('status')
  expect(keyOf(post(api)[1])).toMatch(UUID)
  expect(keyOf(post(api)[1])).not.toBe(keyOf(post(api)[0]))
})

test('AC1: /en/contact hiện label và nút tiếng Anh', async () => {
  mockApi(guest)
  renderPage('/en/contact', '/en/contact', <Contact />)

  expect(screen.getByLabelText(/^Full name/)).toBeTruthy()
  expect(screen.getByLabelText(/^Subject/)).toBeTruthy()
  expect(screen.getByLabelText(/^Message/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Send question' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Gửi câu hỏi' })).toBeNull()
})

test('đã đăng nhập: họ tên và email được điền sẵn', async () => {
  mockApi({
    '/api/auth/me': () => ok({ id: 'u1', username: 'sv.thu', fullName: 'Nguyễn Minh Anh', role: 'student', email: 'sv.thu@example.edu.vn' }),
  })
  renderPage('/contact', '/contact', <Contact />)

  await waitFor(() => expect((name() as HTMLInputElement).value).toBe('Nguyễn Minh Anh'))
  expect((email() as HTMLInputElement).value).toBe('sv.thu@example.edu.vn')
})
