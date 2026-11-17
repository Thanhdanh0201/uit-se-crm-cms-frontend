import { index, layout, prefix, route, type RouteConfig } from '@react-router/dev/routes'

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
          route('admin/menus', 'pages/admin/Menus.tsx', { id: 'dev-menus' }),
          route('admin/categories', 'pages/admin/Categories.tsx', { id: 'dev-categories' }),
          route('admin/*', 'pages/admin/ComingSoon.tsx', { id: 'dev-coming-soon' }),
        ]),
      ]

export default [
  layout('layouts/PublicLayout.tsx', [
    // Site Tiếng Việt (gốc)
    index('pages/public/Home.tsx'),
    route('login', 'pages/public/Login.tsx'),
    route('categories/:slug', 'pages/public/Category.tsx'),
    route('posts/:slug', 'pages/public/PostDetail.tsx'),
    route('search', 'pages/public/Search.tsx'),
    route('events', 'pages/public/Events.tsx'),
    route('events/:id', 'pages/public/EventDetail.tsx'),
    route('pages/:slug', 'pages/public/StaticPage.tsx'),
    route('contact', 'pages/public/Contact.tsx'),
    route('me', 'pages/me/Account.tsx'),
    route('me/password', 'pages/me/ChangePassword.tsx'),
    route('me/saved', 'pages/me/SavedPosts.tsx'),
    route('me/events', 'pages/me/MyEvents.tsx'),
    route('me/contacts', 'pages/me/MyContacts.tsx'),
    route('me/contacts/:id', 'pages/me/MyContactDetail.tsx'),
    route('403', 'pages/public/Forbidden.tsx'),

    // Site Tiếng Anh (tiền tố /en)
    ...prefix('en', [
      index('pages/public/Home.tsx', { id: 'en-home' }),
      route('categories/:slug', 'pages/public/Category.tsx', { id: 'en-category' }),
      route('posts/:slug', 'pages/public/PostDetail.tsx', { id: 'en-post-detail' }),
      route('search', 'pages/public/Search.tsx', { id: 'en-search' }),
      route('events', 'pages/public/Events.tsx', { id: 'en-events' }),
      route('events/:id', 'pages/public/EventDetail.tsx', { id: 'en-event-detail' }),
      route('pages/:slug', 'pages/public/StaticPage.tsx', { id: 'en-static-page' }),
      route('contact', 'pages/public/Contact.tsx', { id: 'en-contact' }),
      route('me', 'pages/me/Account.tsx', { id: 'en-me' }),
      route('me/password', 'pages/me/ChangePassword.tsx', { id: 'en-me-password' }),
      route('me/saved', 'pages/me/SavedPosts.tsx', { id: 'en-me-saved' }),
      route('me/events', 'pages/me/MyEvents.tsx', { id: 'en-me-events' }),
      route('me/contacts', 'pages/me/MyContacts.tsx', { id: 'en-me-contacts' }),
      route('me/contacts/:id', 'pages/me/MyContactDetail.tsx', { id: 'en-me-contact-detail' }),
      route('403', 'pages/public/Forbidden.tsx', { id: 'en-403' }),
      route('*', 'pages/public/NotFound.tsx', { id: 'en-not-found' }),
    ]),

    // 404 cho site Tiếng Việt
    route('*', 'pages/public/NotFound.tsx'),
  ]),
  route('admin', 'admin/AdminRoute.tsx', [
    index('pages/admin/Dashboard.tsx'),
    route('users', 'pages/admin/Users.tsx'),
    route('activity-logs', 'pages/admin/ActivityLogs.tsx'),
    route('media', 'pages/admin/Media.tsx'),
    route('posts', 'pages/admin/Posts.tsx'),
    route('posts/new', 'pages/admin/PostEditor.tsx', { id: 'post-new' }),
    route('posts/:id/edit', 'pages/admin/PostEditor.tsx'),
    route('posts/:id/preview', 'pages/admin/PostPreview.tsx'),
    route('menus', 'pages/admin/Menus.tsx'),
    route('categories', 'pages/admin/Categories.tsx'),
    route('review', 'pages/admin/Review.tsx'),
    route('review/:id', 'pages/admin/ReviewDetail.tsx'),
    route('pages', 'pages/admin/StaticPages.tsx'),
    route('pages/new', 'pages/admin/PageEditor.tsx', { id: 'page-new' }),
    route('pages/:id/edit', 'pages/admin/PageEditor.tsx'),
    route('home-sections', 'pages/admin/HomeSections.tsx'),
    route('home-slides', 'pages/admin/HomeSlides.tsx'),
    route('events', 'pages/admin/Events.tsx'),
    route('events/:id', 'pages/admin/EventRegistrations.tsx'),
    route('contacts', 'pages/admin/Contacts.tsx'),
    route('*', 'pages/admin/ComingSoon.tsx'),
  ]),
  ...devRoutes,
] satisfies RouteConfig
