import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigation, useNavigationType, useSearchParams } from 'react-router'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { Route } from './+types/Search'
import { api } from '../../lib/api'
import { seo, siteUrl } from '../../lib/seo'
import type { Locale } from '../../lib/dictionary'
import { getLocaleFromPath, useDictionary } from '../../lib/locale'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { Select, TextField } from '../../components/ui/Field'
import Pagination from '../../components/ui/Pagination'
import { EmptyState } from '../../components/ui/States'
import { PostList, type PostCard } from '../../components/PostList'

// GET /api/public/posts (PublicPostQueryDto): keyword, categoryId, tagId, fromDate, toDate, page, pageSize, locale.
// Lọc và phân trang ở server, mới xuất bản trước. Tiêu chí nằm trên URL (F5, chia sẻ link, Back/Forward).
type Page = { items: PostCard[]; totalItems: number; page: number; pageSize: number; totalPages: number }
type Ref = { id: string; name: string }

const PAGE_SIZE = 10
const FILTERS = ['q', 'category', 'tag', 'from', 'to'] as const
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

// Đọc tiêu chí từ URL. Ngày nhập theo giờ Việt Nam: "đến ngày" lấy hết ngày đó (backend so sánh publishedAt <= toDate).
function readCriteria(params: URLSearchParams) {
  const from = isDate(params.get('from')) ? params.get('from')! : ''
  const to = isDate(params.get('to')) ? params.get('to')! : ''
  return {
    q: (params.get('q') ?? '').trim().slice(0, 200),
    category: params.get('category') ?? '',
    tag: params.get('tag') ?? '',
    from,
    to,
    page: Math.max(1, Number(params.get('page')) || 1),
    dateError: from && to && from > to,
  }
}

function apiQuery(c: ReturnType<typeof readCriteria>, locale: Locale) {
  const q = new URLSearchParams({ page: String(c.page), pageSize: String(PAGE_SIZE), locale })
  if (c.q) q.set('keyword', c.q)
  if (c.category) q.set('categoryId', c.category)
  if (c.tag) q.set('tagId', c.tag)
  if (c.from) q.set('fromDate', `${c.from}T00:00:00+07:00`)
  if (c.to) q.set('toDate', `${c.to}T23:59:59.999+07:00`)
  return q.toString()
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const locale = getLocaleFromPath(url.pathname)
  const criteria = readCriteria(url.searchParams)
  // signal: người dùng đổi tiêu chí khi request cũ chưa xong thì hủy request cũ, kết quả cũ không đè kết quả mới.
  const { signal } = request
  const [results, categories, tags] = await Promise.all([
    criteria.dateError ? null : api<Page>(`/api/public/posts?${apiQuery(criteria, locale)}`, { signal }).catch(() => undefined),
    api<Ref[]>(`/api/public/categories?locale=${locale}`, { signal }).catch(() => [] as Ref[]),
    api<Ref[]>('/api/public/tags', { signal }).catch(() => [] as Ref[]),
  ])
  return {
    locale,
    criteria,
    results: results ?? null,
    failed: results === undefined,
    categories: categories.map(({ id, name }) => ({ id, name })),
    tags: tags.map(({ id, name }) => ({ id, name })),
    url: `${siteUrl(request)}${locale === 'en' ? '/en/search' : '/search'}`,
  }
}

export const meta: Route.MetaFunction = ({ loaderData: d }) =>
  seo({
    title: d?.criteria.q
      ? (d?.locale === 'en' ? `Search: ${d.criteria.q}` : `Tìm kiếm: ${d.criteria.q}`)
      : (d?.locale === 'en' ? 'News and Search' : 'Tin tức và tìm kiếm'),
    description: d?.locale === 'en'
      ? 'Search news and announcements of Faculty of Software Engineering by keywords, categories, tags, and dates.'
      : 'Tìm tin tức, thông báo của Khoa Công nghệ Phần mềm theo từ khóa, chuyên mục, thẻ và thời gian.',
    url: d?.url,
    locale: d?.locale,
  })

export default function Search({ loaderData: { criteria: c, results, failed, categories, tags } }: Route.ComponentProps) {
  const { t, lPath, locale } = useDictionary()
  const [params, setParams] = useSearchParams()
  const form = useRef<HTMLFormElement>(null)
  const loading = useNavigation().state === 'loading'
  const filtered = FILTERS.some((k) => params.get(k))
  // Back/Forward (POP): dựng lại form để ô nhập hiện đúng tiêu chí của trang đó. Tự đổi tiêu chí (PUSH) thì giữ form,
  // không mất focus của ô vừa chọn.
  const location = useLocation()
  const [formKey, setFormKey] = useState(location.key)
  if (useNavigationType() === 'POP' && formKey !== location.key) setFormKey(location.key)

  // Đổi tiêu chí: về trang 1, bỏ field trống khỏi URL.
  function submit(e?: FormEvent) {
    e?.preventDefault()
    const data = new FormData(form.current!)
    const next = new URLSearchParams()
    for (const k of FILTERS) {
      const v = String(data.get(k) ?? '').trim()
      if (v) next.set(k, v)
    }
    setParams(next)
  }

  function goTo(page: number) {
    const next = new URLSearchParams(params)
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    setParams(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="list-page">
      <header className="list-page__head">
        <h1>{t.newsAndSearch}</h1>
        <p>{t.newsAndSearchDesc}</p>
      </header>

      <form key={formKey} ref={form} className="search-form" role="search" onSubmit={submit} noValidate>
        <div className="search-form__query">
          <TextField label={t.keyword} name="q" type="search" defaultValue={c.q} maxLength={200} placeholder={t.keywordPlaceholder} />
          <Button type="submit" icon={<MagnifyingGlass size={18} aria-hidden />} loading={loading}>{t.searchAction}</Button>
        </div>
        <div className="search-form__filters">
          <Select label={t.category} name="category" defaultValue={c.category}>
            <option value="">{t.allCategories}</option>
            {categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
          <Select label={t.tag} name="tag" defaultValue={c.tag}>
            <option value="">{t.allTags}</option>
            {tags.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
          <TextField label={t.fromDate} name="from" type="date" defaultValue={c.from} error={c.dateError ? t.searchDateError : undefined} />
          <TextField label={t.toDate} name="to" type="date" defaultValue={c.to} />
        </div>
        {filtered && <Link to={lPath('/search')} className="search-form__reset">{t.clearFilters}</Link>}
      </form>

      <div aria-live="polite" aria-busy={loading || undefined} className={loading ? 'search-results is-loading' : 'search-results'}>
        {failed ? (
          <Alert tone="danger" title={t.searchFailedTitle}>{t.searchFailedDesc}</Alert>
        ) : results && results.items.length ? (
          <>
            <p className="list-page__count">
              {c.q ? (locale === 'en' ? `Found ${results.totalItems} articles for "${c.q}"` : `Tìm thấy ${results.totalItems} bài cho "${c.q}"`) : t.postCountHint(results.totalItems)}
            </p>
            <PostList posts={results.items} />
            <Pagination page={results.page} totalPages={results.totalPages} onPageChange={goTo} />
          </>
        ) : results ? (
          <EmptyState icon={<MagnifyingGlass size={32} />} title={c.page > 1 ? t.emptySearchPageTitle : t.emptySearchTitle}>
            {c.page > 1 ? t.emptySearchPageDesc : t.emptySearchDesc}
          </EmptyState>
        ) : null}
      </div>
    </div>
  )
}
