import { useLocation } from 'react-router'
import { getDictionary, type Locale } from './dictionary'

// Trích xuất locale từ pathname: tiền tố /en hoặc /en/... là 'en', còn lại là 'vi'
export function getLocaleFromPath(pathname: string): Locale {
  if (!pathname) return 'vi'
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'vi'
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

// Hook lấy locale hiện tại từ URL phía client
export function useLocale(): Locale {
  const { pathname } = useLocation()
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
