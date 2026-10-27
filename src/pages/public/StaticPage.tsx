import { data, Link } from 'react-router'
import type { Route } from './+types/StaticPage'
import { api, ApiError } from '../../lib/api'
import { formatDate } from '../../lib/dictionary'
import { getLocaleFromPath, useDictionary } from '../../lib/locale'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import { RichText, type ContentMedia, type RichNode } from '../../components/PostArticle'

// GET /api/public/pages/{slug}?locale={vi|en} (backend PageViewDto). Trang nháp, lưu trữ, hết hạn trả 404.
type PublicPage = { slug: string; title: string; content: RichNode; media: Record<string, ContentMedia>; publishedAt: string | null; updatedAt: string }

// Lấy đoạn văn đầu làm mô tả cho thẻ meta (trang tĩnh không có tóm tắt riêng).
export function firstText(doc: RichNode, max = 160): string {
  const parts: string[] = []
  const walk = (n: RichNode) => {
    if (parts.join(' ').length >= max) return
    if (n.type === 'text' && n.text) parts.push(n.text)
    n.content?.forEach(walk)
  }
  walk(doc)
  const s = parts.join(' ').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const locale = getLocaleFromPath(url.pathname)
  try {
    const page = await api<PublicPage>(`/api/public/pages/${encodeURIComponent(params.slug)}?locale=${locale}`)
    return {
      locale,
      page,
      url: `${siteUrl(request)}${locale === 'en' ? '/en/pages/' : '/pages/'}${page.slug}`,
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw data(null, { status: 404 })
    throw e
  }
}

export const meta: Route.MetaFunction = ({ loaderData: d, location }) =>
  d
    ? seo({ title: d.page.title, description: firstText(d.page.content) || undefined, url: d.url, locale: d.locale })
    : noIndex(location.pathname.startsWith('/en') ? 'Page Not Found' : 'Không tìm thấy trang', location.pathname.startsWith('/en') ? 'en' : 'vi')

export default function StaticPage({ loaderData: { page } }: Route.ComponentProps) {
  const { t, lPath, locale } = useDictionary()
  return (
    <article className="post-article">
      <header className="post-article__header">
        <h1>{page.title}</h1>
        <p className="muted">
          {locale === 'en' ? 'Updated ' : 'Cập nhật '}
          <time dateTime={page.updatedAt}>{formatDate(page.updatedAt, locale, 'long')}</time>
        </p>
      </header>
      <RichText doc={page.content} media={page.media} />
      <p><Link to={lPath('/')}>{t.backToHome}</Link></p>
    </article>
  )
}
