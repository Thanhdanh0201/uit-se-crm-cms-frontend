---
title: Project structure
inclusion: always
---

# Cấu trúc thư mục

```
CRM UIT/                     # thư mục workspace, KHÔNG phải git repo
├── CLAUDE.md                # (tự tạo) một dòng: @frontend/CLAUDE.md
├── .kiro -> frontend/.kiro  # (tự tạo) symlink, để Kiro mở ở workspace vẫn đọc steering
├── .claude/skills -> ../frontend/.claude/skills   # (tự tạo) symlink cho Claude Code
├── backend/                 # repo tientruong222/uit-se-crm-cms-backend
│   ├── AGENTS.md            # luật AI cho backend, đọc trước khi sửa backend
│   ├── Api/ Business/ Data/ Shared/
│   └── docs/                # ARCHITECTURE, DATABASE, FEATURES, CURRENT_STATE, DECISIONS
└── frontend/                # repo Thanhdanh0201/uit-se-crm-cms-frontend
    ├── .kiro/steering/      # steering (nguồn duy nhất, file này)
    ├── .claude/skills/      # taste skills (xem design.md)
    ├── CLAUDE.md            # entry cho Claude Code, import toàn bộ steering
    └── src/ docs/ ...
```

Steering nằm trong repo frontend để cả nhóm có chung một bản. Đường dẫn trong steering tính từ thư mục workspace (`frontend/src/...`, `backend/...`).

Dựng workspace sau khi clone 2 repo cạnh nhau:

```bash
cd "CRM UIT" && ln -s frontend/.kiro .kiro && mkdir -p .claude && ln -s ../frontend/.claude/skills .claude/skills && echo "@frontend/CLAUDE.md" > CLAUDE.md
```

`backend/` và `frontend/` là 2 git repo riêng. Commit tách nhau. Không sửa backend khi task là frontend, trừ khi user yêu cầu.

## Frontend (đề xuất, giữ phẳng)

```
frontend/src/
├── root.tsx             # <html>, <head> (Meta, Links), AuthProvider, ErrorBoundary
├── routes.ts            # khai báo route (thêm trang = thêm 1 dòng ở đây)
├── lib/
│   ├── api.ts           # fetch wrapper: credentials, JSON, ProblemDetails → Error; SSR gọi API_URL
│   ├── seo.ts           # seo() / noIndex(): title, description, og:*, canonical
│   └── auth.tsx         # AuthContext: user hiện tại, login/logout, <RequireRole>
├── layouts/             # PublicLayout (public, không antd)
├── admin/               # AdminLayout (antd), theme.ts, menu.tsx (menu theo role)
├── pages/
│   ├── public/          # Home, Category, PostDetail, Search, Events, Contact, Login
│   ├── me/              # Profile, SavedPosts, MyEvents, MyContacts (student)
│   ├── admin/           # Trang quản trị (antd) cho cả editor và admin: Posts, Media, Review, Menus, Users...
│   └── dev/             # Chỉ khi dev: UiKit (/dev/ui), AdminListDemo (/dev/admin/users)
├── styles/              # tokens.css (theme), base.css (reset, chữ, tiện ích)
├── components/ui/       # component giao diện dùng chung (xem design.md)
└── components/          # component nghiệp vụ dùng ở ≥ 2 trang
```

Quy tắc:

- Gọi API thẳng trong page (hoặc một hook nhỏ cạnh page). Không tạo layer `services/` bọc lại từng endpoint một dòng.
- Component chỉ chuyển vào `components/` khi trang thứ hai cần.
- Tên file component: `PascalCase.tsx`. Hook: `useXxx.ts`. Route path tiếng Anh, chữ thường: `/admin/users`.
- Text UI tiếng Việt, viết thẳng trong JSX (chưa có i18n — ngoài phạm vi).

## Route và quyền

| Prefix | Ai vào | Guard |
|---|---|---|
| `/`, `/posts/:slug`, `/search`, `/events`, `/contact`, `/login` | Tất cả | không |
| `/me/*` | đã đăng nhập | `<RequireRole roles={['student','editor','admin']}>` |
| `/admin/*` | `editor`, `admin` | `<RequireRole roles={['editor','admin']}>` ở route cha; trang chỉ admin bọc thêm `<RequireRole roles={['admin']}>`. Menu lọc theo `roles` trong `src/admin/menu.tsx` |

Guard chỉ là UX. Nhận 401 → chuyển `/login`. Nhận 403 → hiện "Bạn không có quyền".
