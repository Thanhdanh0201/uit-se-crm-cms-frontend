import type { MetaDescriptor } from 'react-router'

export const SITE_NAME = 'Khoa Công nghệ Phần mềm - UIT'
const DEFAULT_DESCRIPTION = 'Tin tức, thông báo, sự kiện và biểu mẫu của Khoa Công nghệ Phần mềm, Trường Đại học Công nghệ Thông tin, ĐHQG-HCM.'

type Seo = { title?: string; description?: string; url?: string; image?: string; type?: 'website' | 'article' }

// Meta của route con thay thế hoàn toàn meta của route cha, nên mỗi route public gọi seo() với đủ thông tin.
// Facebook/Zalo đọc og:*, X đọc twitter:*. image và url phải là URL tuyệt đối, công khai, không hết hạn.
export function seo({ title, description = DEFAULT_DESCRIPTION, url, image, type = 'website' }: Seo = {}): MetaDescriptor[] {
  const fullTitle = title ? `${title} - ${SITE_NAME}` : SITE_NAME
  return [
    { title: fullTitle },
    { name: 'description', content: description },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'vi_VN' },
    { property: 'og:type', content: type },
    { property: 'og:title', content: title ?? SITE_NAME },
    { property: 'og:description', content: description },
    ...(url ? [{ property: 'og:url', content: url }, { tagName: 'link', rel: 'canonical', href: url }] : []),
    ...(image ? [{ property: 'og:image', content: image }] : []),
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
  ]
}

// Trang cần đăng nhập hoặc trang lỗi: không cho Google index.
export function noIndex(title: string): MetaDescriptor[] {
  return [{ title: `${title} - ${SITE_NAME}` }, { name: 'robots', content: 'noindex' }]
}

// URL công khai của site. Sau nginx/proxy, request.url có thể là host nội bộ, nên ưu tiên SITE_URL.
export function siteUrl(request: Request) {
  return (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, '')
}
