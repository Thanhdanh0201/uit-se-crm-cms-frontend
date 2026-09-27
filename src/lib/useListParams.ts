import { useSearchParams } from 'react-router'

type Patch = Record<string, string | number | null | undefined>

// Trạng thái trang danh sách nằm trên URL: page, pageSize, keyword, bộ lọc, và drawer (?action=create|edit&id=).
// Đổi bộ lọc/từ khóa thì tự về trang 1.
export function useListParams(defaultPageSize = 10) {
  const [params, setParams] = useSearchParams()

  function update(patch: Patch) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    const onlyPaging = Object.keys(patch).every((k) => k === 'page' || k === 'action' || k === 'id')
    if (!onlyPaging && !('page' in patch)) next.delete('page')
    setParams(next)
  }

  return {
    params,
    page: Number(params.get('page')) || 1,
    pageSize: Number(params.get('pageSize')) || defaultPageSize,
    keyword: params.get('keyword') ?? '',
    action: params.get('action') as 'create' | 'edit' | null,
    id: params.get('id'),
    update,
    openCreate: () => update({ action: 'create', id: null }),
    openEdit: (id: string) => update({ action: 'edit', id }),
    closeDrawer: () => update({ action: null, id: null }),
  }
}
