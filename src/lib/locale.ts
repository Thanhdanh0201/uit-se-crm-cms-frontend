import { useLocation } from 'react-router'
import { getDictionary, type Locale } from './dictionary'

// Trích xuất locale từ pathname: tiền tố /en hoặc /en/... là 'en', còn lại là 'vi'
export function getLocaleFromPath(pathname: string): Locale {
  if (!pathname) return 'vi'
  // Tách query/hash nếu có
  const withoutQuery = pathname.split(/[?#]/)[0]
  // Bỏ hậu tố .data nếu request đến từ cơ chế single-fetch của React Router (ví dụ /en.data)
  const clean = withoutQuery.replace(/\.data$/, '')
  return clean === '/en' || clean.startsWith('/en/') ? 'en' : 'vi'
}

// Chuyển đổi đường dẫn sang locale tương ứng, bảo toàn query và hash nếu có
export function localePath(path: string, targetLocale: Locale): string {
  if (!path) return targetLocale === 'en' ? '/en' : '/'

  // Tách pathname và query/hash nếu có
  const match = path.match(/^([^?#]*)(.*)$/)
  const cleanPath = match ? match[1] : path
  const rest = match ? match[2] : ''

  // Bỏ tiền tố /en nếu có
  let basePath = cleanPath
  if (basePath === '/en') basePath = '/'
  else if (basePath.startsWith('/en/')) basePath = basePath.slice(3)
  if (!basePath.startsWith('/')) basePath = `/${basePath}`

  if (targetLocale === 'en') {
    return basePath === '/' ? `/en${rest}` : `/en${basePath}${rest}`
  }
  return `${basePath}${rest}`
}

// Hook lấy locale hiện tại từ URL phía client (ưu tiên pathname, hỗ trợ query param ?locale=)
export function useLocale(): Locale {
  const { pathname, search } = useLocation()
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en'
  if (search) {
    const q = new URLSearchParams(search).get('locale')
    if (q === 'en' || q === 'vi') return q
  }
  return getLocaleFromPath(pathname)
}

// Hook lấy từ điển tương ứng với locale hiện tại
export function useDictionary() {
  const locale = useLocale()
  return {
    locale,
    t: getDictionary(locale),
    lPath: (path: string) => localePath(path, locale),
  }
}
