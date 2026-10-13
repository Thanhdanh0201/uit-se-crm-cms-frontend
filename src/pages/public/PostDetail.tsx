import { useEffect, useRef, useState } from 'react'
import { data, Link, useLocation } from 'react-router'
import { BookmarkSimple, Eye } from '@phosphor-icons/react'
import type { Route } from './+types/PostDetail'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import Button, { buttonClass } from '../../components/ui/Button'
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
  updatedAt?: string | null
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

// Lưu bài để đọc sau (FR-PUB-06, SCRUM-53). Khách: link đăng nhập rồi quay lại bài.
// Trạng thái lấy từ server sau khi trang hiện (không SSR: phụ thuộc người đăng nhập). Chỉ đổi giao diện khi API thành công.
function BookmarkButton({ postId }: { postId: string }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)

  useEffect(() => {
    if (!user) return
    let alive = true
    api<{ bookmarked: boolean }>(`/api/me/bookmarks/${postId}`)
      .then((r) => alive && setSaved(r.bookmarked))
      .catch(() => alive && setSaved(false))
    return () => {
      alive = false
    }
  }, [user, postId])

  if (loading) return null
  if (!user)
    return (
      <Link to={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClass('secondary', 'sm')}>
        <BookmarkSimple size={16} aria-hidden /> Đăng nhập để lưu bài
      </Link>
    )

  async function toggle() {
    if (busyRef.current || saved === null) return // chống bấm lặp khi request trước chưa xong
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const r = await api<{ bookmarked: boolean }>(`/api/me/bookmarks/${postId}`, { method: saved ? 'DELETE' : 'PUT' })
      setSaved(r.bookmarked)
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'Bài này không còn công khai nên không lưu được.' : 'Chưa lưu được. Kiểm tra mạng rồi thử lại.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <span className="post-article__save">
      <Button
        variant={saved ? 'primary' : 'secondary'}
        size="sm"
        icon={<BookmarkSimple size={16} weight={saved ? 'fill' : 'regular'} aria-hidden />}
        aria-pressed={saved ?? undefined}
        loading={busy}
        disabled={saved === null}
        onClick={toggle}
      >
        {saved ? 'Đã lưu' : 'Lưu bài'}
      </Button>
      {error && <span role="alert" className="ui-error">{error}</span>}
    </span>
  )
}

export default function PostDetail({ loaderData: { post } }: Route.ComponentProps) {
  // Số lượt xem server trả sau khi ghi; chỉ dùng khi còn đúng bài đang mở.
  const [recorded, setRecorded] = useState<{ slug: string; count: number } | null>(null)
  const views = recorded?.slug === post.slug ? recorded.count : post.viewCount
  const counted = useRef<string | null>(null)

  // Ghi lượt xem ở trình duyệt, một lần cho mỗi bài được mở (bot SSR không tính). Server chống lặp theo phiên.
  // Ref chặn gọi lại khi React chạy effect hai lần (StrictMode) hoặc khi loader chạy lại cùng bài.
  useEffect(() => {
    const slug = post.slug
    if (counted.current === slug) return
    counted.current = slug
    api<{ viewCount: number }>(`/api/public/posts/${encodeURIComponent(slug)}/view`, { method: 'POST' })
      .then((r) => setRecorded({ slug, count: r.viewCount }))
      .catch(() => {}) // Không ghi được lượt xem thì người đọc không cần biết.
  }, [post.slug])

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
          <BookmarkButton postId={post.id} />
          <p className="post-article__meta">
            <span><Eye size={16} aria-hidden /> {views.toLocaleString('vi-VN')} lượt xem</span>
            <Link to={`/search?category=${post.category.id}`}>Bài khác trong {post.category.name}</Link>
          </p>
        </footer>
      }
    />
  )
}
