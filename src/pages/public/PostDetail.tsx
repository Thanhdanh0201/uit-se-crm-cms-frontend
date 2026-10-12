import { useEffect, useRef, useState } from 'react'
import { data, Link } from 'react-router'
import { Eye } from '@phosphor-icons/react'
import type { Route } from './+types/PostDetail'
import { api, ApiError } from '../../lib/api'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import { PostArticle, type ContentMedia, type RichNode } from '../../components/PostArticle'

// GET /api/public/posts/{slug} (backend PostViewDto). Chỉ bài đã xuất bản, đã tới giờ và chưa hết hạn; còn lại 404.
type PublicPost = {
  id: string
  slug: string
  title: string
  summary: string
  content: RichNode
  cover: ContentMedia | null
  media: Record<string, ContentMedia>
  authorName: string
  category: { id: string; name: string }
  tags: { id: string; name: string }[]
  publishedAt: string
  viewCount: number
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
        description: data.post.summary || undefined,
        url: data.url,
        // ponytail: ảnh bìa là signed URL có hạn, Facebook/Zalo có thể không tải được sau khi hết hạn. Cần URL công khai từ backend.
        image: data.post.cover?.url ?? undefined,
        type: 'article',
      })
    : noIndex('Không tìm thấy bài viết')

export default function PostDetail({ loaderData: { post } }: Route.ComponentProps) {
  const [views, setViews] = useState(post.viewCount)
  const counted = useRef<string | null>(null)

  // Ghi lượt xem ở trình duyệt, một lần cho mỗi bài được mở (bot SSR không tính). Server chống lặp theo phiên.
  // Ref chặn gọi lại khi React chạy effect hai lần (StrictMode) hoặc khi loader chạy lại cùng bài.
  useEffect(() => {
    setViews(post.viewCount)
    if (counted.current === post.slug) return
    counted.current = post.slug
    api<{ viewCount: number }>(`/api/public/posts/${encodeURIComponent(post.slug)}/view`, { method: 'POST' })
      .then((r) => setViews(r.viewCount))
      .catch(() => {}) // Không ghi được lượt xem thì người đọc không cần biết.
  }, [post.slug, post.viewCount])

  return (
    <PostArticle
      post={{ ...post, categoryName: post.category.name }}
      footer={
        <footer className="post-article__footer">
          {post.tags.length > 0 && (
            <ul className="post-article__tags" aria-label="Thẻ">
              {post.tags.map((t) => (
                <li key={t.id}>
                  <Link to={`/search?tag=${t.id}`}>#{t.name}</Link>
                </li>
              ))}
            </ul>
          )}
          <p className="post-article__meta">
            <span><Eye size={16} aria-hidden /> {views.toLocaleString('vi-VN')} lượt xem</span>
            <Link to={`/search?category=${post.category.id}`}>Bài khác trong {post.category.name}</Link>
          </p>
        </footer>
      }
    />
  )
}
