---
title: Tech stack
inclusion: always
---

# Tech stack

## Kiến trúc tổng

```
React (frontend/) --fetch, cookie--> ASP.NET Core API (backend/) --EF Core--> PostgreSQL schema cms
                                           |
                                           +--> Supabase Auth (JWT) + Storage (bucket private)
```

- React: giao diện + validation hỗ trợ. **Không** quyết định quyền cuối cùng.
- ASP.NET Core: JWT, RBAC, ownership, DTO allowlist, upload validation, rate limit, transaction.
- Supabase Auth cấp JWT. Frontend **không** gọi Supabase trực tiếp; mọi thứ đi qua backend.

## Backend (đã có — `backend/`)

- .NET 10, N-Tier: `Api` / `Business` / `Data` / `Shared`. EF Core Code-First, FluentValidation, ProblemDetails (RFC 7807), Swagger.
- Luật riêng cho backend: `backend/AGENTS.md`. Trạng thái: `backend/docs/CURRENT_STATE.md`.

Chạy local:

```bash
cd backend && cp .env.example .env   # điền secret Supabase, không commit .env
docker compose up -d --build         # API: http://localhost:5179, Swagger: /swagger
```

## Frontend (`frontend/`)

- **Vite + React + TypeScript**.
- **React Router 8 framework mode** (`@react-router/dev`), **SSR bật** (`react-router.config.ts`). Trang public render HTML trên server để Google và Facebook/Zalo đọc được tiêu đề, mô tả, ảnh (thẻ OG). Trang `/admin` chỉ render ở client.
- **fetch** gốc qua một wrapper nhỏ `src/lib/api.ts`. Không axios.
- **Tiptap** cho trình soạn thảo (FR-POST-02) — lưu JSON khớp cột `posts.content` JSON của backend.
  - Extension chính thức thêm cho SCRUM-68 (bảng và định dạng kiểu Word), ghim đúng phiên bản của `@tiptap/core`: `@tiptap/extension-table` (bảng, gộp ô, kéo độ rộng cột, dán bảng từ Word), `extension-text-align` (căn lề), `extension-highlight` và `extension-text-style` (tô nền, màu chữ theo bảng màu `src/components/richTextPalette.ts`), `extension-subscript`, `extension-superscript`. Tự viết các phần này tốn hơn nhiều và dễ sai với ProseMirror.
- Styling trang public: CSS thuần + CSS variables (`src/styles/tokens.css`). Không Tailwind.
- **Ant Design 6 chỉ cho `/admin`** (lazy-load, trang public không tải). Theme map từ token ở `src/admin/theme.ts`. Không import `antd` ngoài `src/admin/` và `src/pages/admin/`.
- dayjs chỉ dùng khi component antd bắt buộc (DatePicker). Còn lại format ngày bằng `Intl`.
- Font: `@fontsource/be-vietnam-pro` (tự host, đủ dấu tiếng Việt). Icon: `@phosphor-icons/react`.
- Ngày giờ: `Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })`. Backend lưu UTC.
- Test: Vitest (đi kèm Vite) cho logic không tầm thường; `@testing-library/react` + `user-event` + `jsdom` (devDependencies) cho test component.

Thêm dependency mới → phải nêu lý do một dòng (xem `ponytail.md`).

Chạy local:

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173 (SSR + HMR)
npm run typecheck                          # sinh type route (+types) rồi tsc
npm run build && npm start                 # chạy bản production: server Node, cổng PORT (mặc định 3000)
```

Deploy: frontend là **server Node** (`build/server`) + file tĩnh (`build/client`), không còn là thư mục tĩnh thuần. Đặt nginx phía trước: `/api` → backend, còn lại → Node frontend, để trình duyệt thấy cùng origin (cookie `access_token`).

## Dev proxy (quan trọng)

Backend **chưa cấu hình CORS**. Dùng Vite proxy để frontend và API cùng origin, cookie `access_token` tự gửi:

```ts
// vite.config.ts
server: { proxy: { '/api': 'http://localhost:5179' } }
```

Mọi request frontend gọi đường dẫn tương đối `/api/...`. Không hard-code `http://localhost:5179` trong code.

## Biến môi trường

- `VITE_*`: giá trị public, lộ ra trình duyệt (`VITE_API_BASE_URL`). Không bao giờ đặt secret Supabase / service role key vào frontend.
- `API_URL`: server Node gọi backend khi SSR (mặc định `http://localhost:5179`).
- `SITE_URL`: URL công khai của site, dùng cho `og:url` và canonical. Bắt buộc đặt khi deploy.
- Mẫu: `frontend/.env.example`.
- Secret chỉ nằm trong `backend/.env` (đã gitignore).
