import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// api.ts chỉ refresh ở trình duyệt: giả lập window trước khi import module.
const win = new EventTarget()
vi.stubGlobal('window', win)
const { api, AUTH_EXPIRED_EVENT } = await import('./api')

const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals().stubGlobal('window', win))

const paths = () => fetchMock.mock.calls.map(([url]) => String(url).replace(/^https?:\/\/[^/]+/, ''))

test('401 thì refresh rồi gửi lại, người dùng không thấy lỗi', async () => {
  fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(200, { items: [1] }))
  await expect(api('/api/admin/users')).resolves.toEqual({ items: [1] })
  expect(paths()).toEqual(['/api/admin/users', '/api/auth/refresh', '/api/admin/users'])
})

test('refresh thất bại: báo hết phiên và ném 401', async () => {
  const expired = vi.fn()
  win.addEventListener(AUTH_EXPIRED_EVENT, expired)
  fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(401))
  await expect(api('/api/admin/users')).rejects.toMatchObject({ status: 401 })
  expect(expired).toHaveBeenCalledOnce()
  win.removeEventListener(AUTH_EXPIRED_EVENT, expired)
})

test('nhiều request 401 cùng lúc chỉ refresh một lần', async () => {
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith('/api/auth/refresh') ? reply(200) : fetchMock.mock.calls.filter(([u]) => u === url).length === 1 ? reply(401) : reply(200),
  )
  await Promise.all([api('/api/a'), api('/api/b'), api('/api/c')])
  expect(paths().filter((p) => p === '/api/auth/refresh')).toHaveLength(1)
})

test('không refresh khi đăng nhập sai (tránh vòng lặp)', async () => {
  fetchMock.mockResolvedValueOnce(reply(401, { message: 'sai' }))
  await expect(api('/api/auth/login', { method: 'POST', json: {} })).rejects.toMatchObject({ status: 401 })
  expect(paths()).toEqual(['/api/auth/login'])
})
