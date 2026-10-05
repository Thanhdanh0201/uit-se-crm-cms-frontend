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

User item: `{ id, email, username, fullName, role, isActive, createdAt }`. Tạo (201), sửa, khóa đều trả user trong `data`. Trùng username/email trả 400. Trang: `/admin/users` (`src/pages/admin/Users.tsx`).

Cần biết khi dùng:
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

## Đề xuất — CHƯA CÓ (theo tài liệu hướng dẫn dev)

- **Menu, chuyên mục, thẻ: backend ĐÃ CÓ** (PR #1, #2 trên `backend` main). Nguồn sự thật là code backend và `FRONTEND_INTEGRATION_GUIDE` của backend, không phải bản đề xuất `frontend/docs/api/sprint2-dto.md` (backend làm khác: sắp xếp menu bằng `PUT /api/admin/menus/{id}/tree`, lỗi vượt cấp trả 400, thẻ không phân trang). Chưa chép bảng endpoint vào đây.
  - **Quyền cần backend sửa:** `AdminMenuController`, `AdminMenuItemController`, `AdminCategoryController`, `AdminTagController` đang `[Authorize(Roles = "admin,editor")]` cho cả thao tác ghi. SRS 3.2: quản lý menu và chuyên mục chỉ Admin. Editor chỉ cần đọc chuyên mục/thẻ.
- `/api/editor/posts`, `POST /api/editor/posts/{id}/submit` — update gửi kèm `version`; 409 → báo "Bài đã bị sửa ở nơi khác, tải lại".
- `POST /api/admin/posts/{id}/review | publish | archive` — review "yêu cầu chỉnh sửa" bắt buộc `reason`.
- `/api/admin/pages`, `/api/admin/home-sections`.
- **`GET /api/public/home`** (đề xuất mới): một request cho SSR trang chủ, trả `{ featured, latest, sections: [{ title, categorySlug, posts }], events }`. Type tạm ở `frontend/src/pages/public/home.data.ts`. `sections` lấy theo `home_sections` Admin cấu hình. Khi dev mà API chưa có, trang chủ dùng `home.sample.ts` (không vào bản build).
- `GET /api/public/posts` (search, category, tag, date, page), `GET /api/public/posts/{slug}`, `GET /api/public/pages/{slug}`. Frontend đang dùng DTO tạm trong `src/pages/public/PostDetail.tsx` (`slug, title, summary, contentText, coverUrl, publishedAt, authorName, categoryName`), cần chốt với backend.
- **Ảnh bìa bài public cần URL công khai, không hết hạn** (bucket public cho ảnh bài đã xuất bản, hoặc endpoint backend trả ảnh). URL ký 60 giây không dùng được cho `og:image`: Facebook/Zalo tải ảnh sau đó và cache lại.
- `/api/admin/events`, `POST /api/events/{id}/registrations`, `DELETE /api/events/{id}/registrations/me`.
- `POST /api/contact-requests` (khách được gửi), `/api/admin/contact-requests`, `GET /api/me/contact-requests` (Should).
- `GET /api/admin/dashboard`, `GET /api/admin/activity-logs` (không có xóa log).

## Luật frontend khi gọi API

- Không gửi field server tự quyết: `userId`, `authorId`, `registeredCount`, `role` của chính mình, `createdBy`...
- Chống gửi trùng (NFR-08): disable nút submit khi đang gửi. Contact form gửi `Idempotency-Key` (`crypto.randomUUID()`) nếu backend hỗ trợ.
- Upload: kiểm tra trước loại + ≤ 10 MiB ở client cho UX; server vẫn kiểm tra lại. Hiện lý do từ chối rõ ràng (AT-05).
- Rich text: render JSON Tiptap qua renderer của Tiptap, không `dangerouslySetInnerHTML` với HTML thô.
