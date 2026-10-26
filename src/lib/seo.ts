import type { MetaDescriptor } from 'react-router'
import type { Locale } from './dictionary'

export const SITE_NAME_VI = 'Khoa Công nghệ Phần mềm - UIT'
export const SITE_NAME_EN = 'Faculty of Software Engineering - UIT'

const DEFAULT_DESC_VI = 'Tin tức, thông báo, sự kiện và biểu mẫu của Khoa Công nghệ Phần mềm, Trường Đại học Công nghệ Thông tin, ĐHQG-HCM.'
const DEFAULT_DESC_EN = 'News, announcements, events, and resources of the Faculty of Software Engineering, University of Information Technology, VNU-HCM.'

type Seo = {
  title?: string
  description?: string
  url?: string
  image?: string
  type?: 'website' | 'article'
  locale?: Locale
  isHome?: boolean
}

// Meta của route con thay thế hoàn toàn meta của route cha, nên mỗi route public gọi seo() với đủ thông tin.
export function seo({ title, description, url, image, type = 'website', locale = 'vi', isHome }: Seo = {}): MetaDescriptor[] {
  const isEn = locale === 'en'
  const siteName = isEn ? SITE_NAME_EN : SITE_NAME_VI
  const defaultDesc = isEn ? DEFAULT_DESC_EN : DEFAULT_DESC_VI
  const desc = description || defaultDesc
  const fullTitle = title ? `${title} - ${siteName}` : siteName

  const meta: MetaDescriptor[] = [
    { title: fullTitle },
    { name: 'description', content: desc },
    { property: 'og:site_name', content: siteName },
    { property: 'og:locale', content: isEn ? 'en_US' : 'vi_VN' },
    { property: 'og:type', content: type },
    { property: 'og:title', content: title ?? siteName },
    { property: 'og:description', content: desc },
    ...(url ? [{ property: 'og:url', content: url }, { tagName: 'link', rel: 'canonical', href: url }] : []),
    ...(image ? [{ property: 'og:image', content: image }] : []),
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
  ]

  // Thẻ hreflang cho trang chủ hai site
  if (isHome && url) {
    try {
      const origin = new URL(url).origin
      meta.push(
        { tagName: 'link', rel: 'alternate', hrefLang: 'vi', href: `${origin}/` },
        { tagName: 'link', rel: 'alternate', hrefLang: 'en', href: `${origin}/en` },
        { tagName: 'link', rel: 'alternate', hrefLang: 'x-default', href: `${origin}/` },
      )
    } catch {
      // ignore
    }
  }

  return meta
}

// Trang cần đăng nhập hoặc trang lỗi: không cho Google index.
export function noIndex(title: string, locale: Locale = 'vi'): MetaDescriptor[] {
  const siteName = locale === 'en' ? SITE_NAME_EN : SITE_NAME_VI
  return [{ title: `${title} - ${siteName}` }, { name: 'robots', content: 'noindex' }]
}

// URL công khai của site. Sau nginx/proxy, request.url có thể là host nội bộ, nên ưu tiên SITE_URL.
export function siteUrl(request: Request) {
  return (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, '')
}
