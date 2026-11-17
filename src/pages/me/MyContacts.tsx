import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChatCircleText } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { formatDate } from '../../lib/dictionary'
import { useDictionary } from '../../lib/locale'
import Alert from '../../components/ui/Alert'
import { ContactStatusBadge, type ContactStatus } from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { EmptyState, Skeleton } from '../../components/ui/States'
import '../../components/post-list.css'
import './me.css'

export const meta = () => noIndex('Yêu cầu đã gửi')

// GET /api/me/contact-requests: chỉ yêu cầu của người đang đăng nhập, mới nhất trước.
export type MyContact = { id: string; subject: string; message: string; status: ContactStatus; createdAt: string; updatedAt: string }
type Page = { items: MyContact[]; totalItems: number; page: number; pageSize: number; totalPages: number }

const PAGE_SIZE = 10

function MyContactsContent() {
  const { t, lPath, locale } = useDictionary()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [data, setData] = useState<Page | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    setData(null)
    setError('')
    api<Page>(`/api/me/contact-requests?page=${page}&pageSize=${PAGE_SIZE}`, { signal: ctrl.signal })
      .then(setData)
      .catch(() => {
        if (!ctrl.signal.aborted) setError('Chưa tải được danh sách yêu cầu. Kiểm tra mạng rồi tải lại trang.')
      })
    return () => ctrl.abort()
  }, [page])

  const goTo = (p: number) => setParams(p > 1 ? { page: String(p) } : {})

  return (
    <div className="list-page">
      <header className="list-page__head">
        <nav className="list-page__crumbs" aria-label="Vị trí trang">
          <Link to={lPath('/me')}>{t.myAccount}</Link>
        </nav>
        <h1>Yêu cầu đã gửi</h1>
        {data && data.totalItems > 0 && <span className="list-page__count">{data.totalItems} yêu cầu</span>}
      </header>

      {error ? (
        <Alert tone="danger" title="Có lỗi">{error}</Alert>
      ) : !data ? (
        <Skeleton lines={4} />
      ) : data.items.length ? (
        <>
          <ul className="me-contacts">
            {data.items.map((c) => (
              <li key={c.id}>
                <Link to={lPath(`/me/contacts/${c.id}`)} className="me-contacts__item">
                  <strong className="me-contacts__subject">{c.subject}</strong>
                  <span className="me-contacts__meta">
                    <span>Gửi ngày {formatDate(c.createdAt, locale)}</span>
                    <ContactStatusBadge status={c.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={goTo} />
        </>
      ) : data.totalItems > 0 ? (
        <>
          <Alert tone="info" title="Trang này không có yêu cầu">Trang bạn mở vượt quá số trang hiện có. Chọn trang khác bên dưới.</Alert>
          <Pagination page={Math.min(page, data.totalPages)} totalPages={data.totalPages} onPageChange={goTo} />
        </>
      ) : (
        <EmptyState icon={<ChatCircleText size={32} />} title="Chưa gửi yêu cầu nào">
          Chỉ hiện yêu cầu gửi khi đã đăng nhập.
        </EmptyState>
      )}
    </div>
  )
}

export default function MyContacts() {
  return (
    <RequireRole roles={['student', 'editor', 'admin']}>
      <MyContactsContent />
    </RequireRole>
  )
}
