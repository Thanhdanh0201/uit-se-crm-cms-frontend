---
title: Backend rules pointer
inclusion: fileMatch
fileMatchPattern: "backend/**"
---

# Khi đụng vào `backend/`

Đọc và tuân theo `backend/AGENTS.md` — đó là luật chính của repo backend. Tóm tắt:

- Chỉ RESTful API. Không sinh UI trong backend.
- Giữ N-Tier: `Api` (controller, middleware) → `Business` (service, DTO, validator) → `Data` (EF Core) → `Shared`.
- Mọi endpoint có `[Authorize]` / `[Authorize(Roles = "...")]`, trừ public rõ ràng `[AllowAnonymous]`.
- Đổi schema chỉ bằng `dotnet ef migrations`. Không SQL thô ngoài EF Core.
- Xóa mềm `deleted_at`; bảng nội dung có `created_at/updated_at/created_by/updated_by`; `activity_logs` append-only.
- Thiếu thông tin trong tài liệu → hỏi, không đoán.
- "Hoàn thành task, hãy cập nhật context" → cập nhật `backend/docs/FEATURES.md`, `CURRENT_STATE.md`, ADR trong `DECISIONS.md` nếu có quyết định mới.

Đổi DTO / endpoint → cập nhật luôn `.kiro/steering/api-contract.md` để frontend không lệch.
