---
title: React frontend conventions
inclusion: fileMatch
fileMatchPattern: "**/src/**"
---

# Quy ước React frontend

## Code

- TypeScript `strict`. Type khai báo cạnh nơi dùng; chỉ tách khi ≥ 2 file dùng.
- Function component + hooks. Không class component.
- State: `useState` / `useReducer` tại chỗ. Global chỉ có `AuthContext`. Không thêm store lib.
- **Trang public** (SSR): lấy dữ liệu bằng `export async function loader()` trong file route, đọc qua `loaderData`. Không fetch trong `useEffect` (bot không thấy dữ liệu). 404 thì `throw data(null, { status: 404 })`.
- **Trang public** luôn `export const meta` gọi `seo({ title, description, url, image })` từ `src/lib/seo.ts`. Meta route con thay thế hoàn toàn meta route cha. Trang cần đăng nhập/lỗi dùng `noIndex()`.
- **Trang admin** (client-only): fetch trong component hoặc `clientLoader`. Được dùng `window`, `localStorage`.
- Code chạy trên server (loader, render trang public) **không** đụng `window`, `document`, `localStorage` khi render. Chỉ dùng trong `useEffect` hoặc event handler.
- Type route: `import type { Route } from './+types/<TenFile>'` (sinh bởi `npm run typecheck`).
- Cần cache/refetch phức tạp → hỏi trước khi thêm TanStack Query.
- Form public: controlled input hoặc `FormData` từ `<form onSubmit>`. HTML validation gốc (`required`, `type="email"`, `maxLength`) trước khi tự viết.
- Form admin: `antd` `Form` + `rules`.
- Validate trước khi gửi: hàm thuần trong `src/lib/validate.ts` (cùng quy tắc FluentValidation backend), form `noValidate`, lỗi tiếng Việt dưới field, `focusFirstError()`. Khi đang gửi: `<fieldset disabled>` + nút `loading` + bỏ qua submit lặp. Sau lỗi API: `flushSync` mở khóa rồi focus field sai (không dùng `requestAnimationFrame`: không chạy khi tab ẩn).
- Slug, lọc, phân trang giữ trên URL (`useSearchParams`) để F5 / chia sẻ link không mất trạng thái.

## `src/lib/api.ts` (một chỗ duy nhất)

- `credentials: 'include'`, header JSON, parse ProblemDetails hoặc `{ message }` thành `Error` có `status`.
- 401 → gọi `/api/auth/refresh` một lần rồi gửi lại. Refresh thất bại → phát `auth:expired`, `AuthProvider` về trạng thái khách, `RequireRole` chuyển `/login?next=...`.
- Không tự retry POST/PUT/PATCH/DELETE khi lỗi mạng hoặc 5xx (có thể đã ghi dữ liệu). Ngoại lệ duy nhất: gửi lại sau refresh khi bị 401, vì 401 nghĩa là server chưa thực hiện.

## UI / UX

- Text tiếng Việt, rõ ràng, lịch sự. Thông báo lỗi nói lý do + cách xử lý, không dump lỗi kỹ thuật.
- Mọi list có trạng thái: đang tải, rỗng, lỗi.
- Hành động phá hủy (xóa mềm, khóa user, lưu trữ bài) → xác nhận trước khi gọi API: `ConfirmDialog` ở public, `Popconfirm` ở admin.
- Trạng thái bài hiển thị tiếng Việt: `draft` Nháp, `pending` Chờ duyệt, `changes_requested` Yêu cầu chỉnh sửa, `published` Đã xuất bản, `archived` Lưu trữ.

## Bắt buộc (không được "lười")

- **NFR-06** responsive ≥ 360px; Chrome/Edge/Firefox 2 bản gần nhất.
- **NFR-07** `alt` cho mọi ảnh nội dung, `<label htmlFor>` cho mọi input, thao tác chính dùng được bằng bàn phím, focus thấy được.
- **NFR-05** không `dangerouslySetInnerHTML` với dữ liệu người dùng; không `eval`; link ngoài `rel="noopener noreferrer"`.
- **NFR-03** guard route là UX; đừng tin nó là bảo mật.
- **NFR-02** list luôn phân trang, không tải toàn bộ.

## Test

- Vitest cho logic có nhánh: state machine trạng thái bài (nút nào hiện theo role + status), parse lỗi trong `api.ts`, guard role.
- Test component (form, luồng chính): Testing Library + jsdom, dòng đầu file `// @vitest-environment jsdom`. Dùng `src/lib/test-utils.tsx`: `mockApi()` giả backend theo path, `renderPage()` render trong router + `AuthProvider` thật, `deferred()` giữ request ở trạng thái đang gửi. Truy vấn theo label/role (như người dùng), không theo class.
- Không snapshot test. Không test component chỉ render tĩnh.

## Xong task

Cập nhật `frontend/docs/CURRENT_STATE.md` (tạo nếu chưa có): Đã xong / Đang làm / Kế tiếp + ngày giờ, ghi mã FR/AT. Văn bản bình thường, không caveman.
