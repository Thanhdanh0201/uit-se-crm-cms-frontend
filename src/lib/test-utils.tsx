import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { vi } from 'vitest'
import { AuthProvider } from './auth'

// Chỉ dùng trong test component (môi trường jsdom).

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

export const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Giả lập backend theo đường dẫn. Trả về mock để kiểm tra số lần gọi.
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const handler = Object.entries(routes).find(([path]) => url.endsWith(path))?.[1]
    return handler ? handler(url, init) : reply(404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    fetchMock,
    calls: (path: string) => fetchMock.mock.calls.filter(([u]) => String(u).endsWith(path)),
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
