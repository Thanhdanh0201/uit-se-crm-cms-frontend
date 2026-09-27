import { data, Link } from 'react-router'
import type { Route } from './+types/PostDetail'
import { api, ApiError } from '../../lib/api'
import { noIndex, seo, siteUrl } from '../../lib/seo'

// DTO TẠM theo SRS 6.1 và tài liệu hướng dẫn dev (GET /api/public/posts/{slug} chưa có ở backend).
// Chốt field với nhóm backend rồi sửa lại type này.
type PublicPost = {
  slug: string
  title: string
  summary: string | null
  contentText: string | null
  coverUrl: string | null
  publishedAt: string
  authorName: string | null
  categoryName: string | null
}

// Chạy trên server khi tải trang lần đầu (bot nhận HTML đầy đủ), chạy ở client khi chuyển trang.
export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const post = await api<PublicPost>(`/api/public/posts/${encodeURIComponent(params.slug)}`)
    return { post, url: `${siteUrl(request)}/posts/${post.slug}` }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw data(null, { status: 404 })
    throw e
  }
}

export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo({
        title: data.post.title,
        description: data.post.summary ?? undefined,
        url: data.url,
        image: data.post.coverUrl ?? undefined,
        type: 'article',
      })
    : noIndex('Không tìm thấy bài viết')

const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'long' })

export default function PostDetail({ loaderData: { post } }: Route.ComponentProps) {
  return (
    <article className="stack" style={{ maxWidth: '72ch', margin: '0 auto', gap: 'var(--space-5)' }}>
      <header className="stack" style={{ gap: 'var(--space-2)' }}>
        {post.categoryName && <p className="muted">{post.categoryName}</p>}
        <h1>{post.title}</h1>
        <p className="muted">
          <time dateTime={post.publishedAt}>{dateFmt.format(new Date(post.publishedAt))}</time>
          {post.authorName && `, ${post.authorName}`}
        </p>
      </header>
      {post.coverUrl && <img src={post.coverUrl} alt="" style={{ borderRadius: 'var(--radius-card)', aspectRatio: '16 / 9', objectFit: 'cover' }} />}
      {post.summary && <p style={{ fontSize: 'var(--text-lg)' }}>{post.summary}</p>}
      {/* ponytail: hiện contentText dạng đoạn văn thuần. Thay bằng renderer JSON của trình soạn thảo khi có (FR-POST-02, Sprint 3). */}
      {post.contentText?.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
      <p><Link to="/">Về trang chủ</Link></p>
    </article>
  )
}
