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
- Mọi request: `credentials: 'include'` (cookie HttpOnly `access_token`).
- Lỗi: `application/problem+json` → đọc `title`, `detail`, `errors` (validation). Riêng login 401 trả `{ message }` — wrapper phải xử lý cả hai.
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
| GET | `/api/auth/me` | – | `{ userId, role, email }` — dùng khôi phục phiên khi F5 |
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

User item: `{ id, email, username, fullName, role, isActive, createdAt }`. Tạo trả 201 `{ message, data }`; sửa/khóa trả `{ message, data }`; trùng username/email trả 400 `{ message }`. Trang: `/admin/users` (`src/pages/admin/Users.tsx`).

Cần biết khi dùng:
- `PUT` bắt buộc có `isActive` và ghi đè luôn trạng thái khóa. Frontend lấy `GET /{id}` mới nhất khi mở form sửa rồi gửi lại đúng `isActive` đó; khóa/mở chỉ qua `PATCH /status`.
- `search` chỉ tìm trong `username` và `fullName` (không tìm email).
- Việc cho backend: (1) chặn admin tự khóa / tự đổi role / hạ admin cuối cùng (hiện chỉ UI chặn); (2) giới hạn `pageSize` tối đa 50 (NFR-02); (3) bỏ `isActive` khỏi `PUT` hoặc thêm `version` để tránh ghi đè trạng thái; (4) mỗi trang gọi Supabase `GetUserById` cho từng dòng để lấy email (N+1, chậm khi pageSize lớn).

## Đề xuất — CHƯA CÓ (theo tài liệu hướng dẫn dev)

- `/api/admin/menus`, `/api/admin/categories`, `/api/admin/tags` — CRUD + sắp thứ tự (Sprint 2).
- `/api/media` — upload/list, Editor/Admin. URL file có hạn (~60s), không cache lâu.
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
