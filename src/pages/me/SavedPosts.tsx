import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BookmarkSimple } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import Alert from '../../components/ui/Alert'
import Button, { buttonClass } from '../../components/ui/Button'
import Pagination from '../../components/ui/Pagination'
import { EmptyState, Skeleton } from '../../components/ui/States'
import { PostList, type PostCard } from '../../components/PostList'
import { useDictionary } from '../../lib/locale'

export const meta = () => noIndex('Bài đã lưu')

// GET /api/me/bookmarks (PaginatedBookmarksResponseDto): chỉ trả bài còn công khai, bài bị gỡ/hết hạn tự ẩn.
type Page = { items: PostCard[]; totalItems: number; page: number; pageSize: number; totalPages: number }

const PAGE_SIZE = 10

function SavedPostsContent() {
  const { t, lPath } = useDictionary()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [data, setData] = useState<Page | null>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState('')
  const busy = useRef(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setError('')
    try {
      setData(await api<Page>(`/api/me/bookmarks?page=${page}&pageSize=${PAGE_SIZE}`, { signal }))
    } catch {
      if (!signal?.aborted) setError('Chưa tải được danh sách. Kiểm tra mạng rồi tải lại trang.')
    }
  }, [page])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const goTo = (p: number) => setParams(p > 1 ? { page: String(p) } : {})

  async function remove(post: PostCard) {
    if (busy.current) return // chống bấm lặp
    busy.current = true
    setRemoving(post.id)
    setRemoveError('')
    try {
      await api(`/api/me/bookmarks/${post.id}`, { method: 'DELETE' })
      // Bỏ bài cuối của trang (không phải trang đầu): lùi về trang trước thay vì hiện trang rỗng.
      if (data && data.items.length === 1 && page > 1) goTo(page - 1)
      else await load()
    } catch {
      setRemoveError(`Chưa bỏ lưu được "${post.title}". Thử lại sau.`)
    } finally {
      busy.current = false
      setRemoving(null)
    }
  }

  return (
    <div className="list-page">
      <header className="list-page__head">
        <nav className="list-page__crumbs" aria-label="Vị trí trang">
          <Link to={lPath('/me')}>{t.myAccount}</Link>
        </nav>
        <h1>Bài đã lưu</h1>
        {data && data.totalItems > 0 && <span className="list-page__count">{data.totalItems} bài</span>}
      </header>

      {removeError && <Alert tone="danger">{removeError}</Alert>}
      {error ? (
        <Alert tone="danger" title="Có lỗi">{error}</Alert>
      ) : !data ? (
        <Skeleton lines={4} />
      ) : data.items.length ? (
        <>
          <PostList
            posts={data.items}
            action={(p) => (
              <Button variant="ghost" size="sm" loading={removing === p.id} disabled={!!removing} onClick={() => remove(p)} aria-label={`Bỏ lưu ${p.title}`}>
                Bỏ lưu
              </Button>
            )}
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={goTo} />
        </>
      ) : (
        <EmptyState
          icon={<BookmarkSimple size={32} />}
          title="Chưa có bài nào được lưu"
          action={<Link to={lPath('/search')} className={buttonClass('secondary')}>Xem tin mới</Link>}
        >
          Bấm "Lưu bài" ở cuối bài viết để đọc lại sau. Bài bị gỡ hoặc hết hạn sẽ tự ẩn khỏi danh sách.
        </EmptyState>
      )}
    </div>
  )
}

export default function SavedPosts() {
  return (
    <RequireRole roles={['student', 'editor', 'admin']}>
      <SavedPostsContent />
    </RequireRole>
  )
}
