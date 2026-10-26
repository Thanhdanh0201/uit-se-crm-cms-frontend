---
title: Backend API contract for frontend
inclusion: fileMatch
fileMatchPattern: "**/src/**"
---

# API contract (frontend ↔ backend)

Nguồn sự thật: code backend (`backend/Api/Controllers`, `backend/Business/DTOs`) và Swagger `http://localhost:5179/swagger`. File này là tóm tắt; lệch với code → tin code, cập nhật file này.

Endpoint chưa có trong backend → **không bịa DTO**. Hỏi nhóm backend hoặc ghi rõ "chờ API" trong UI.

## Quy ước chung

- JSON **camelCase** (mặc định ASP.NET Core).
- **Mọi response thành công được bọc** `{ success, message, data }` (`backend/Shared/Responses/ApiResponse.cs`). `api.ts` tự bóc (`unwrap()`), nơi gọi nhận thẳng `data`. Response chỉ có `message` (đăng xuất, đổi mật khẩu) trả `undefined`. **Không dùng `message` của server làm thông báo UI**: frontend tự viết tiếng Việt theo ngữ cảnh.
- Mọi request: `credentials: 'include'` (cookie HttpOnly `access_token`).
- Lỗi: `application/problem+json` (ProblemDetails) → đọc `title`, `detail`, `errors` (validation). `toApiError()` vẫn đọc được `{ message }` kiểu cũ.
- Status: 400 validation, 401 chưa/sai đăng nhập, 403 thiếu quyền hoặc tài khoản bị khóa, 404 không tồn tại / không được xem, 409 trùng hoặc sai `version`, 422 sai nghiệp vụ, 429 rate limit.
- Phân trang: `?page=&pageSize=`. Response: `{ items, totalItems, page, pageSize, totalPages }`. SRS đề xuất mặc định 20, tối đa 50 (users hiện mặc định 10).
- Role: `"student" | "editor" | "admin"`.
- Thời gian: ISO UTC. Hiển thị theo `Asia/Ho_Chi_Minh`.
- **Đa ngôn ngữ (Song ngữ Việt - Anh, SCRUM-69)**:
  - Hệ thống vận hành theo mô hình 2 website độc lập theo cột `locale` (`"vi"` | `"en"`), mặc định `"vi"`. Không có bảng phụ `*_translations`, không gọi dịch máy, tuyệt đối không fallback sang tiếng Việt (không tìm thấy trả 404).
  - 6 thực thể nội dung độc lập mang `locale`: Bài viết (`posts`), Trang tĩnh (`pages`), Chuyên mục (`categories`), Menu (`menus`), Khối trang chủ (`home_sections`), Slide trang chủ (`home_slides`).
  - Thẻ (`cms.tags`): DÙNG CHUNG giữa 2 website (không có cột locale, slug duy nhất toàn hệ thống).
  - Locale **bất biến sau khi tạo**: Endpoint cập nhật bỏ qua/không cho phép sửa trường `locale`.
  - **Validate liên kết cùng locale**: Bài viết/trang tĩnh trỏ chuyên mục, menu item trỏ chuyên mục/trang tĩnh, chuyên mục con trỏ chuyên mục cha, khối trang chủ trỏ chuyên mục phải cùng locale; vi phạm bị từ chối với **HTTP 422 ProblemDetails** (`code: "locale_mismatch"`).
  - Unique composite: `(locale, slug)` và `(locale, code)` cho phép trùng slug/code giữa 2 website khác locale nhưng chặn trùng trong cùng một locale.
  - Full-Text Search: Khi `locale == 'en'` dùng từ điển `'english'`; khi `locale == 'vi'` dùng từ điển không dấu `'simple'`.

## Auth — ĐÃ CÓ

| Method | Path | Body | Ghi chú |
|---|---|---|---|
| POST | `/api/auth/login` | `{ usernameOrEmail, password }` | Set cookie `access_token`. Trả `{ accessToken, refreshToken, expiresIn, user: { id, username, fullName, role, email } }` |
| POST | `/api/auth/refresh` | – | Đọc cookie `refresh_token` (HttpOnly, `Path=/api/auth`), cấp cookie mới. 401 nếu hết hạn/bị thu hồi/tài khoản khóa. `api.ts` tự gọi khi gặp 401 |
| POST | `/api/auth/logout` | – | Cho phép gọi khi đã hết hạn. Thu hồi session trên Supabase, xóa cả 2 cookie |
| GET | `/api/auth/me` | – | `UserProfileDto { id, username, fullName, role, email }` (cùng DTO với `user` khi đăng nhập). Dùng khôi phục phiên khi F5 |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword, confirmNewPassword }` | Sai mật khẩu hiện tại: **400** `errors.CurrentPassword` (không phải 401, để không bị hiểu là hết phiên). Trang: `/me/password` |

**Hành vi cần biết (đọc từ code backend):**
- Validation 400 trả `errors` với key PascalCase (`UsernameOrEmail`, `Password`). Dùng `ApiError.field('usernameOrEmail')` (không phân biệt hoa thường).
- Access token hết hạn sau `expiresIn` (thường 3600 giây). `api.ts` gặp 401 thì gọi `/api/auth/refresh` một lần (nhiều request cùng lúc chỉ refresh một lần) rồi gửi lại. Refresh thất bại thì phát `auth:expired`, `AuthProvider` về trạng thái khách, trang đăng nhập hiện "Phiên đăng nhập đã hết hạn".
- Không tự refresh cho `/api/auth/login|refresh|logout`.
- Response login/refresh không có `refreshToken` trong body. `accessToken` còn trong body chỉ để test Bearer bằng `Api.http`; frontend không dùng.
- Role trong response login đã chữ thường (backend `ToLowerInvariant()`); frontend vẫn chuẩn hóa phòng hờ.
- 401 của login luôn hiện lỗi chung ở UI (FR-AUTH-01).

**Bảo mật token:** login trả cả `accessToken` trong body, nhưng frontend **không lưu** nó (không `localStorage` / `sessionStorage` / state lâu dài). Chỉ dựa vào cookie HttpOnly. Chỉ giữ `user` trong React state.

## Admin users — ĐÃ CÓ (`admin`)

| Method | Path | Body / Query |
|---|---|---|
| GET | `/api/admin/users` | `?page&pageSize&search&role&isActive` |
| GET | `/api/admin/users/{id}` | – |
| POST | `/api/admin/users` | `{ email, password, username, fullName, role }` |
| PUT | `/api/admin/users/{id}` | `{ username, fullName, role, isActive }` |
| PATCH | `/api/admin/users/{id}/status` | `{ isActive }` — khóa/mở khóa |
| POST | `/api/admin/users/{id}/reset-password` | `{ newPassword? }` → `{ temporaryPassword }` (chỉ có khi bỏ trống mật khẩu; trả một lần). Thu hồi mọi phiên của người dùng. Tự đặt lại cho chính mình: 422 `reset_own_password` |
| DELETE | `/api/admin/users/{id}` | Xóa hẳn tài khoản chưa có dữ liệu (bookmark xóa theo). Có dữ liệu: 409 `user_has_data` kèm `usage` (nên khóa); tự xóa 422 `delete_self`; quản trị viên cuối 422 `last_admin` |
| GET | `/api/admin/users/import-template` | File Excel mẫu (`mau-nhap-tai-khoan.xlsx`) |
| POST | `/api/admin/users/import?dryRun=true\|false` | multipart `file` (.xlsx, tối đa 2 MB, 300 dòng) → `{ dryRun, totalRows, validRows, createdRows, failedRows, rows: [{ row, fullName, email, username, role, status, errors }] }`. Bắt buộc đủ 5 cột ở mọi dòng (Họ và tên, Email, Tên đăng nhập, Vai trò, Mật khẩu), ô trống là dòng lỗi; server không tự sinh mật khẩu. `status`: `valid`/`invalid` khi xem trước, `created`/`failed`/`invalid` khi nhập. Chỉ nhận vai trò sinh viên, biên tập viên. Lỗi file: 400 `invalid_file`/`invalid_template`/`empty_file`/`too_many_rows`, 413, 415 |

User item: `{ id, email, username, fullName, role, isActive, createdAt }`. Tạo (201), sửa, khóa đều trả user trong `data`. Trùng username/email trả 400. Trang: `/admin/users` (`src/pages/admin/Users.tsx`); đặt lại mật khẩu `src/admin/ResetPasswordModal.tsx`, nhập Excel `src/admin/UserImportDrawer.tsx` (`?action=import`). Backend: branch `feat/user-import-reset-password`.

Cần biết khi dùng:
- **Bắt đổi mật khẩu lần đầu:** tài khoản do admin tạo (form, Excel) hoặc vừa được đặt lại mật khẩu có `mustChangePassword: true` trong `UserProfileDto` (login, refresh, `/api/auth/me`). Khi cờ bật, mọi API cần đăng nhập trừ `/api/auth/me|change-password|logout|refresh` trả 403 `password_change_required`; `api.ts` phát `auth:password-change-required`, `RequireRole`/`AdminRoute` chuyển tới `/me/password?next=`. Tự đổi mật khẩu thì cờ tắt; mật khẩu mới phải khác mật khẩu hiện tại.
- `PUT` bắt buộc có `isActive` và ghi đè luôn trạng thái khóa. Frontend lấy `GET /{id}` mới nhất khi mở form sửa rồi gửi lại đúng `isActive` đó; khóa/mở chỉ qua `PATCH /status`.
- `search` chỉ tìm trong `username` và `fullName` (không tìm email).
- Việc cho backend: (1) chặn admin tự khóa / tự đổi role / hạ admin cuối cùng (hiện chỉ UI chặn); (2) giới hạn `pageSize` tối đa 50 (NFR-02); (3) bỏ `isActive` khỏi `PUT` hoặc thêm `version` để tránh ghi đè trạng thái; (4) mỗi trang gọi Supabase `GetUserById` cho từng dòng để lấy email (N+1, chậm khi pageSize lớn).

## Media — ĐÃ CÓ ở branch backend `feat/media-library` (`admin`, `editor`)

| Method | Path | Body / Query |
|---|---|---|
| GET | `/api/media` | `?kind=image\|document\|video&search&mine=true&page&pageSize` (mặc định 24, tối đa 50) |
| GET | `/api/media/{id}` | – |
| POST | `/api/media` | multipart: `file`, `name`, `altText` (bắt buộc với ảnh), `description` |
| POST | `/api/media/videos` | `{ url, name, description }` (chỉ YouTube) |
| PUT | `/api/media/{id}` | `{ name, altText, description }` |
| GET | `/api/media/{id}/usages` | – → `{ coverOf, posts, pages, total }`, mỗi mục `{ id, title, status }` |
| DELETE | `/api/media/{id}` | – |

`MediaDto`: `{ id, kind, name, description, altText, mimeType, sizeBytes, externalUrl, url, thumbnailUrl, urlExpiresAt, usageCount, createdAt, createdBy: { id, fullName } }`. Type ở `src/admin/media.ts`.

Cần biết khi dùng:
- `url`/`thumbnailUrl` là signed URL có hạn (`urlExpiresAt`, mặc định 10 phút). Không lưu lại; cần thì gọi lại API.
- Lỗi nghiệp vụ là ProblemDetails có `code` (đọc `ApiError.code`): `empty_file` 400, `file_too_large` 413, `unsupported_type` 415, `video_url_not_allowed` 422, `not_owner` 403, `media_in_use` 409 (kèm `usages`, đọc qua `ApiError.body`). `detail` là tiếng Việt, hiển thị được.
- Editor chỉ sửa/xóa media do mình tải lên; admin sửa/xóa tất cả.
- Upload dùng `upload()` trong `src/lib/api.ts` (XMLHttpRequest để có tiến độ), không dùng `api()`.

## Bài viết — ĐÃ CÓ ở branch backend `feat/posts-draft`, `feat/posts-review` (`admin`, `editor`)

| Method | Path | Body / Query | Ghi chú |
|---|---|---|---|
| GET | `/api/posts`, `/api/admin/posts` | `?locale&status&search&categoryId&mine&page&pageSize` (mặc định locale=vi) | Editor luôn chỉ thấy bài của mình; `mine` cho admin |
| GET | `/api/posts/{id}` | – | `PostDetail` cho trình soạn thảo |
| GET | `/api/posts/{id}/preview` | – | `PostView`, cùng dạng trang công khai. Chỉ tác giả hoặc admin |
| POST | `/api/posts` | `{ locale?, title, slug?, summary, content, coverMediaId?, primaryCategoryId, categoryIds, tagIds }` | Mặc định `locale="vi"`. Lệch locale category: 422 `locale_mismatch` |
| PUT | `/api/posts/{id}` | như POST + `version` | Lệch version: 409 `version_conflict`. Bỏ qua `locale` nếu gửi lên (locale bất biến) |
| POST | `/api/posts/{id}/status` | `{ toStatus, version, reason?, publishedAt?, expiresAt? }` | Vòng đời bài. `reason` bắt buộc khi `changes_requested` |
| PUT | `/api/posts/{id}/featured` | `{ isFeatured, priority }` | Chỉ admin. Không đổi version |
| GET | `/api/posts/{id}/history` | – | `[{ id, fromStatus, toStatus, reason, actor: { id, name }, createdAt }]`, mới nhất trước |
| GET | `/api/public/posts/{slug}` | `?locale=vi\|en` (mặc định vi) | Khách. Chỉ bài published theo đúng locale; còn lại 404 (không fallback) |
| POST | `/api/public/posts/{slug}/view` | `?locale=vi\|en` (mặc định vi) | Khách. Ghi nhận view theo đúng (locale, slug) |

Type ở `src/admin/posts.ts`. Cần biết khi dùng:
- `content` là JSON Tiptap. Backend lọc theo allowlist (`backend/Business/Services/RichTextContent.cs`): `paragraph`, `heading` (2-4), `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `hardBreak`, `text`, `image` (`attrs.mediaId`, `alt`), `video` (`attrs.mediaId`); mark `bold`, `italic`, `underline`, `strike`, `code`, `link` (http/https/mailto hoặc `/...`). Node, mark, thuộc tính khác bị bỏ.
- Ảnh/video trong nội dung chỉ lưu `mediaId`. URL hiển thị nằm trong `media` (theo id) và `cover`, là signed URL có hạn, lấy mới mỗi lần đọc bài.
- `allowedStatuses`: trạng thái người đang đăng nhập được chuyển tới. Nút thao tác hiện theo danh sách này, không tự suy luận.
- Lỗi: 403 `not_owner` (bài người khác), 422 `post_locked` (editor sửa bài đang chờ duyệt/đã xuất bản), 403 `forbidden_transition` (editor tự duyệt), 422 `invalid_transition`, 422 `locale_mismatch` (trỏ chuyên mục khác locale), 400 `errors.Summary/CoverMediaId/Content` khi gửi duyệt hoặc xuất bản thiếu dữ liệu.

## Trang tĩnh và trang chủ — ĐÃ CÓ ở branch backend `feat/pages-home` (`admin`)

| Method | Path | Body / Query | Ghi chú |
|---|---|---|---|
| GET | `/api/admin/pages` | `?locale&status&search&page&pageSize` | Lọc trang tĩnh theo locale |
| GET/PUT/DELETE | `/api/admin/pages/{id}` | PUT: `{ title, slug?, content, status, publishedAt?, expiresAt? }` | Bỏ qua `locale` khi PUT |
| POST | `/api/admin/pages` | `{ locale?, title, slug?, content, status, publishedAt?, expiresAt? }` | Mặc định `locale="vi"` |
| GET | `/api/admin/home-sections` | `?locale=vi\|en` | Danh sách khối trang chủ theo locale |
| POST | `/api/admin/home-sections` | `{ locale?, title, categoryId?, itemLimit, isVisible }` | Lệch locale category: 422 `locale_mismatch` |
| PUT/DELETE | `/api/admin/home-sections/{id}` | PUT: `{ title, categoryId?, itemLimit, isVisible }` | Bỏ qua `locale` khi PUT |
| PUT | `/api/admin/home-sections/order` | `{ ids }` (toàn bộ id theo thứ tự mới) | |
| GET | `/api/public/pages/{slug}` | `?locale=vi\|en` (mặc định vi) | Khách. Trang nháp/lưu trữ/hết hạn hoặc khác locale: 404 (không fallback) |
| GET | `/api/public/home` | `?locale=vi\|en` (mặc định vi) | Khách. `{ slides, bottomSlides, featured, latest, sections: [{ title, categorySlug, posts }], events: [] }` lọc 100% theo locale |

Xóa trang đang có trong menu: 409 `page_in_menu` kèm `menuItems`.

## Slider trang chủ — backend branch `feat/home-slides` (`admin`) — SCRUM-64, SCRUM-65

| Method | Path | Body / Query | Ghi chú |
|---|---|---|---|
| GET | `/api/admin/home-slides` | `?locale=vi\|en` | `HomeSlideDto[]` theo thứ tự và locale |
| POST / PUT | `/api/admin/home-slides[/{id}]` | `{ locale?, title, caption?, mediaId, linkUrl?, buttonLabel?, position, isVisible, startsAt?, endsAt? }` | PUT bỏ qua locale. Tối đa 10 slide bật mỗi vị trí theo locale |
| DELETE | `/api/admin/home-slides/{id}` | – | Xóa hẳn, ảnh vẫn còn trong thư viện |
| PUT | `/api/admin/home-slides/order` | `{ ids }` | Toàn bộ id slide theo thứ tự mới |

## Menu — ĐÃ CÓ (backend main, PR #1) — trang `/admin/menus` (SCRUM-35, SCRUM-62)

| Method | Path | Body / Query | Ghi chú |
|---|---|---|---|
| GET | `/api/admin/menus` | `?locale=vi\|en` | `MenuResponseDto[]`: `{ id, locale, code, name, maxDepth, itemCount }` |
| GET | `/api/admin/menus/{id}` | – | `MenuDetailResponseDto`: `{ id, locale, code, name, maxDepth, items }` |
| POST | `/api/admin/menus` | `{ locale?, code, name, maxDepth? }` | `code` duy nhất theo `(locale, code)`. `maxDepth` mặc định 3 (cho phép 1..10) |
| PUT | `/api/admin/menus/{id}` | `{ code, name, maxDepth? }` | Bắt buộc gửi cả `code`. Bỏ qua `locale`. Giảm `maxDepth` nhỏ hơn độ sâu hiện tại của cây: **HTTP 422 ProblemDetails** `code: "menu_depth_exceeded"` kèm `invalidItems: [{ id, label, depth }]`, cây không đổi |
| DELETE | `/api/admin/menus/{id}` | – | Xóa mềm menu và các mục |
| GET | `/api/admin/menus/{id}/items` | – | Cây `MenuItemTreeDto[]` |
| POST | `/api/admin/menus/{id}/items` | `{ label, kind, parentId?, pageId?, categoryId?, externalUrl?, sortOrder?, isVisible }` | Lệch locale: 422 `locale_mismatch`. Vượt `menu.maxDepth`: 400 Bad Request |
| PUT | `/api/admin/menus/{id}/tree` | `{ items: [{ id, parentId, sortOrder }] }` | Lưu thứ tự và cấp cả cây trong 1 transaction có row lock. Vượt `menu.maxDepth`: 400 |
| GET/PUT/DELETE | `/api/admin/menu-items/{id}` | – | Sửa cha làm vượt `menu.maxDepth` hoặc tạo vòng lặp: 400 |
| PATCH | `/api/admin/menu-items/{id}/visibility` | `{ isVisible }` | |
| GET | `/api/admin/menu-items/warnings` | – | Mục trỏ đích không xem được công khai |
| GET | `/api/public/menus/{code}` | `?locale=vi\|en` (mặc định vi) | Cả 2 website VI và EN đều dùng chung mã code `"main"`. Sai locale: 404 |

**Lỗi nghiệp vụ giảm số cấp menu (`menu_depth_exceeded` — HTTP 422)**:
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Độ sâu menu vượt giới hạn",
  "status": 422,
  "detail": "Không thể giảm số cấp tối đa của menu xuống 2 vì cây menu hiện tại đang có 2 mục ở cấp sâu hơn.",
  "instance": "/api/admin/menus/...",
  "code": "menu_depth_exceeded",
  "invalidItems": [
    {
      "id": "e4b0292d-965a-49e0-8f92-563b784a0d81",
      "label": "Tuyển sinh cao học",
      "depth": 3
    }
  ]
}
```

## Chuyên mục và thẻ — ĐÃ CÓ (backend main, PR #2) — trang `/admin/categories` (SCRUM-36)

| Method | Path | Body / Query | Ghi chú |
|---|---|---|---|
| GET | `/api/admin/categories/tree` | `?locale=vi\|en` | `CategoryTreeDto[]` theo locale |
| GET | `/api/admin/categories` | `?locale&search&parentId` | Danh sách phẳng theo locale |
| POST | `/api/admin/categories` | `{ locale?, name, slug?, description?, parentId?, sortOrder, isVisible }` | Chọn parentId khác locale: 422 `locale_mismatch` |
| PUT | `/api/admin/categories/{id}` | như POST | Bỏ qua `locale` khi PUT |
| DELETE | `/api/admin/categories/{id}` | `?targetCategoryId=` | Chuyển bài/con rồi xóa mềm |
| GET | `/api/admin/tags` | `?search` | Thẻ dùng chung 2 website, không có locale |
| POST / PUT / DELETE | `/api/admin/tags[/{id}]` | `{ name, slug? }` | Thẻ dùng chung |
| GET | `/api/public/categories/tree` | `?locale=vi\|en` | Cây chuyên mục công khai theo locale |
| GET | `/api/public/categories/{slug}` | `?locale=vi\|en` | Chi tiết chuyên mục theo locale; sai locale: 404 |
| GET | `/api/public/categories/{slug}/posts` | `?locale&page&pageSize` | Bài viết thuộc chuyên mục theo locale |
| GET | `/api/public/tags` | – | Khách, thẻ dùng chung |

## Website công khai — ĐÃ CÓ (backend main) — SCRUM-42, 43, 44, 53

| Method | Path | Body / Query | Ghi chú |
|---|---|---|---|
| GET | `/api/public/posts` | `?locale&keyword&categoryId&categorySlug&tagId&tagSlug&fromDate&toDate&page&pageSize` | Lọc 100% bài theo `locale` (mặc định vi). FTS keyword dùng từ điển `'english'` khi locale=en, `'simple'` khi locale=vi |
| GET | `/api/public/categories/{slug}/posts` | `?locale&page&pageSize` | Chuyên mục ẩn/khác locale: 404 |
| GET | `/api/public/categories` | `?locale=vi\|en` | Danh sách phẳng chuyên mục theo locale |
| POST | `/api/public/posts/{slug}/view` | `?locale=vi\|en` | Ghi nhận view theo (locale, slug) |
| GET | `/api/me/bookmarks` | `?page&pageSize` | Đăng nhập |
| GET / PUT / DELETE | `/api/me/bookmarks/{postId}` | – | Đăng nhập |

`PostCardDto`: `{ id, slug, title, summary, coverUrl, coverAlt, publishedAt, categoryName, categorySlug }`. `id` thêm ở backend branch `feat/post-card-id` (chờ merge) để bỏ lưu từ danh sách. Type ở `src/components/PostList.tsx`.

Cần biết khi dùng:
- `fromDate`/`toDate` so sánh với `publishedAt` (`>=`, `<=`). Frontend gửi ngày theo giờ Việt Nam: `YYYY-MM-DDT00:00:00+07:00` và `YYYY-MM-DDT23:59:59.999+07:00`.
- `keyword` dùng full-text Postgres (`simple`) trên tiêu đề, tóm tắt, nội dung.
- `PostViewDto` (chi tiết bài) có `id`, `tags: [{ id, name }]`, `viewCount`; `category` chỉ có `{ id, name }` (không có slug) nên link "bài cùng chuyên mục" và thẻ đi tới `/search?category=<id>` / `/search?tag=<id>`.

## Đề xuất — CHƯA CÓ (theo tài liệu hướng dẫn dev)

- **Ảnh bìa bài public cần URL công khai, không hết hạn** (bucket public cho ảnh bài đã xuất bản, hoặc endpoint backend trả ảnh). URL ký 60 giây không dùng được cho `og:image`: Facebook/Zalo tải ảnh sau đó và cache lại.
- `/api/admin/events`, `POST /api/events/{id}/registrations`, `DELETE /api/events/{id}/registrations/me`.
- `POST /api/contact-requests` (khách được gửi), `/api/admin/contact-requests`, `GET /api/me/contact-requests` (Should).
- `GET /api/admin/dashboard`, `GET /api/admin/activity-logs` (không có xóa log).

## Luật frontend khi gọi API

- Không gửi field server tự quyết: `userId`, `authorId`, `registeredCount`, `role` của chính mình, `createdBy`...
- Chống gửi trùng (NFR-08): disable nút submit khi đang gửi. Contact form gửi `Idempotency-Key` (`crypto.randomUUID()`) nếu backend hỗ trợ.
- Upload: kiểm tra trước loại + ≤ 10 MiB ở client cho UX; server vẫn kiểm tra lại. Hiện lý do từ chối rõ ràng (AT-05).
- Rich text: render JSON Tiptap qua renderer của Tiptap, không `dangerouslySetInnerHTML` với HTML thô.
