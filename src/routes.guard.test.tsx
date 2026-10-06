// @vitest-environment jsdom
// Tiêu chí nghiệm thu SCRUM-32: đúng menu theo role; refresh URL vẫn hoạt động; 401 về login; 403 có trang từ chối;
// Student không vào được màn hình Admin. Dùng route module thật (AdminRoute + AdminLayout antd, Users, Forbidden).
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthProvider, type Role } from './lib/auth'
import { mockApi, ok, reply } from './lib/test-utils'
import AdminRoute from './admin/AdminRoute'
import Users from './pages/admin/Users'
import Forbidden from './pages/public/Forbidden'
import Account from './pages/me/Account'

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: true, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function LoginPage() {
  const { pathname, search } = useLocation()
  return <output data-testid="login">{pathname + search}</output>
}

function openApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<Forbidden />} />
          <Route path="/me" element={<Account />} />
          <Route path="/admin" element={<AdminRoute />}>
            <Route index element={<p>Trang tổng quan</p>} />
            <Route path="users" element={<Users />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const me = (role: Role) => ok({ id: `${role}-1`, username: role, fullName: `Tài khoản ${role}`, role, email: `${role}@uit.edu.vn` })
const users = () => ok({ items: [], totalItems: 0, page: 1, pageSize: 10, totalPages: 0 })
// Mục cấp đầu, tiêu đề nhóm và mục con của nhóm đang mở, theo thứ tự hiển thị.
const menuItems = () => [...document.querySelectorAll('.admin-sider .ant-menu-item, .admin-sider .ant-menu-submenu-title')].map((e) => e.textContent)

test('khách mở thẳng URL admin: về đăng nhập, giữ đường quay lại', async () => {
  mockApi({ '/api/auth/me': () => reply(401), '/api/auth/refresh': () => reply(401) })
  openApp('/admin/users?page=2')
  expect((await screen.findByTestId('login')).textContent).toBe('/login?next=%2Fadmin%2Fusers%3Fpage%3D2')
})

test('Student không vào được màn hình Admin: hiện trang từ chối, không gọi API admin', async () => {
  const api = mockApi({ '/api/auth/me': () => me('student'), '/api/admin/users': users })
  openApp('/admin/users')
  expect(await screen.findByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeTruthy()
  expect(screen.getByText(/student@uit\.edu\.vn \(Sinh viên\)/)).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Về trang quản trị' })).toBeNull()
  expect(api.calls('/api/admin/users')).toHaveLength(0)
})

test('Editor: menu chỉ có mục của biên tập viên; mở trang chỉ admin thì bị từ chối', async () => {
  mockApi({ '/api/auth/me': () => me('editor') })
  const { unmount } = openApp('/admin')
  expect(await screen.findByText('Trang tổng quan')).toBeTruthy()
  expect(menuItems()).toEqual(['Tổng quan', 'Nội dung'])
  await userEvent.click(screen.getByText('Nội dung'))
  await waitFor(() => expect(menuItems()).toEqual(['Tổng quan', 'Nội dung', 'Bài viết', 'Thư viện media']))
  unmount()

  openApp('/admin/users')
  expect(await screen.findByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Về trang quản trị' })).toBeTruthy()
})

test('Admin: menu đủ mục và mở được quản lý người dùng', async () => {
  mockApi({ '/api/auth/me': () => me('admin'), '/api/admin/users': users })
  openApp('/admin/users')
  expect(await screen.findByText('Chưa có người dùng nào.')).toBeTruthy()
  // Nhóm chứa trang hiện tại mở sẵn, các nhóm khác đóng.
  await waitFor(() => expect(menuItems()).toEqual(['Tổng quan', 'Nội dung', 'Cấu trúc website', 'Tương tác', 'Hệ thống', 'Người dùng', 'Nhật ký']))
})

test('Refresh trang khi access token đã hết hạn: tự refresh, vẫn ở đúng URL', async () => {
  let refreshed = false
  mockApi({
    '/api/auth/me': () => (refreshed ? me('admin') : reply(401)),
    '/api/auth/refresh': () => ((refreshed = true), ok(undefined, 'Làm mới phiên đăng nhập thành công.')),
    '/api/admin/users': users,
  })
  openApp('/admin/users?status=locked')
  expect(await screen.findByText('Không có người dùng khớp bộ lọc.')).toBeTruthy()
  expect(screen.queryByTestId('login')).toBeNull()
})

test('Trang từ chối: "Đăng nhập tài khoản khác" đăng xuất rồi quay lại đúng trang bị chặn', async () => {
  const api = mockApi({ '/api/auth/me': () => me('student'), '/api/auth/logout': () => ok(undefined, 'Đăng xuất thành công.') })
  openApp('/admin/users')
  await userEvent.click(await screen.findByRole('button', { name: 'Đăng nhập tài khoản khác' }))
  await waitFor(() => expect(screen.getByTestId('login').textContent).toBe('/login?next=%2Fadmin%2Fusers'))
  expect(api.calls('/api/auth/logout')).toHaveLength(1)
})

test('Khu tài khoản: mục chưa có API không phải link, admin có lối vào trang quản trị', async () => {
  mockApi({ '/api/auth/me': () => me('admin') })
  openApp('/me')
  expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /Đổi mật khẩu/ }).getAttribute('href')).toBe('/me/password')
  expect(screen.getByRole('link', { name: /Trang quản trị/ }).getAttribute('href')).toBe('/admin')
  expect(screen.queryByRole('link', { name: /Bài đã lưu/ })).toBeNull()
  expect(screen.getAllByText('Sắp có')).toHaveLength(3)
})
