# Trạng thái frontend

## Đã hoàn thành (Sprint 1)
- Khởi tạo Vite + React 19 + TypeScript (strict), react-router 8, Vitest, oxlint.
- Vite proxy `/api` sang backend `http://localhost:5179` (backend chưa bật CORS).
- `src/lib/api.ts`: fetch wrapper gửi cookie, chuẩn hóa lỗi ProblemDetails và `{ message }` thành `ApiError`. Có test.
- `src/lib/auth.tsx`: `AuthProvider` khôi phục phiên qua `GET /api/auth/me`, `login`/`logout`, guard `RequireRole` (chỉ là UX).
- Trang đăng nhập (FR-AUTH-01), đăng xuất (FR-AUTH-02), khung trang quản trị `/admin`, `/editor`, trang 403 và 404.

## Kế tiếp
- FR-AUTH-05: màn hình đổi mật khẩu (`POST /api/auth/change-password`).
- FR-AUTH-03/04: quản lý người dùng Admin (`/api/admin/users`, API đã có).
- Chờ API backend: menu, chuyên mục, media (Sprint 2).

## Ghi chú
- `GET /api/auth/me` chỉ trả `userId`, `role`, `email`; sau khi F5 chưa có `fullName`. Cần backend bổ sung nếu UI hiển thị tên.

## Cập nhật lần cuối
2026-09-27
