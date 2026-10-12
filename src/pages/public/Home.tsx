import { Link, useRouteLoaderData } from 'react-router'
import { ArrowRight, CalendarDots, ChatCircleText, FolderSimple, MapPin, Megaphone, Newspaper } from '@phosphor-icons/react'
import type { Route } from './+types/Home'
import { api } from '../../lib/api'
import { seo, siteUrl } from '../../lib/seo'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import { buttonClass } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/States'
import { CoverThumb } from '../../components/PostList'
import type { loader as layoutLoader } from '../../layouts/PublicLayout'
import { EMPTY_HOME, eventStatus, type HomeData, type PostCard } from './home.data'
import './home.css'

// GET /api/public/categories/tree (CategoryTreeDto): chỉ chuyên mục đang hiện.
type CategoryNode = { id: string; name: string; slug: string; description: string | null; postCount: number }

export async function loader({ request }: Route.LoaderArgs) {
  // Gọi song song. Chuyên mục lỗi thì chỉ mất khối Truy cập nhanh, không làm hỏng cả trang.
  const [home, categories] = await Promise.all([
    api<HomeData>('/api/public/home').catch(() => null),
    api<CategoryNode[]>('/api/public/categories/tree').catch(() => [] as CategoryNode[]),
  ])
  const now = new Date()
  const data = home ?? EMPTY_HOME
  return {
    url: `${siteUrl(request)}/`,
    failed: !home,
    ...data,
    events: data.events.map((e) => ({ ...e, status: eventStatus(e, now) })),
    categories: categories.map(({ id, name, slug, description, postCount }) => ({ id, name, slug, description, postCount })),
  }
}

export const meta: Route.MetaFunction = ({ loaderData }) => seo({ url: loaderData?.url })

const shortDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
const eventDay = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' })
const eventMonth = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: 'short' })
const eventTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', hour: '2-digit', minute: '2-digit' })

function PostDate({ iso }: { iso: string }) {
  return <time dateTime={iso}>{shortDate.format(new Date(iso))}</time>
}

function Cover({ post, className }: { post: PostCard; className: string }) {
  return <CoverThumb src={post.coverUrl} className={className} />
}

export default function Home({ loaderData: home }: Route.ComponentProps) {
  const [lead, ...others] = home.featured
  // Trang giới thiệu lấy từ menu chính do Admin cấu hình (mục đầu tiên trỏ tới trang tĩnh), không cố định slug.
  const intro = useRouteLoaderData<typeof layoutLoader>('layouts/PublicLayout')?.nav.find((n) => n.kind === 'page' && n.url)
  const empty = !home.failed && !home.featured.length && !home.latest.length && !home.sections.length
  // Truy cập nhanh: chuyên mục cấp 1 đang hiện (Admin đổi trong trang Chuyên mục), cộng sự kiện và hỏi đáp.
  const quickLinks = [
    ...home.categories.map((c) => ({ to: `/categories/${c.slug}`, label: c.name, hint: c.description || `${c.postCount} bài viết`, icon: FolderSimple })),
    { to: '/events', label: 'Sự kiện', hint: 'Seminar, workshop, ngày hội', icon: CalendarDots },
    { to: '/contact', label: 'Hỏi đáp', hint: 'Gửi câu hỏi cho Khoa', icon: ChatCircleText },
  ]

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__text">
          <h1 id="home-title">Khoa Công nghệ Phần mềm</h1>
          <p className="home-hero__lead">Đào tạo kỹ sư phần mềm, nghiên cứu và kết nối doanh nghiệp. Thông báo, sự kiện và biểu mẫu của Khoa ở cùng một nơi.</p>
          <div className="home-hero__actions">
            <Link to="/search" className={buttonClass('primary', 'lg')}>Xem tin mới</Link>
            {intro?.url && <Link to={intro.url} className={buttonClass('secondary', 'lg')}>{intro.label}</Link>}
          </div>
        </div>

        {home.latest.length > 0 && (
          <aside className="home-notice" aria-labelledby="notice-title">
            <h2 id="notice-title" className="home-notice__title">
              <Megaphone size={18} weight="fill" aria-hidden />
              Thông báo mới
            </h2>
            <ul className="home-notice__list">
              {home.latest.slice(0, 4).map((p) => (
                <li key={p.slug}>
                  <Link to={`/posts/${p.slug}`}>{p.title}</Link>
                  <PostDate iso={p.publishedAt} />
                </li>
              ))}
            </ul>
            <Link to="/search" className="home-more">
              Tất cả tin mới <ArrowRight size={14} aria-hidden />
            </Link>
          </aside>
        )}
      </section>

      {home.failed && (
        <Alert tone="danger" title="Chưa tải được tin tức">
          Máy chủ đang bận hoặc mất kết nối. Tải lại trang sau ít phút.
        </Alert>
      )}
      {empty && (
        <EmptyState icon={<Newspaper size={32} />} title="Chưa có bài viết nào">
          Tin tức và thông báo của Khoa sẽ hiện ở đây khi được xuất bản.
        </EmptyState>
      )}

      <nav className="home-quick" aria-label="Truy cập nhanh">
        {quickLinks.map(({ to, label, hint, icon: Icon }) => (
          <Link key={to} to={to} className="home-quick__item">
            <span className="home-quick__icon" aria-hidden><Icon size={22} /></span>
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
          </Link>
        ))}
      </nav>

      {lead && (
        <section className="home-block" aria-labelledby="featured-title">
          <header className="home-block__head">
            <h2 id="featured-title">Tin nổi bật</h2>
            <Link to="/search" className="home-more">Xem tất cả <ArrowRight size={14} aria-hidden /></Link>
          </header>
          <div className="home-featured">
            <Link to={`/posts/${lead.slug}`} className="home-featured__lead">
              <Cover post={lead} className="home-featured__img" />
              <span className="home-featured__body">
                {lead.categoryName && <Badge tone="brand">{lead.categoryName}</Badge>}
                <strong>{lead.title}</strong>
                {lead.summary && <span className="home-featured__summary">{lead.summary}</span>}
                <span className="muted"><PostDate iso={lead.publishedAt} /></span>
              </span>
            </Link>
            <ul className="home-featured__list">
              {others.map((p) => (
                <li key={p.slug}>
                  <Link to={`/posts/${p.slug}`} className="home-featured__item">
                    <Cover post={p} className="home-featured__thumb" />
                    <span>
                      <strong>{p.title}</strong>
                      <span className="muted">
                        {p.categoryName && `${p.categoryName}, `}
                        <PostDate iso={p.publishedAt} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {home.sections.length > 0 && (
        <section className="home-block" aria-label="Tin theo chuyên mục">
          <div className="home-sections">
            {home.sections.map((s, i) => (
              <article key={`${i}-${s.title}`} className="home-section" aria-labelledby={`sec-${i}`}>
                <header className="home-block__head">
                  <h2 id={`sec-${i}`}>{s.title}</h2>
                  {s.categorySlug && (
                    <Link to={`/categories/${s.categorySlug}`} className="home-more" aria-label={`Xem tất cả ${s.title}`}>
                      Xem tất cả <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                </header>
                <ul className="home-section__list">
                  {s.posts.map((p) => (
                    <li key={p.slug}>
                      <Link to={`/posts/${p.slug}`}>{p.title}</Link>
                      <PostDate iso={p.publishedAt} />
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {home.events.length > 0 && (
        <section className="home-block" aria-labelledby="events-title">
          <header className="home-block__head">
            <h2 id="events-title">Sự kiện sắp diễn ra</h2>
            <Link to="/events" className="home-more">Tất cả sự kiện <ArrowRight size={14} aria-hidden /></Link>
          </header>
          <ul className="home-events">
            {home.events.map((e) => (
              <li key={e.id}>
                <Link to={`/events/${e.id}`} className="home-event">
                  <span className="home-event__date" aria-hidden>
                    <strong>{eventDay.format(new Date(e.startAt))}</strong>
                    <small>{eventMonth.format(new Date(e.startAt))}</small>
                  </span>
                  <span className="home-event__body">
                    <strong>{e.title}</strong>
                    <span className="muted">
                      <time dateTime={e.startAt}>{eventTime.format(new Date(e.startAt))}</time>
                    </span>
                    <span className="muted home-event__venue">
                      <MapPin size={14} aria-hidden /> {e.venue}
                    </span>
                  </span>
                  <Badge tone={e.status.tone}>{e.status.label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-ask" aria-labelledby="ask-title">
        <div>
          <h2 id="ask-title">Có câu hỏi cho Khoa?</h2>
          <p>Gửi câu hỏi về học vụ, đồ án, thực tập hoặc tuyển sinh. Khoa phản hồi qua email bạn cung cấp.</p>
        </div>
        <Link to="/contact" className={buttonClass('primary', 'lg')}>Gửi câu hỏi</Link>
      </section>
    </div>
  )
}
