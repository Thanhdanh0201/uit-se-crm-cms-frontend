import { data, Link } from 'react-router'
import type { Route } from './+types/StaticPage'
import { api, ApiError } from '../../lib/api'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import { RichText, type ContentMedia, type RichNode } from '../../components/PostArticle'

// GET /api/public/pages/{slug} (backend PageViewDto). Trang nháp, lưu trữ, hết hạn trả 404.
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
  try {
    const page = await api<PublicPage>(`/api/public/pages/${encodeURIComponent(params.slug)}`)
    return { page, url: `${siteUrl(request)}/pages/${page.slug}` }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw data(null, { status: 404 })
    throw e
  }
}

export const meta: Route.MetaFunction = ({ loaderData: d }) =>
  d ? seo({ title: d.page.title, description: firstText(d.page.content) || undefined, url: d.url }) : noIndex('Không tìm thấy trang')

const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'long' })

export default function StaticPage({ loaderData: { page } }: Route.ComponentProps) {
  return (
    <article className="post-article">
      <header className="post-article__header">
        <h1>{page.title}</h1>
        <p className="muted">Cập nhật <time dateTime={page.updatedAt}>{dateFmt.format(new Date(page.updatedAt))}</time></p>
      </header>
      <RichText doc={page.content} media={page.media} />
      <p><Link to="/">Về trang chủ</Link></p>
    </article>
  )
}
