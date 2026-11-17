import { useEffect, useRef, useState } from 'react'
import { data, Link, useLocation } from 'react-router'
import { BookmarkSimple, Eye } from '@phosphor-icons/react'
import type { Route } from './+types/PostDetail'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { getLocaleFromPath, useDictionary } from '../../lib/locale'
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
  const url = new URL(request.url)
  const locale = getLocaleFromPath(url.pathname)
  try {
    const post = await api<PublicPost>(`/api/public/posts/${encodeURIComponent(params.slug)}?locale=${locale}`)
    return { post, url: `${siteUrl(request)}${locale === 'en' ? '/en' : ''}/posts/${post.slug}`, locale }
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
        image: data.post.cover?.url ?? undefined,
        type: 'article',
        locale: data.locale,
      })
    : noIndex('Không tìm thấy bài viết')

// Lưu bài để đọc sau (FR-PUB-06, SCRUM-53). Khách: link đăng nhập rồi quay lại bài.
function BookmarkButton({ postId }: { postId: string }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const { t } = useDictionary()
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
        <BookmarkSimple size={16} aria-hidden /> {t.signInToSave}
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
        {saved ? t.saved : t.savePost}
      </Button>
      {error && <span role="alert" className="ui-error">{error}</span>}
    </span>
  )
}

export default function PostDetail({ loaderData: { post } }: Route.ComponentProps) {
  const { locale, t, lPath } = useDictionary()
  // Số lượt xem server trả sau khi ghi; chỉ dùng khi còn đúng bài đang mở.
  const [recorded, setRecorded] = useState<{ slug: string; count: number } | null>(null)
  const views = recorded?.slug === post.slug ? recorded.count : post.viewCount
  const counted = useRef<string | null>(null)

  // Ghi lượt xem ở trình duyệt, một lần cho mỗi bài được mở (bot SSR không tính). Server chống lặp theo phiên.
  useEffect(() => {
    const slug = post.slug
    if (counted.current === slug) return
    counted.current = slug
    api<{ viewCount: number }>(`/api/public/posts/${encodeURIComponent(slug)}/view`, { method: 'POST' })
      .then((r) => setRecorded({ slug, count: r.viewCount }))
      .catch(() => {})
  }, [post.slug])

  return (
    <PostArticle
      post={{ ...post, categoryName: post.category.name }}
      footer={
        <footer className="post-article__footer">
          {post.tags.length > 0 && (
            <ul className="post-article__tags" aria-label={t.tag}>
              {post.tags.map((tag) => (
                <li key={tag.id}>
                  <Link to={lPath(`/search?tag=${tag.id}`)}>#{tag.name}</Link>
                </li>
              ))}
            </ul>
          )}
          <BookmarkButton postId={post.id} />
          <p className="post-article__meta">
            <span>
              <Eye size={16} aria-hidden /> {views.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} {t.views.toLowerCase()}
            </span>
            <Link to={lPath(`/search?category=${post.category.id}`)}>
              {locale === 'en' ? `Other articles in ${post.category.name}` : `Bài khác trong ${post.category.name}`}
            </Link>
          </p>
        </footer>
      }
    />
  )
}
