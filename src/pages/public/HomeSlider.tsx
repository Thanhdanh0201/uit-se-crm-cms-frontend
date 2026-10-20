import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CaretLeft, CaretRight, Pause, Play } from '@phosphor-icons/react'
import type { HomeSlide } from './home.data'

const AUTO_MS = 6000

// Link nội bộ dùng router, link ngoài mở tab mới (NFR-05).
function SlideLink({ to, className, children, label }: { to: string; className?: string; children: React.ReactNode; label?: string }) {
  return /^https?:\/\//i.test(to) ? (
    <a href={to} className={className} target="_blank" rel="noopener noreferrer" aria-label={label}>{children}</a>
  ) : (
    <Link to={to} className={className} aria-label={label}>{children}</Link>
  )
}

// Slider ảnh đầu trang chủ (SCRUM-65). CSS scroll-snap: vuốt được trên điện thoại, không cần thư viện.
// Tự chuyển 6 giây một lần; dừng khi rê chuột, focus vào slider, bấm Tạm dừng hoặc khi người dùng bật giảm chuyển động.
export default function HomeSlider({ slides, label = 'Tin nổi bật của Khoa', wide = false }: { slides: HomeSlide[]; label?: string; wide?: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false) // người dùng bấm Tạm dừng
  const [hold, setHold] = useState(false) // đang rê chuột hoặc focus bên trong
  const [reduced, setReduced] = useState(true) // SSR: coi như giảm chuyển động, không tự chạy trước khi hydrate
  const multi = slides.length > 1
  const playing = multi && !paused && !hold && !reduced

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function go(i: number) {
    const el = track.current
    if (!el) return
    const next = (i + slides.length) % slides.length
    el.scrollTo?.({ left: next * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
    setIndex(next)
  }

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => go(index + 1), AUTO_MS)
    return () => clearTimeout(t)
    // go chỉ đọc ref và state hiện tại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index])

  // Vuốt hoặc cuộn ngang bằng tay: cập nhật chấm đang chọn theo vị trí cuộn của khung slider.
  function onScroll() {
    const el = track.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <section
      className={wide ? 'home-slider home-slider--wide' : 'home-slider'}
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHold(false)}
    >
      <div ref={track} className="home-slider__track" onScroll={onScroll} aria-live={playing ? 'off' : 'polite'}>
        {slides.map((s, i) => {
          const wholeLink = s.linkUrl && !s.buttonLabel
          const body = (
            <>
              <img
                className="home-slider__img"
                src={s.imageUrl}
                alt={s.imageAlt}
                loading={i === 0 && !wide ? 'eager' : 'lazy'}
                fetchPriority={i === 0 && !wide ? 'high' : undefined}
                decoding="async"
              />
              <div className="home-slider__text">
                <h2 className="home-slider__title">{s.title}</h2>
                {s.caption && <p className="home-slider__caption">{s.caption}</p>}
                {s.linkUrl && s.buttonLabel && (
                  <SlideLink to={s.linkUrl} className="home-slider__button">{s.buttonLabel}</SlideLink>
                )}
              </div>
            </>
          )
          return (
            <div
              key={s.id}
              className="home-slider__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-hidden={i !== index || undefined}
              inert={i !== index || undefined}
            >
              {wholeLink ? <SlideLink to={s.linkUrl!} className="home-slider__link" label={s.title}>{body}</SlideLink> : body}
            </div>
          )
        })}
      </div>

      {multi && (
        <div className="home-slider__controls">
          {/* Người bật giảm chuyển động: không tự chuyển, không cần nút tạm dừng. */}
          {!reduced && (
            <button type="button" className="home-slider__ctrl" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Tự chuyển slide' : 'Tạm dừng tự chuyển slide'}>
              {paused ? <Play size={16} weight="fill" aria-hidden /> : <Pause size={16} weight="fill" aria-hidden />}
            </button>
          )}
          <button type="button" className="home-slider__ctrl" onClick={() => go(index - 1)} aria-label="Slide trước">
            <CaretLeft size={16} aria-hidden />
          </button>
          <div className="home-slider__dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="home-slider__dot"
                aria-label={`Xem slide ${i + 1}: ${s.title}`}
                aria-current={i === index || undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button type="button" className="home-slider__ctrl" onClick={() => go(index + 1)} aria-label="Slide sau">
            <CaretRight size={16} aria-hidden />
          </button>
        </div>
      )}
    </section>
  )
}
