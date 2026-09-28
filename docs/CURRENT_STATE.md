# Trạng thái frontend

## Đã hoàn thành (Sprint 1)
- Khởi tạo Vite + React 19 + TypeScript (strict), react-router 8, Vitest, oxlint.
- Vite proxy `/api` sang backend `http://localhost:5179` (backend chưa bật CORS).
- `src/lib/api.ts`: fetch wrapper gửi cookie, chuẩn hóa lỗi ProblemDetails và `{ message }` thành `ApiError`. Có test.
- `src/lib/auth.tsx`: `AuthProvider` khôi phục phiên qua `GET /api/auth/me`, `login`/`logout`, guard `RequireRole` (chỉ là UX).
- Đăng nhập hoàn chỉnh (FR-AUTH-01): lỗi theo field từ validation backend, lỗi chung cho 401, hiện/ẩn mật khẩu, về lại trang trước qua `?next=` (chặn open redirect), chuẩn hóa role, xử lý hết phiên (401 bất kỳ → về trạng thái khách + thông báo). Có test.
- Đăng nhập (FR-AUTH-01), đăng xuất (FR-AUTH-02), khung trang quản trị `/admin`, `/editor`, trang 403 và 404.

- Theme xanh/trắng theo se.uit.edu.vn (`src/styles/tokens.css`), font Be Vietnam Pro, icon Phosphor.
- Bộ component `src/components/ui`: Button, TextField/TextArea/Select/Checkbox, Card, Badge + PostStatusBadge, Alert, ConfirmDialog, Pagination (có test), Skeleton, EmptyState, PageHeader, class bảng `.ui-table`.
- Header/footer public và sidebar quản trị dùng theme mới; trang đăng nhập dùng component mới.
- Style guide `/dev/ui` (chỉ khi dev).
- Trang quản trị dùng Ant Design 6 (lazy-load, chỉ tải khi vào `/admin`), theme map từ token (`src/admin/theme.ts`).
- Khung quản trị `src/admin/AdminLayout.tsx`: header + sidebar xanh đậm thu gọn được, menu lọc theo role (`src/admin/menu.tsx`, có test), mobile trượt đè.
- Gộp `/editor` vào `/admin` (editor và admin cùng một khung, menu theo role).
- Chuyển sang React Router 8 framework mode, bật SSR: trang public trả HTML đầy đủ + thẻ `og:*`, canonical (`src/lib/seo.ts`). Trang không tồn tại trả HTTP 404. `/admin` chỉ render ở client (`clientLoader.hydrate` + `HydrateFallback`), trả `noindex`.
- Trang chủ (FR-PUB-01, FR-PUB-02): hero, khối Thông báo mới, truy cập nhanh, tin nổi bật, nhóm tin theo chuyên mục, sự kiện sắp diễn ra (trạng thái còn chỗ/đủ chỗ/hết hạn, có test), hỏi đáp. Dữ liệu từ `GET /api/public/home` (đề xuất), dev dùng dữ liệu mẫu khi API chưa có.
- Header public có menu chính, menu mobile (`<details>`), link tìm kiếm, skip link; footer có địa chỉ, điện thoại, email của Khoa.
- Khung trang chi tiết bài `/posts/:slug` (loader SSR + meta), dùng DTO tạm chờ backend.
- Mẫu trang danh sách `/dev/admin/users`: lọc, tìm kiếm, phân trang, drawer tạo/sửa, khóa có xác nhận, trạng thái trên URL (`src/lib/useListParams.ts`).

- Task [FE] Đăng nhập, đăng xuất, đổi mật khẩu (FR-AUTH-01, 02, 05): validate trước khi gửi (`lib/validate.ts`), pending và khóa form, chống submit lặp, lỗi API theo field và focus field sai; trang đổi mật khẩu `/me/password` (reauth bằng mật khẩu hiện tại), vào từ header public và dropdown admin; đăng xuất chống bấm lặp, luôn về `/login`, đồng bộ nhiều tab (`BroadcastChannel`); `PasswordField`. Test component bằng Testing Library + jsdom. Còn nghiệm thu với backend thật.

## Kế tiếp
- Các trang được trang chủ liên kết tới nhưng chưa có (đang trả 404): `/categories/:slug`, `/events`, `/events/:id`, `/pages/:slug`, `/contact`, `/search`.
- FR-AUTH-05: màn hình đổi mật khẩu (`POST /api/auth/change-password`).
- FR-AUTH-03/04: trang `/admin/users` thật, copy từ mẫu `AdminListDemo`, nối `/api/admin/users` (API đã có).
- Chờ API backend: menu, chuyên mục, media (Sprint 2).

## Ghi chú
- Refresh token và logout thu hồi session đã làm ở cả backend (chưa commit trong repo backend) và frontend (`api.ts` tự refresh khi 401).
- Còn lại: sau logout, access token (JWT) vẫn qua được kiểm tra chữ ký ở backend đến khi hết hạn. Nên giảm JWT expiry trong Supabase xuống 10-15 phút (đã có refresh nên người dùng không bị đăng xuất sớm).
- `docker-compose.yml` đặt `ASPNETCORE_ENVIRONMENT=Development`: `GlobalExceptionMiddleware` sẽ trả message lỗi 500 thật. Deploy thật phải đặt `Production`.
- Deploy frontend giờ cần server Node (`npm run build && npm start`) + nginx chia `/api` sang backend.
- Ảnh bìa bài public cần URL công khai không hết hạn để dùng cho `og:image` (báo nhóm backend).
- `GET /api/auth/me` chỉ trả `userId`, `role`, `email`; sau khi F5 chưa có `fullName`. Cần backend bổ sung nếu UI hiển thị tên.

## Cập nhật lần cuối
2026-09-27
