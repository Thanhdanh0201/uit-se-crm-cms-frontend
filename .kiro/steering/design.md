---
title: Visual design (taste-skill, adapted)
inclusion: fileMatch
fileMatchPattern: "**/src/**"
---

# Thiết kế giao diện

Skill cài trong `.claude/skills/` (nguồn: github.com/Leonxlnx/taste-skill, MIT):

- `design-taste-frontend`: chống UI "AI slop" cho trang public.
- `redesign-existing-projects`: audit rồi nâng cấp UI đã có, không viết lại từ đầu.
- `minimalist-ui`: phong cách editorial tối giản.

Các skill này viết cho landing page. File này chỉnh chúng cho dự án. Khi mâu thuẫn, **file này + `ponytail.md` + `tech.md` thắng**.

## Design read của dự án

"Website thông tin khoa đại học cho sinh viên và giảng viên, ngôn ngữ trust-first, rõ ràng, editorial nhẹ, ưu tiên accessibility."

| Khu vực | VARIANCE | MOTION | DENSITY | Skill áp dụng |
|---|---|---|---|---|
| Public: trang chủ, giới thiệu, sự kiện | 4 | 2 | 4 | `design-taste-frontend`, `minimalist-ui` |
| Public: danh sách / chi tiết bài, tìm kiếm | 3 | 2 | 5 | `minimalist-ui` (editorial) |
| `/me` | 2 | 1 | 5 | Component nhẹ của dự án |
| `/admin` | 2 | 1 | 7 | **Ant Design**, không dùng taste (skill tự loại admin). Xem mục Trang quản trị |

## Quy tắc riêng dự án

- **Font phải có đủ dấu tiếng Việt.** Nhiều font skill gợi ý (Satoshi, Cabinet Grotesk, Outfit...) thiếu glyph Vietnamese. Kiểm tra subset `vietnamese` trước khi chọn. Ứng viên an toàn: Be Vietnam Pro, Geist (kiểm tra bản mới), Inter (được phép vì trust-first). Self-host qua `@font-face` + `font-display: swap`.
- **Dependency:** skill gợi ý Tailwind, Motion, GSAP, shadcn. **Không tự cài.** Mỗi lib mới cần nhóm chốt và cập nhật `tech.md`. Mặc định: CSS thuần + CSS variables, animation bằng CSS transition. Icon đã chốt: Phosphor.
- **Màu:** một accent duy nhất. Xanh UIT `--color-primary`. Không gradient tím AI. Tương phản WCAG AA.
- **Không em-dash (`—`) trong text UI.** Dùng dấu phẩy, dấu chấm hoặc gạch ngang thường `-`.
- **Nội dung thật:** không "Lorem ipsum", "Nguyễn Văn A", "Acme". Dùng nội dung mẫu sát thực tế khoa (tin học vụ, học bổng, sự kiện). Ảnh placeholder: slot rõ ràng, không link ảnh ngoài vào code production.
- **Motion:** tối thiểu, luôn tôn trọng `prefers-reduced-motion`. Không scroll-hijack, parallax, marquee.
- **Dark mode:** chưa bắt buộc trong MVP. Dùng CSS variables để bật sau nếu cần.
- Giữ yêu cầu NFR-06 (≥ 360px) và NFR-07 (alt, label, bàn phím, focus rõ) ở mọi khu vực.

## Theme và component (đã có)

Token trong `frontend/src/styles/tokens.css`. Component chỉ dùng token ngữ nghĩa `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--text-*`. Không hard-code hex hay px lẻ.

- Màu chủ đạo `--color-primary` = `#0041D9` (theo se.uit.edu.vn). Nền trang `--color-bg` xám lạnh nhạt, surface trắng.
- Hình khối: control 8px (`--radius-control`), container 12px (`--radius-card`), pill chỉ cho badge.
- Bóng ngả xanh (`--shadow-sm/md/lg`), không bóng đen thuần.
- Font Be Vietnam Pro (`@fontsource/be-vietnam-pro`, 400/500/600/700). Icon: `@phosphor-icons/react`, không dùng thư viện icon thứ hai.

Component trang public trong `frontend/src/components/ui/` (import trực tiếp từng file, không barrel). Trang admin dùng Ant Design, xem mục dưới:

| File | Export | Dùng khi |
|---|---|---|
| `Button.tsx` | `Button`, `buttonClass()` | Mọi nút. `<Link className={buttonClass('secondary')}>` cho link dạng nút |
| `Field.tsx` | `TextField`, `PasswordField`, `TextArea`, `Select`, `Checkbox`, `Field` | Mọi input. Label trên, `hint`/`error` dưới, aria tự nối. `PasswordField` có nút hiện/ẩn |
| `Card.tsx` | `Card` | Khối nội dung có tiêu đề/actions |
| `Badge.tsx` | `Badge`, `PostStatusBadge`, `POST_STATUS` | Nhãn. Trạng thái bài luôn qua `PostStatusBadge` |
| `Alert.tsx` | `Alert` | Lỗi/thành công trong trang, lỗi form |
| `ConfirmDialog.tsx` | `ConfirmDialog` | Bắt buộc trước thao tác phá hủy |
| `Pagination.tsx` | `Pagination`, `pageItems()` | Mọi danh sách phân trang |
| `States.tsx` | `Skeleton`, `EmptyState`, `PageHeader` | Trạng thái tải/rỗng, đầu trang quản trị |
| `ui.css` | `.ui-table-wrap` + `.ui-table` | Bảng dữ liệu (chỉ class, không component) |

Style guide sống: `http://localhost:5173/dev/ui` (chỉ có khi dev). Thêm component mới thì thêm mẫu vào `src/pages/dev/UiKit.tsx`.

## Trang quản trị (Ant Design)

Khung: `src/admin/AdminLayout.tsx`. Header + sidebar xanh đậm (`--color-nav-bg`), sidebar thu gọn được (nhớ trong localStorage), mobile trượt đè lên nội dung. Menu khai báo ở `src/admin/menu.tsx`, mỗi mục có `roles`.

Mẫu trang danh sách: trang thật `src/pages/admin/Users.tsx` (nối API, xác nhận, lỗi 403/404, test ở `Users.test.tsx`). Bản dữ liệu giả để xem giao diện không cần backend: `src/pages/dev/AdminListDemo.tsx` (`/dev/admin/users`, `?as=editor` để xem menu biên tập viên):

- `Card`: `title` = `Segmented` lọc nhanh; `extra` = `Input.Search` (Enter mới tìm) + nút `+` chỉ icon, có `Tooltip` và `aria-label`.
- `Table`: phân trang server, `showSizeChanger` 10/20/50, `showTotal`, `scroll={{ x }}` cho mobile. Cột cuối là action icon.
- Tạo/sửa trong `Drawer` bên phải, footer Hủy + Lưu. Mở bằng URL `?action=create|edit&id=` qua `useListParams` (`src/lib/useListParams.ts`), F5 không mất.
- Thao tác phá hủy (khóa, xóa mềm, lưu trữ) qua `Popconfirm`. Không bọc `Tooltip` quanh nút mở Popconfirm (tooltip đè nút).
- Kết quả: `App.useApp().message`. Lỗi form: `Form.Item` rules + `Alert` trong drawer. Lỗi validation backend gắn vào field bằng `form.setFields`.
- Không cập nhật lạc quan: chỉ đổi UI sau khi server trả thành công, rồi tải lại danh sách. 403/404 hiện thông báo rõ, không để UI ở trạng thái thành công giả.
- Thao tác đổi quyền (đổi role, tạo admin) xác nhận bằng `modal.confirm` (await trả `true/false`).
- Hủy request cũ (`AbortController`) khi bộ lọc đổi nhanh.
- Test antd trong jsdom: polyfill `matchMedia` + `ResizeObserver`; dialog của antd ở môi trường test không có tên accessible (`aria-labelledby="test-id"`), tìm theo nội dung.
- Tag trạng thái dùng preset màu antd (`green`, `red`, `blue`, `cyan`), không dùng `success`/`error` (màu đục).
- Trạng thái, phân trang, từ khóa, bộ lọc đều trên URL.

Không: tự viết lại component antd đã có, trộn component `src/components/ui` vào trang admin (trừ `useListParams`), hard-code màu ngoài `theme.ts`.

## Cách dùng

- Làm màn public mới: gọi `/design-taste-frontend`, nêu design read ở trên.
- Làm đẹp màn đã có: gọi `/redesign-existing-projects`.
- Trước khi giao: chạy phần pre-flight check của skill, bỏ các mục chỉ dành cho landing (hero CTA, logo wall, bento, GSAP).
