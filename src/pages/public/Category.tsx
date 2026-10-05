import { data, Link } from 'react-router'
import { CaretRight, FolderSimple, Newspaper } from '@phosphor-icons/react'
import type { Route } from './+types/Category'
import { api, ApiError } from '../../lib/api'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import Badge from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/States'
import type { CategoryDetailDto } from '../../admin/categories'
import type { HomeData, PostCard } from './home.data'
import './category.css'

const shortDate = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export async function loader({ params, request }: Route.LoaderArgs) {
  const slug = params.slug?.trim()
  if (!slug) throw data(null, { status: 404 })

  try {
    // 1. Tải thông tin chi tiết chuyên mục công khai
    const category = await api<CategoryDetailDto>(`/api/public/categories/${encodeURIComponent(slug)}`)

    // 2. Tải bài viết theo chuyên mục (nếu có từ home section hoặc API)
    let posts: PostCard[] = []
    try {
      const home = await api<HomeData>('/api/public/home')
      const sec = home.sections?.find((s) => s.categorySlug === slug)
      if (sec?.posts) {
        posts = sec.posts
      } else {
        // Lọc bài viết mới nhất nếu thuộc chuyên mục này
        posts = (home.latest || []).filter((p) => p.categoryName === category.name)
      }
    } catch {
      posts = []
    }

    return {
      category,
      posts,
      url: `${siteUrl(request)}/categories/${slug}`,
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw data(null, { status: 404 })
    }
    throw err
  }
}

export const meta: Route.MetaFunction = ({ loaderData }) =>
  loaderData
    ? seo({
        title: loaderData.category.name,
        description:
          loaderData.category.description ||
          `Chuyên mục ${loaderData.category.name} - Khoa Công nghệ Phần mềm, Trường Đại học Công nghệ Thông tin`,
        url: loaderData.url,
      })
    : noIndex('Không tìm thấy chuyên mục')

export default function Category({ loaderData }: Route.ComponentProps) {
  const { category, posts } = loaderData

  return (
    <div className="category-page">
      <nav className="category-breadcrumb" aria-label="Đường dẫn điều hướng">
        <Link to="/">Trang chủ</Link>
        <CaretRight size={14} aria-hidden />
        <span>Chuyên mục</span>
        <CaretRight size={14} aria-hidden />
        <span aria-current="page">{category.name}</span>
      </nav>

      <header className="category-header">
        <div className="category-header__top">
          <FolderSimple size={28} className="muted" aria-hidden />
          <h1>{category.name}</h1>
          <Badge tone="brand">{category.postCount} bài viết</Badge>
        </div>
        {category.description && <p className="category-header__desc">{category.description}</p>}
      </header>

      {posts.length > 0 ? (
        <section className="category-posts" aria-label={`Danh sách bài viết thuộc ${category.name}`}>
          {posts.map((post) => (
            <Link key={post.slug} to={`/posts/${post.slug}`} className="category-post-card">
              {post.coverUrl ? (
                <img className="category-post-card__cover" src={post.coverUrl} alt={post.coverAlt || ''} loading="lazy" />
              ) : (
                <span className="category-post-card__cover category-post-card__cover--empty" aria-hidden>
                  <Newspaper size={32} />
                </span>
              )}
              <div className="category-post-card__body">
                <h2 className="category-post-card__title">{post.title}</h2>
                {post.summary && <p className="category-post-card__summary">{post.summary}</p>}
                <time className="category-post-card__date" dateTime={post.publishedAt}>
                  {shortDate.format(new Date(post.publishedAt))}
                </time>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<FolderSimple size={32} />}
          title="Chưa có bài viết hiển thị"
        >
          {category.postCount > 0
            ? 'Các bài viết trong chuyên mục đang được cập nhật.'
            : 'Chuyên mục này hiện chưa có bài viết nào được xuất bản.'}
        </EmptyState>
      )}
    </div>
  )
}
