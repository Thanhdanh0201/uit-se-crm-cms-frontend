export type Locale = 'vi' | 'en'

export const DEFAULT_LOCALE: Locale = 'vi'

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
]

export function parseLocale(value?: string | null): Locale {
  return value === 'en' ? 'en' : 'vi'
}

export function localeLabel(locale?: string | null): string {
  return locale === 'en' ? 'English' : 'Tiếng Việt'
}

export function localeColor(locale?: string | null): string {
  return locale === 'en' ? 'blue' : 'cyan'
}

// Sinh đường dẫn chuẩn SEO (chữ thường không dấu, gạch ngang) cho cả tiếng Việt và tiếng Anh.
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
