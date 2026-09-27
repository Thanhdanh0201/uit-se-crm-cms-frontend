import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { AuthProvider, RequireRole } from './lib/auth'
import PublicLayout from './layouts/PublicLayout'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/public/Login'

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <h1>Trang chủ</h1> },
      { path: '/login', element: <Login /> },
      { path: '/403', element: <p>Bạn không có quyền truy cập trang này. <Link to="/">Về trang chủ</Link></p> },
      { path: '*', element: <p>Không tìm thấy trang. <Link to="/">Về trang chủ</Link></p> },
    ],
  },
  {
    path: '/editor',
    element: <RequireRole roles={['editor', 'admin']}><AdminLayout /></RequireRole>,
    children: [{ index: true, element: <h1>Tổng quan biên tập</h1> }],
  },
  {
    path: '/admin',
    element: <RequireRole roles={['admin']}><AdminLayout /></RequireRole>,
    children: [{ index: true, element: <h1>Tổng quan quản trị</h1> }],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
