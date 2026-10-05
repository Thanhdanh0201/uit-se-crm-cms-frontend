import { data, Link } from 'react-router'
import type { Route } from './+types/PostDetail'
import { api, ApiError } from '../../lib/api'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import { PostArticle, type ContentMedia, type RichNode } from '../../components/PostArticle'

// GET /api/public/posts/{slug} (backend PostViewDto). Chỉ bài đã xuất bản, đã tới giờ và chưa hết hạn; còn lại 404.
type PublicPost = {
  slug: string
  title: string
  summary: string
  content: RichNode
  cover: ContentMedia | null
  media: Record<string, ContentMedia>
  authorName: string
  category: { id: string; name: string }
  publishedAt: string
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
  return (
    <PostArticle
      post={{ ...post, categoryName: post.category.name }}
      footer={<p><Link to="/">Về trang chủ</Link></p>}
    />
  )
}
