import { Link } from 'react-router'
import {
  ArrowRight,
  Briefcase,
  CalendarDots,
  ChatCircleText,
  FileText,
  MapPin,
  Megaphone,
  Newspaper,
  UsersThree,
} from '@phosphor-icons/react'
import type { Route } from './+types/Home'
import { api } from '../../lib/api'
import { seo, siteUrl } from '../../lib/seo'
import Badge from '../../components/ui/Badge'
import { buttonClass } from '../../components/ui/Button'
import { EMPTY_HOME, eventStatus, type HomeData, type PostCard } from './home.data'
import './home.css'

export async function loader({ request }: Route.LoaderArgs) {
  let home: HomeData
  try {
    home = await api<HomeData>('/api/public/home')
  } catch {
    // API chưa có: dev xem bằng dữ liệu mẫu, production ẩn các khối rỗng.
    home = import.meta.env.DEV ? (await import('./home.sample')).SAMPLE_HOME : EMPTY_HOME
  }
  const now = new Date()
  return {
    url: `${siteUrl(request)}/`,
    ...home,
    events: home.events.map((e) => ({ ...e, status: eventStatus(e, now) })),
  }
}

export const meta: Route.MetaFunction = ({ loaderData }) => seo({ url: loaderData?.url })

// ponytail: đường dẫn chuyên mục cố định. Đổi sang dữ liệu menu/chuyên mục từ CMS khi có API (FR-MENU, FR-CAT).
const QUICK_LINKS = [
  { to: '/categories/thong-bao-hoc-vu', label: 'Thông báo học vụ', hint: 'Lịch học, thi, đồ án, thực tập', icon: Megaphone },
  { to: '/categories/hoc-bong-tuyen-dung', label: 'Học bổng và tuyển dụng', hint: 'Cơ hội từ doanh nghiệp đối tác', icon: Briefcase },
  { to: '/events', label: 'Sự kiện', hint: 'Seminar, workshop, ngày hội', icon: CalendarDots },
  { to: '/pages/bieu-mau', label: 'Biểu mẫu', hint: 'Đơn từ và mẫu báo cáo', icon: FileText },
  { to: '/categories/hoat-dong-sinh-vien', label: 'Hoạt động sinh viên', hint: 'Câu lạc bộ, cuộc thi, tình nguyện', icon: UsersThree },
  { to: '/contact', label: 'Hỏi đáp', hint: 'Gửi câu hỏi cho Khoa', icon: ChatCircleText },
]

const shortDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
const eventDay = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' })
const eventMonth = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: 'short' })
const eventTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', hour: '2-digit', minute: '2-digit' })

function PostDate({ iso }: { iso: string }) {
  return <time dateTime={iso}>{shortDate.format(new Date(iso))}</time>
}

function Cover({ post, className }: { post: PostCard; className: string }) {
  return post.coverUrl ? (
    <img className={className} src={post.coverUrl} alt="" loading="lazy" />
  ) : (
    <span className={`${className} home-cover--empty`} aria-hidden>
      <Newspaper size={28} />
    </span>
  )
}

export default function Home({ loaderData: home }: Route.ComponentProps) {
  const [lead, ...others] = home.featured

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__text">
          <h1 id="home-title">Khoa Công nghệ Phần mềm</h1>
          <p className="home-hero__lead">Đào tạo kỹ sư phần mềm, nghiên cứu và kết nối doanh nghiệp. Thông báo, sự kiện và biểu mẫu của Khoa ở cùng một nơi.</p>
          <div className="home-hero__actions">
            <Link to="/pages/tuyen-sinh" className={buttonClass('primary', 'lg')}>Thông tin tuyển sinh</Link>
            <Link to="/pages/gioi-thieu" className={buttonClass('secondary', 'lg')}>Giới thiệu Khoa</Link>
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
            <Link to="/categories/thong-bao-hoc-vu" className="home-more">
              Tất cả thông báo <ArrowRight size={14} aria-hidden />
            </Link>
          </aside>
        )}
      </section>

      <nav className="home-quick" aria-label="Truy cập nhanh">
        {QUICK_LINKS.map(({ to, label, hint, icon: Icon }) => (
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
            {home.sections.map((s) => (
              <article key={s.categorySlug} className="home-section" aria-labelledby={`sec-${s.categorySlug}`}>
                <header className="home-block__head">
                  <h2 id={`sec-${s.categorySlug}`}>{s.title}</h2>
                  <Link to={`/categories/${s.categorySlug}`} className="home-more" aria-label={`Xem tất cả ${s.title}`}>
                    Xem tất cả <ArrowRight size={14} aria-hidden />
                  </Link>
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
