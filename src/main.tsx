import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'
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
      // Style guide chỉ có khi dev, không vào bản build
      ...(import.meta.env.DEV ? [{ path: '/dev/ui', lazy: async () => ({ Component: (await import('./pages/dev/UiKit')).default }) }] : []),
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
