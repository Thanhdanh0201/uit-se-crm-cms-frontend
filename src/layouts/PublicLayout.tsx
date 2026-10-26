import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLoaderData, useLocation, useNavigate } from 'react-router'
import { CaretDown, CaretRight, EnvelopeSimple, Globe, List, MagnifyingGlass, MapPin, Phone } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { getLocaleFromPath, useDictionary } from '../lib/locale'
import type { Locale } from '../lib/dictionary'
import { buttonClass } from '../components/ui/Button'
import './layout.css'

// GET /api/public/menus/{code} (PublicMenuItemDto): backend đã bỏ mục ẩn và cả nhánh con của mục ẩn, đã sắp xếp.
export type NavItem = { id: string; label: string; kind: string; url: string | null; children: NavItem[] }

// Menu dự phòng khi chưa tạo menu "main" trong trang quản trị hoặc không gọi được API.
const getFallback = (locale: Locale): NavItem[] => [
  [locale === 'en' ? 'Home' : 'Trang chủ', locale === 'en' ? '/en' : '/'],
  [locale === 'en' ? 'News' : 'Tin tức', locale === 'en' ? '/en/search' : '/search'],
].map(([label, url]) => ({ id: url, label, kind: 'route', url, children: [] }))

// Menu chính do Admin cấu hình (FR-MENU), mã "main". Nạp theo locale của URL.
export async function loader({ request }: { request?: Request } = {}) {
  let locale: Locale = 'vi'
  if (request?.url) {
    try {
      const url = new URL(request.url)
      const q = url.searchParams.get('locale')
      if (q === 'en' || q === 'vi') locale = q
      else locale = getLocaleFromPath(url.pathname)
    } catch {
      // ignore
    }
  }
  const fallback = getFallback(locale)
  try {
    const menu = await api<{ items: NavItem[] }>(`/api/public/menus/main?locale=${locale}`)
    return { nav: menu.items.length ? menu.items : fallback, locale }
  } catch {
    return { nav: fallback, locale }
  }
}

function parseAppUrl(url: string) {
  if (!url) return { isExternal: false, path: '/' }
  if (!/^https?:\/\//i.test(url)) return { isExternal: false, path: url.startsWith('/') ? url : `/${url}` }
  try {
    const target = new URL(url)
    const isLocal = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
    const isSameOrigin = typeof window !== 'undefined' && target.origin === window.location.origin
    if (isLocal || isSameOrigin) {
      return { isExternal: false, path: (target.pathname || '/') + target.search + target.hash }
    }
  } catch {
    return { isExternal: true, path: url }
  }
  return { isExternal: true, path: url }
}

function NavTo({ item, className, onClick }: { item: NavItem; className?: string; onClick?: () => void }) {
  if (!item.url) return <span className={className}>{item.label}</span>
  const { isExternal, path } = parseAppUrl(item.url)
  if (isExternal)
    return <a href={item.url} className={className} target="_blank" rel="noopener noreferrer" onClick={onClick}>{item.label}</a>
  return <NavLink to={path} className={className} onClick={onClick}>{item.label}</NavLink>
}

// Menu con Desktop đa tầng (cấp 2 xổ xuống, cấp 3 trở đi mở sang bên, tự đảo hướng khi chạm mép màn hình)
function DesktopSubMenu({ items, level = 2 }: { items: NavItem[]; level?: number }) {
  const checkFlip = (el: HTMLElement | null) => {
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth - 16) {
      el.classList.add('site-nav__subdropdown--flip')
    } else {
      el.classList.remove('site-nav__subdropdown--flip')
    }
  }

  return (
    <ul className={level === 2 ? 'site-nav__list' : 'site-nav__sublist'}>
      {items.map((item) => {
        const hasChildren = item.children && item.children.length > 0
        return (
          <li
            key={item.id}
            className={`site-nav__item ${hasChildren ? 'site-nav__item--has-children' : ''}`}
            onMouseEnter={(e) => {
              if (hasChildren) {
                const sub = e.currentTarget.querySelector<HTMLElement>(':scope > .site-nav__subdropdown')
                checkFlip(sub)
              }
            }}
            onFocus={(e) => {
              if (hasChildren) {
                const sub = e.currentTarget.querySelector<HTMLElement>(':scope > .site-nav__subdropdown')
                checkFlip(sub)
              }
            }}
          >
            <div className="site-nav__item-row">
              <NavTo item={item} className="site-nav__link" />
              {hasChildren && <CaretRight size={12} aria-hidden className="site-nav__caret-right" />}
            </div>
            {hasChildren && (
              <div className="site-nav__subdropdown">
                <DesktopSubMenu items={item.children} level={level + 1} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// Nhánh menu Mobile dạng cây thụt lề, đóng/mở độc lập từng nhánh
function MobileNavBranch({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div className="site-menu__branch">
      <div className="site-menu__row">
        <NavTo item={item} className="site-menu__link" onClick={onNavigate} />
        {hasChildren && (
          <button
            type="button"
            className="site-menu__toggle"
            aria-expanded={open}
            aria-label={`${open ? 'Thu gọn' : 'Mở rộng'} ${item.label}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen((v) => !v)
            }}
          >
            <CaretDown size={14} aria-hidden className={`site-menu__caret ${open ? 'site-menu__caret--open' : ''}`} />
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div className="site-menu__children">
          {item.children.map((child) => (
            <MobileNavBranch key={child.id} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PublicLayout() {
  const { user, logout, loggingOut } = useAuth()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const { pathname } = useLocation()
  const { locale, t, lPath } = useDictionary()
  const loaderData = useLoaderData<typeof loader>()
  const nav = loaderData?.nav ?? getFallback(locale)

  // Đóng menu mobile sau khi chuyển trang.
  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false
  }, [pathname])

  async function onLogout() {
    await logout()
    navigate(lPath('/login'), { replace: true })
  }

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value as Locale
    if (nextLocale === 'en') {
      navigate('/en')
    } else {
      navigate('/')
    }
  }

  const languageSwitcher = (idPrefix = 'site') => (
    <div className="site-lang">
      <label htmlFor={`${idPrefix}-lang-select`} className="sr-only">
        {t.selectLanguage}
      </label>
      <div className="site-lang__wrapper">
        <Globe size={16} aria-hidden className="site-lang__icon" />
        <select
          id={`${idPrefix}-lang-select`}
          className="site-lang__select"
          value={locale}
          aria-label={t.selectLanguage}
          onChange={handleLanguageChange}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  )

  const account = user ? (
    <>
      {user.role !== 'student' && <Link to="/admin" className={buttonClass('secondary', 'sm')}>{t.admin}</Link>}
      <Link to={lPath('/me')} className={buttonClass('ghost', 'sm')}>{t.account}</Link>
      <button type="button" className={buttonClass('ghost', 'sm')} onClick={onLogout} disabled={loggingOut} aria-busy={loggingOut || undefined}>
        {loggingOut ? t.signingOut : t.signOut}
      </button>
    </>
  ) : (
    <Link to={lPath('/login')} className={buttonClass('primary', 'sm')}>{t.signIn}</Link>
  )

  const closeMobileMenu = () => {
    if (menuRef.current) menuRef.current.open = false
  }

  return (
    <>
      <a href="#main" className="skip-link">{t.skipLink}</a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to={locale === 'en' ? '/en' : '/'} className="brand">
            <strong>{t.brandName}</strong>
            <small>{t.brandSub}</small>
          </Link>

          <nav
            className="site-nav"
            aria-label={t.navMain}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                (document.activeElement as HTMLElement)?.blur()
              }
            }}
          >
            {nav.map((n) =>
              n.children.length ? (
                // Mở bằng rê chuột hoặc Tab vào (focus-within), Esc để thoát.
                <div key={n.id} className="site-nav__group">
                  <NavTo item={n} className="site-nav__parent" />
                  <CaretDown size={12} aria-hidden className="site-nav__caret" />
                  <div className="site-nav__dropdown">
                    <DesktopSubMenu items={n.children} level={2} />
                  </div>
                </div>
              ) : (
                <NavTo key={n.id} item={n} />
              ),
            )}
          </nav>

          <div className="site-actions">
            <Link to={lPath('/search')} className={`${buttonClass('ghost', 'sm')} ui-btn--icon`} aria-label={t.search} title={t.search}>
              <MagnifyingGlass size={18} aria-hidden />
            </Link>
            {languageSwitcher('header')}
            <span className="site-actions__account">{account}</span>
            <details ref={menuRef} className="site-menu">
              <summary className={`${buttonClass('ghost', 'sm')} ui-btn--icon`} aria-label={t.openMenu}>
                <List size={20} aria-hidden />
              </summary>
              <nav className="site-menu__panel" aria-label={t.navMobile}>
                <div className="site-menu__lang-mobile">
                  {languageSwitcher('mobile')}
                </div>
                {nav.map((n) => (
                  <MobileNavBranch key={n.id} item={n} onNavigate={closeMobileMenu} />
                ))}
                <div className="site-menu__account">{account}</div>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main" className="container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__about">
            <strong>{t.brandName}</strong>
            <p>{t.brandFullUni}</p>
            <ul className="site-footer__contact">
              <li><MapPin size={16} aria-hidden /> Phòng E7.2, tòa nhà E, Trường Đại học Công nghệ Thông tin, Khu phố 34, Phường Linh Xuân, TP. Hồ Chí Minh</li>
              <li><Phone size={16} aria-hidden /> <a href="tel:+842837252002">(028) 3725 2002</a>, số nội bộ 120</li>
              <li><EnvelopeSimple size={16} aria-hidden /> <a href="mailto:se@uit.edu.vn">se@uit.edu.vn</a></li>
            </ul>
          </div>
          <nav className="site-footer__links" aria-label={t.footerLinks}>
            {/* Mục cấp 1 của menu chính, cùng nguồn với header. */}
            {nav.map((n) => <NavTo key={n.id} item={n} />)}
          </nav>
        </div>
      </footer>
    </>
  )
}
