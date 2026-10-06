import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

// Route public: SSR (có loader + meta). Route /admin: chỉ client (AdminRoute).
// Mỗi file route export default component; loader/meta nếu cần dữ liệu hoặc thẻ SEO.
const devRoutes =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        route('dev/ui', 'pages/dev/UiKit.tsx'),
        route('dev', 'pages/dev/DevAdminRoute.tsx', [
          route('admin', 'pages/admin/Dashboard.tsx', { id: 'dev-dashboard' }),
          route('admin/users', 'pages/dev/AdminListDemo.tsx'),
          route('admin/media', 'pages/admin/Media.tsx', { id: 'dev-media' }),
          route('admin/posts', 'pages/admin/Posts.tsx', { id: 'dev-posts' }),
          route('admin/posts/new', 'pages/admin/PostEditor.tsx', { id: 'dev-post-new' }),
          route('admin/*', 'pages/admin/ComingSoon.tsx', { id: 'dev-coming-soon' }),
        ]),
      ]

export default [
  layout('layouts/PublicLayout.tsx', [
    index('pages/public/Home.tsx'),
    route('login', 'pages/public/Login.tsx'),
    route('posts/:slug', 'pages/public/PostDetail.tsx'),
    route('pages/:slug', 'pages/public/StaticPage.tsx'),
    route('me', 'pages/me/Account.tsx'),
    route('me/password', 'pages/me/ChangePassword.tsx'),
    route('403', 'pages/public/Forbidden.tsx'),
    route('*', 'pages/public/NotFound.tsx'),
  ]),
  route('admin', 'admin/AdminRoute.tsx', [
    index('pages/admin/Dashboard.tsx'),
    route('users', 'pages/admin/Users.tsx'),
    route('media', 'pages/admin/Media.tsx'),
    route('posts', 'pages/admin/Posts.tsx'),
    route('posts/new', 'pages/admin/PostEditor.tsx', { id: 'post-new' }),
    route('posts/:id/edit', 'pages/admin/PostEditor.tsx'),
    route('posts/:id/preview', 'pages/admin/PostPreview.tsx'),
    route('review', 'pages/admin/Review.tsx'),
    route('review/:id', 'pages/admin/ReviewDetail.tsx'),
    route('pages', 'pages/admin/StaticPages.tsx'),
    route('pages/new', 'pages/admin/PageEditor.tsx', { id: 'page-new' }),
    route('pages/:id/edit', 'pages/admin/PageEditor.tsx'),
    route('home-sections', 'pages/admin/HomeSections.tsx'),
    route('contacts', 'pages/admin/Contacts.tsx'),
    route('*', 'pages/admin/ComingSoon.tsx'),
  ]),
  ...devRoutes,
] satisfies RouteConfig
