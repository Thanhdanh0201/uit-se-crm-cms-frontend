import { data, Link, useSearchParams } from 'react-router'
import { Newspaper } from '@phosphor-icons/react'
import type { Route } from './+types/Category'
import { api, ApiError } from '../../lib/api'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import Pagination from '../../components/ui/Pagination'
import { EmptyState } from '../../components/ui/States'
import { PostList, type PostCard } from '../../components/PostList'

// GET /api/public/categories/{slug} (CategoryDetailDto) và /{slug}/posts (PaginatedPublicPostsResponseDto).
// Chuyên mục ẩn, đã xóa hoặc không tồn tại: 404. Bài mới xuất bản trước, chỉ bài đang hiện.
type Category = { id: string; name: string; slug: string; description: string | null; parentName: string | null }
type Page = { items: PostCard[]; totalItems: number; page: number; pageSize: number; totalPages: number }

const PAGE_SIZE = 10

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const slug = encodeURIComponent(params.slug)
  try {
    const [category, posts] = await Promise.all([
      api<Category>(`/api/public/categories/${slug}`),
      api<Page>(`/api/public/categories/${slug}/posts?page=${page}&pageSize=${PAGE_SIZE}`),
    ])
    return { category, posts, url: `${siteUrl(request)}/categories/${category.slug}${page > 1 ? `?page=${page}` : ''}` }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw data(null, { status: 404 })
    throw e
  }
}

export const meta: Route.MetaFunction = ({ loaderData: d }) =>
  d
    ? seo({ title: d.category.name, description: d.category.description || `Tin tức và thông báo chuyên mục ${d.category.name}, Khoa Công nghệ Phần mềm.`, url: d.url })
    : noIndex('Không tìm thấy chuyên mục')

export default function Category({ loaderData: { category, posts } }: Route.ComponentProps) {
  const [, setParams] = useSearchParams()
  const goTo = (page: number) => {
    setParams(page > 1 ? { page: String(page) } : {})
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="list-page">
      <header className="list-page__head">
        <nav className="list-page__crumbs" aria-label="Vị trí trang">
          <Link to="/">Trang chủ</Link>
          {category.parentName && <><span aria-hidden>/</span><span>{category.parentName}</span></>}
        </nav>
        <h1>{category.name}</h1>
        {category.description && <p>{category.description}</p>}
        <span className="list-page__count">{posts.totalItems} bài viết</span>
      </header>

      {posts.items.length ? (
        <PostList posts={posts.items} />
      ) : (
        <EmptyState icon={<Newspaper size={32} />} title={posts.page > 1 ? 'Trang này không có bài' : 'Chuyên mục chưa có bài viết'}>
          {posts.page > 1 ? <Link to={`/categories/${category.slug}`}>Về trang đầu</Link> : 'Bài viết mới sẽ hiện ở đây khi được xuất bản.'}
        </EmptyState>
      )}

      <Pagination page={posts.page} totalPages={posts.totalPages} onPageChange={goTo} />
    </div>
  )
}
