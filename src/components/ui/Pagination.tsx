import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useDictionary } from '../../lib/locale'

// Trang đầu, trang cuối, và 1 trang mỗi bên trang hiện tại. 'gap' là dấu ba chấm.
export function pageItems(page: number, total: number): (number | 'gap')[] {
  const keep = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total))
  const pages = [...keep].sort((a, b) => a - b)
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? ['gap' as const, p] : [p]))
}

type Props = { page: number; totalPages: number; onPageChange: (page: number) => void }

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  const { locale, t } = useDictionary()
  const prevLabel = t.paginationPrev
  const nextLabel = t.paginationNext
  const navLabel = locale === 'en' ? 'Pagination' : 'Phân trang'

  if (totalPages <= 1) return null
  return (
    <nav className="ui-pagination" aria-label={navLabel}>
      <button type="button" className="ui-pagination__page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={prevLabel}>
        <CaretLeft size={14} aria-hidden />
      </button>
      {pageItems(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="ui-pagination__gap" aria-hidden>...</span>
        ) : (
          <button
            key={p}
            type="button"
            className="ui-pagination__page"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className="ui-pagination__page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label={nextLabel}>
        <CaretRight size={14} aria-hidden />
      </button>
    </nav>
  )
}
