import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Outlet, useSearchParams, type RouteObject } from 'react-router'
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
import Login from './pages/public/Login'

// Nạp trễ: Ant Design chỉ tải khi vào /admin, trang public không phải tải.
const lazy = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => async () => ({ Component: (await load())[name] })
const adminLayout = lazy(() => import('./admin/AdminLayout'), 'default')
const dashboard = lazy(() => import('./pages/admin/Placeholders'), 'Dashboard')
const comingSoon = lazy(() => import('./pages/admin/Placeholders'), 'ComingSoon')

// Xem giao diện quản trị khi chưa có backend. Chỉ khi dev. ?as=editor để xem menu biên tập viên.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { path: '/dev/ui', lazy: lazy(() => import('./pages/dev/UiKit'), 'default') },
      {
        path: '/dev',
        lazy: async () => {
          const { default: AdminLayout } = await import('./admin/AdminLayout')
          return {
            Component: function DevAdmin() {
              return <AdminLayout previewRole={useSearchParams()[0].get('as') === 'editor' ? 'editor' : 'admin'} />
            },
          }
        },
        children: [
          { path: 'admin', lazy: dashboard },
          { path: 'admin/users', lazy: lazy(() => import('./pages/dev/AdminListDemo'), 'default') },
          { path: 'admin/*', lazy: comingSoon },
        ],
      },
    ]
  : []

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
    path: '/admin',
    element: <RequireRole roles={['editor', 'admin']}><Outlet /></RequireRole>,
    children: [
      {
        lazy: adminLayout,
        children: [
          { index: true, lazy: dashboard },
          { path: '*', lazy: comingSoon },
        ],
      },
    ],
  },
  ...devRoutes,
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
