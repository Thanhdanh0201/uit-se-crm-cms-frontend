import type { Config } from '@react-router/dev/config'

// SSR để trang public (bài viết, trang chủ) có HTML và thẻ OG ngay khi tải: tốt cho Google và chia sẻ Facebook/Zalo.
// Trang /admin chỉ render ở client (xem src/admin/AdminRoute.tsx).
export default {
  appDirectory: 'src',
  ssr: true,
} satisfies Config
