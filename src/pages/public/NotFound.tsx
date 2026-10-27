import { data, Link } from 'react-router'
import type { Locale } from '../../lib/dictionary'
import { getLocaleFromPath, useDictionary } from '../../lib/locale'
import { noIndex } from '../../lib/seo'

// Trả HTTP 404 thật để Google không index URL sai.
export const loader = ({ request }: { request: Request }) => {
  const locale = getLocaleFromPath(new URL(request.url).pathname)
  return data({ locale }, { status: 404 })
}

export const meta = ({ data }: { data?: { locale?: Locale } }) =>
  noIndex(data?.locale === 'en' ? 'Page Not Found' : 'Không tìm thấy trang', data?.locale)

export default function NotFound() {
  const { t, lPath } = useDictionary()
  return (
    <p>
      {t.pageNotFound}. <Link to={lPath('/')}>{t.backToHome}</Link>
    </p>
  )
}
