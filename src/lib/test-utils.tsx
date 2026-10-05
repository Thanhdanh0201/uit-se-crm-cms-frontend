import type { ReactNode } from 'react'
import { configure, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { vi } from 'vitest'
import { AuthProvider } from './auth'

// Chỉ dùng trong test component (môi trường jsdom).

// Trang antd (Table, Drawer) render chậm khi máy bận hoặc chạy cả bộ test song song:
// findBy/waitFor chờ tối đa 5 giây (mặc định 1 giây), mỗi test tối đa 20 giây (mặc định 5 giây).
configure({ asyncUtilTimeout: 5000 })
vi.setConfig({ testTimeout: 20_000 })

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

export const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Response thành công đúng format backend: { success, message, data } (ApiResponse).
export const ok = (data?: unknown, message = '', status = 200) =>
  reply(status, data === undefined ? { success: true, message } : { success: true, message, data })

// Giả lập backend theo đường dẫn. Trả về mock để kiểm tra số lần gọi.
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    // So khớp theo path, bỏ query (?page=...).
    const handler = Object.entries(routes).find(([path]) => url.split('?')[0].endsWith(path))?.[1]
    return handler ? handler(url, init) : reply(404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    fetchMock,
    calls: (path: string) => fetchMock.mock.calls.filter(([u]) => String(u).split('?')[0].endsWith(path)),
  }
}

function CurrentPath() {
  const { pathname, search } = useLocation()
  return <output data-testid="path">{pathname + search}</output>
}

// Render một trang trong router + AuthProvider thật. Các route khác chỉ hiện đường dẫn để kiểm tra chuyển trang.
export function renderPage(path: string, routePath: string, page: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={routePath} element={page} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

// Promise tự điều khiển, để giữ request ở trạng thái "đang gửi".
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}
