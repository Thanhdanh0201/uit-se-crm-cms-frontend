import type { ReactNode } from 'react'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from 'react-router'
import type { Route } from './+types/root'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'
import { AuthProvider } from './lib/auth'
import { getLocaleFromPath } from './lib/locale'
import { seo } from './lib/seo'

// Mặc định cho route không có meta riêng.
export const meta: Route.MetaFunction = () => seo()

export function Layout({ children }: { children: ReactNode }) {
  const locale = getLocaleFromPath(useLocation().pathname)

  return (
    <html lang={locale}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        <div id="root">{children}</div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const locale = getLocaleFromPath(useLocation().pathname)
  const isEn = locale === 'en'
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <main className="container stack">
      <h1>
        {notFound
          ? isEn ? 'Page Not Found' : 'Không tìm thấy trang'
          : isEn ? 'An error occurred' : 'Đã có lỗi xảy ra'}
      </h1>
      <p className="muted">
        {notFound
          ? isEn ? 'The page you are looking for does not exist or has been removed.' : 'Trang bạn tìm không tồn tại hoặc đã bị gỡ.'
          : isEn ? 'Please reload the page or try again later.' : 'Vui lòng tải lại trang hoặc thử lại sau.'}
      </p>
      <p><a href={isEn ? '/en' : '/'}>{isEn ? 'Back to home' : 'Về trang chủ'}</a></p>
    </main>
  )
}
