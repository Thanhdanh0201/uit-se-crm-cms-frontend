import { useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router'
import { Alert, App, Button, Card, Drawer, Dropdown, Empty, Flex, Form, Input, Modal, Segmented, Select, Skeleton, Switch, Tag, Tree } from 'antd'
import type { MenuProps } from 'antd'
import { ArrowsDownUp, ArrowSquareOut, CaretDown, DotsSixVertical, DotsThreeVertical, FloppyDisk, Info, PencilSimple, Plus, Trash, Warning } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { changedCount, dropNode, findNode, flatten, height, step, subtreeIds, toOrder, viSearchMatch, type Move } from '../../admin/tree'

export const meta = () => noIndex('Menu website')

// DTO theo backend: MenuResponseDto, MenuItemTreeDto (GET /api/admin/menus, /api/admin/menus/{id}/items).
type Menu = { id: string; code: string; name: string; itemCount: number }
type Kind = 'page' | 'category' | 'external'
export type MenuItem = {
  id: string
  parentId: string | null
  label: string
  kind: Kind
  pageId: string | null
  pageTitle: string | null
  categoryId: string | null
  categoryName: string | null
  externalUrl: string | null
  resolvedUrl: string | null
  targetWarning: string | null
  targetWarningMessage: string | null
  sortOrder: number
  isVisible: boolean
  children: MenuItem[]
}
type PageRef = { id: string; title: string; slug: string; status: string }
type CategoryRef = { id: string; name: string; slug: string; isVisible: boolean; parentName: string | null }
type ItemValues = { label: string; kind: Kind; pageId?: string; categoryId?: string; externalUrl?: string; parentId?: string | null; isVisible: boolean }

const NO_ITEMS: MenuItem[] = []
const MAX_DEPTH = 3 // FR-MENU-01, backend MenuService.MaxTreeDepth
const KIND: Record<Kind, { label: string; color: string }> = {
  page: { label: 'Trang', color: 'blue' },
  category: { label: 'Chuyên mục', color: 'cyan' },
  external: { label: 'Liên kết ngoài', color: 'orange' },
}
const MOVE_LABEL: Record<Move, string> = { up: 'Lên trên', down: 'Xuống dưới', in: 'Vào trong (làm mục con của mục trên)', out: 'Ra ngoài một cấp' }

const errorMessage = (err: unknown) =>
  !(err instanceof ApiError) ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    : err.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
      : err.status === 404 ? 'Menu hoặc mục menu không còn tồn tại. Danh sách đã được tải lại.'
        : err.status >= 500 ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
          : err.message

// Field trong lỗi validation backend (PascalCase) -> field của form.
const FIELD: Record<string, keyof ItemValues> = { label: 'label', kind: 'kind', pageid: 'pageId', categoryid: 'categoryId', externalurl: 'externalUrl', parentid: 'parentId' }

function MenusContent() {
  const { message, modal } = App.useApp()
  const list = useListParams()
  const [menus, setMenus] = useState<Menu[] | null>(null)
  const [menusError, setMenusError] = useState('')
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [itemsError, setItemsError] = useState('')
  // Thứ tự đang sửa trên máy, chưa gửi. null = giống server.
  const [draft, setDraft] = useState<MenuItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuReload, setMenuReload] = useState(0)
  const [itemsReload, setItemsReload] = useState(0)
  const [menuForm, setMenuForm] = useState<Menu | 'new' | null>(null)
  const [expanded, setExpanded] = useState<string[] | null>(null)
  // Dropdown đang mở ("id:move" hoặc "id:more"). Giữ ở đây vì hàng được dựng lại khi đổi vị trí, popup cũ sẽ không tự đóng.
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const dropdown = (key: string) => ({ trigger: ['click' as const], open: openMenu === key, onOpenChange: (o: boolean) => setOpenMenu(o ? key : null) })

  const menuId = list.params.get('menu') ?? menus?.[0]?.id ?? null
  const menu = menus?.find((m) => m.id === menuId) ?? null
  const tree = draft ?? items ?? NO_ITEMS
  const dirty = draft !== null && items !== null && changedCount(items, draft) > 0

  useEffect(() => {
    const ctrl = new AbortController()
    setMenusError('')
    api<Menu[]>('/api/admin/menus', { signal: ctrl.signal })
      .then(setMenus)
      .catch((err) => !ctrl.signal.aborted && setMenusError(errorMessage(err)))
    return () => ctrl.abort()
  }, [menuReload])

  useEffect(() => {
    if (!menuId) return
    const ctrl = new AbortController()
    setItems(null)
    setItemsError('')
    setDraft(null)
    api<MenuItem[]>(`/api/admin/menus/${menuId}/items`, { signal: ctrl.signal })
      .then(setItems)
      .catch((err) => !ctrl.signal.aborted && setItemsError(errorMessage(err)))
    return () => ctrl.abort()
  }, [menuId, itemsReload])

  // Thứ tự chưa lưu: hỏi trước khi rời trang hoặc đổi sang menu khác.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && (currentLocation.pathname !== nextLocation.pathname || new URLSearchParams(nextLocation.search).get('menu') !== menuId))
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    modal.confirm({
      title: 'Bỏ thứ tự chưa lưu?',
      content: 'Thứ tự và cấp của các mục bạn vừa đổi sẽ mất.',
      okText: 'Bỏ thay đổi',
      cancelText: 'Ở lại',
      okButtonProps: { danger: true },
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    })
  }, [blocker, modal])
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const reloadItems = () => {
    setItemsReload((k) => k + 1)
    setMenuReload((k) => k + 1) // số mục trong danh sách menu
  }

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return false
    setBusy(true)
    try {
      await action()
      message.success(success)
      return true
    } catch (err) {
      message.error(errorMessage(err))
      if (err instanceof ApiError && err.status === 404) reloadItems()
      return false
    } finally {
      setBusy(false)
    }
  }

  function move(id: string, m: Move) {
    setOpenMenu(null)
    const next = step(tree, id, m, MAX_DEPTH)
    if (next) setDraft(next)
  }

  async function saveOrder() {
    if (!menuId || !draft) return
    // Lỗi (ví dụ server từ chối vượt cấp) thì giữ nguyên thứ tự đang sửa để người dùng chỉnh tiếp.
    await run(() => api<MenuItem[]>(`/api/admin/menus/${menuId}/tree`, { method: 'PUT', json: { items: toOrder(draft) } }).then((saved) => (setItems(saved), setDraft(null))), 'Đã lưu thứ tự menu.')
  }

  const hiddenByParent = useMemo(() => {
    const ids = new Set<string>()
    for (const f of flatten(tree)) if (f.parentId && (ids.has(f.parentId) || !findNode(tree, f.parentId)!.isVisible)) ids.add(f.node.id)
    return ids
  }, [tree])
  const depthOf = useMemo(() => new Map(flatten(tree).map((f) => [f.node.id, f.depth])), [tree])
  const allKeys = useMemo(() => flatten(tree).filter((f) => f.node.children.length).map((f) => f.node.id), [tree])

  function rowActions(item: MenuItem): MenuProps['items'] {
    const can = (m: Move) => step(tree, item.id, m, MAX_DEPTH) !== null
    return (['up', 'down', 'in', 'out'] as Move[]).map((m) => ({ key: m, label: MOVE_LABEL[m], disabled: busy || !can(m), onClick: () => move(item.id, m) }))
  }

  function confirmDelete(item: MenuItem) {
    const count = subtreeIds(item).size - 1
    modal.confirm({
      title: `Xóa mục "${item.label}"?`,
      content: count ? `Mục này có ${count} mục con, chúng cũng bị xóa khỏi menu. Trang và chuyên mục đích không bị ảnh hưởng.` : 'Mục bị gỡ khỏi menu website. Trang và chuyên mục đích không bị ảnh hưởng.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () => run(() => api(`/api/admin/menu-items/${item.id}`, { method: 'DELETE' }), `Đã xóa mục "${item.label}".`).then((ok) => ok && reloadItems()),
    })
  }

  function confirmDeleteMenu(m: Menu) {
    modal.confirm({
      title: `Xóa menu "${m.name}"?`,
      content: `Menu và ${m.itemCount} mục bên trong bị xóa. Nơi trên website đang dùng mã "${m.code}" sẽ không còn menu này.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () =>
        run(() => api(`/api/admin/menus/${m.id}`, { method: 'DELETE' }), `Đã xóa menu "${m.name}".`).then(
          (ok) => ok && (list.update({ menu: null }), setMenuReload((k) => k + 1)),
        ),
    })
  }


  const toggle = (item: MenuItem) =>
    run(() => api(`/api/admin/menu-items/${item.id}/visibility`, { method: 'PATCH', json: { isVisible: !item.isVisible } }), item.isVisible ? `Đã ẩn "${item.label}" khỏi website.` : `Đã hiện "${item.label}" trên website.`).then(
      (ok) => ok && setItemsReload((k) => k + 1),
    )

  // Khi đang đổi thứ tự thì khóa các thao tác ghi khác, để lần tải lại sau đó không xóa mất thứ tự chưa lưu.
  const lockedTitle = dirty ? 'Lưu hoặc hủy thứ tự trước' : undefined

  function renderRow(item: MenuItem) {
    const depth = depthOf.get(item.id) ?? 1
    const atMax = depth >= MAX_DEPTH
    const target = item.resolvedUrl ?? item.externalUrl
    const parentHidden = hiddenByParent.has(item.id)
    return (
      <div className={`menu-row${item.targetWarning ? ' menu-row--broken' : ''}${!item.isVisible || parentHidden ? ' menu-row--hidden' : ''}`}>
        <div className="menu-row__main">
          <div className="menu-row__label">
            {item.label}
            {!item.isVisible && <Tag className="menu-row__tag">Đang ẩn</Tag>}
          </div>
          {item.targetWarning ? (
            <div className="menu-row__warning"><Warning size={14} aria-hidden /> {item.targetWarningMessage ?? 'Đích của mục không còn xem được, chọn đích khác.'}</div>
          ) : (
            <div className="menu-row__target">
              {target}
              {item.kind === 'external' && <ArrowSquareOut size={12} aria-label="mở ở trang ngoài" />}
            </div>
          )}
          {parentHidden && <div className="menu-row__target">Không hiện công khai vì mục cha đang ẩn</div>}
          <Tag color={KIND[item.kind].color} className="menu-row__kind-mobile">{KIND[item.kind].label}</Tag>
        </div>
        <div className="menu-row__kind"><Tag color={KIND[item.kind].color}>{KIND[item.kind].label}</Tag></div>
        <div className="menu-row__visible" onClick={(e) => e.stopPropagation()}>
          <Switch size="small" checked={item.isVisible} disabled={busy || dirty} title={lockedTitle} onChange={() => toggle(item)} aria-label={`${item.isVisible ? 'Ẩn' : 'Hiện'} "${item.label}" trên website`} />
        </div>
        <div className="menu-row__actions" onClick={(e) => e.stopPropagation()}>
          <Dropdown {...dropdown(`${item.id}:move`)} menu={{ items: rowActions(item) }}>
            <Button type="text" size="small" icon={<ArrowsDownUp size={16} />} title="Di chuyển" aria-label={`Di chuyển "${item.label}"`} />
          </Dropdown>
          <Button type="text" size="small" icon={<Plus size={16} />} disabled={busy || dirty || atMax} title={atMax ? 'Đã ở cấp 3, không thêm mục con được' : lockedTitle ?? 'Thêm mục con'} aria-label={`Thêm mục con cho "${item.label}"`} onClick={() => list.update({ action: 'create', id: null, parent: item.id })} />
          <Button type="text" size="small" icon={<PencilSimple size={16} />} disabled={busy || dirty} title={lockedTitle ?? 'Sửa'} aria-label={`Sửa "${item.label}"`} onClick={() => list.update({ action: 'edit', id: item.id, parent: null })} />
          <Button type="text" size="small" danger icon={<Trash size={16} />} disabled={busy || dirty} title={lockedTitle ?? 'Xóa'} aria-label={`Xóa "${item.label}"`} onClick={() => confirmDelete(item)} />
        </div>
        <div className="menu-row__more" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            {...dropdown(`${item.id}:more`)}
            menu={{
              onClick: () => setOpenMenu(null),
              items: [
                ...rowActions(item)!,
                { type: 'divider' },
                { key: 'child', label: 'Thêm mục con', disabled: busy || dirty || atMax, onClick: () => list.update({ action: 'create', id: null, parent: item.id }) },
                { key: 'edit', label: 'Sửa mục', disabled: busy || dirty, onClick: () => list.update({ action: 'edit', id: item.id, parent: null }) },
                { key: 'delete', label: 'Xóa mục', danger: true, disabled: busy || dirty, onClick: () => confirmDelete(item) },
              ],
            }}
          >
            <Button type="text" size="small" icon={<DotsThreeVertical size={18} />} aria-label={`Thao tác với "${item.label}"`} />
          </Dropdown>
        </div>
      </div>
    )
  }

  const menuList = (
    <Card
      size="small"
      className="menus-page__list"
      title="Menu"
      extra={<Button type="primary" size="small" icon={<Plus size={14} />} title="Thêm menu" aria-label="Thêm menu" onClick={() => setMenuForm('new')} />}
    >
      {menusError && <Alert type="error" showIcon title="Không tải được danh sách menu" description={menusError} action={<Button size="small" onClick={() => setMenuReload((k) => k + 1)}>Thử lại</Button>} />}
      {!menus && !menusError && <Skeleton active paragraph={{ rows: 3 }} />}
      {menus?.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có menu nào." />}
      <ul className="menus-page__menus">
        {menus?.map((m) => (
          <li key={m.id} className={m.id === menuId ? 'is-active' : undefined}>
            <button type="button" onClick={() => list.update({ menu: m.id, action: null, id: null, parent: null })} aria-current={m.id === menuId ? 'true' : undefined}>
              <strong>{m.name}</strong>
              <span className="muted">Mã: {m.code} · {m.itemCount} mục</span>
            </button>
            {m.id === menuId && (
              <span className="menus-page__menu-actions">
                <Button type="text" size="small" icon={<PencilSimple size={14} />} title="Sửa menu" aria-label={`Sửa menu "${m.name}"`} onClick={() => setMenuForm(m)} />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash size={14} />}
                  disabled={busy}
                  title="Xóa menu"
                  aria-label={`Xóa menu "${m.name}"`}
                  onClick={(e) => {
                    e.stopPropagation()
                    confirmDeleteMenu(m)
                  }}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )

  return (
    <div className="menus-page">
      <h1 className="admin-page-title">Menu website</h1>
      <div className="menus-page__grid">
        {menuList}
        {/* Màn hẹp: chọn menu bằng Select thay cho cột trái. */}
        <Select
          className="menus-page__picker"
          aria-label="Chọn menu"
          value={menuId ?? undefined}
          loading={!menus && !menusError}
          options={menus?.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))}
          onChange={(v) => list.update({ menu: v, action: null, id: null, parent: null })}
          popupRender={(node) => (
            <>
              {node}
              <Button type="link" icon={<Plus size={14} />} onClick={() => setMenuForm('new')}>Thêm menu</Button>
            </>
          )}
        />

        <Card
          className="menus-page__tree"
          title={menu ? <Flex gap={8} align="center">{menu.name} <Tag>{menu.code}</Tag></Flex> : 'Mục menu'}
          extra={menu && <Button type="primary" icon={<Plus size={16} />} disabled={busy || dirty} title={lockedTitle} onClick={() => list.update({ action: 'create', id: null, parent: null })}>Thêm mục</Button>}
        >
          {dirty && (
            <Alert
              type="warning"
              showIcon
              className="menus-page__dirty"
              title={`Đã đổi thứ tự ${changedCount(items!, draft!)} mục, chưa lưu.`}
              action={
                <Flex gap={8}>
                  <Button size="small" disabled={busy} onClick={() => setDraft(null)}>Hủy thay đổi</Button>
                  <Button size="small" type="primary" icon={<FloppyDisk size={14} />} loading={busy} onClick={saveOrder}>Lưu thứ tự</Button>
                </Flex>
              }
            />
          )}
          {!menuId && menus && <Empty description="Tạo menu đầu tiên để bắt đầu."><Button type="primary" onClick={() => setMenuForm('new')}>Thêm menu</Button></Empty>}
          {itemsError && <Alert type="error" showIcon title="Không tải được các mục menu" description={itemsError} action={<Button size="small" onClick={() => setItemsReload((k) => k + 1)}>Thử lại</Button>} />}
          {menuId && !items && !itemsError && <Skeleton active />}
          {items && items.length === 0 && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Menu chưa có mục nào.">
              <Button type="primary" onClick={() => list.update({ action: 'create', id: null, parent: null })}>Thêm mục đầu tiên</Button>
            </Empty>
          )}
          {items && items.length > 0 && (
            <>
              <p className="menus-page__hint muted"><Info size={14} aria-hidden /> Kéo <DotsSixVertical size={14} aria-label="biểu tượng kéo" /> để đổi thứ tự hoặc cấp, hoặc dùng nút Di chuyển (dùng được bằng bàn phím). Tối đa 3 cấp.</p>
              <div className="menu-tree">
                <div className="menu-tree__head" aria-hidden>
                  <span>Tên mục và đích</span>
                  <span>Loại</span>
                  <span>Hiển thị</span>
                  <span />
                </div>
                <Tree<TreeItem>
                  blockNode
                  selectable={false}
                  switcherIcon={<CaretDown size={14} aria-hidden />}
                  draggable={{ icon: <DotsSixVertical size={16} aria-hidden />, nodeDraggable: () => !busy }}
                  expandedKeys={expanded ?? allKeys}
                  onExpand={(keys) => setExpanded(keys as string[])}
                  treeData={withKeys(tree)}
                  titleRender={(n) => renderRow(findNode(tree, n.key)!)}
                  allowDrop={({ dragNode, dropNode: target, dropPosition }) =>
                    dropNode(tree, dragNode.key as string, target.key as string, dropPosition === 0 ? 'inside' : dropPosition < 0 ? 'before' : 'after', MAX_DEPTH) !== null
                  }
                  onDrop={(info) => {
                    const rel = info.dropPosition - Number(info.node.pos.split('-').pop())
                    const where = !info.dropToGap ? 'inside' : rel < 0 ? 'before' : 'after'
                    const next = dropNode(tree, info.dragNode.key as string, info.node.key as string, where, MAX_DEPTH)
                    if (next) setDraft(next)
                  }}
                />
              </div>
            </>
          )}
        </Card>
      </div>

      {menu && items && (
        <ItemDrawer
          menuId={menu.id}
          tree={items}
          action={list.action}
          editing={list.action === 'edit' && list.id ? findNode(items, list.id) ?? null : null}
          parentId={list.params.get('parent')}
          onClose={() => list.update({ action: null, id: null, parent: null })}
          onSaved={() => (list.update({ action: null, id: null, parent: null }), reloadItems())}
        />
      )}
      <MenuModal value={menuForm} onClose={() => setMenuForm(null)} onSaved={(m) => (setMenuForm(null), setMenuReload((k) => k + 1), list.update({ menu: m.id }))} />
    </div>
  )
}

// antd Tree cần key; giữ nguyên dữ liệu để titleRender vẽ hàng.
type TreeItem = Omit<MenuItem, 'children'> & { key: string; children: TreeItem[] }
const withKeys = (nodes: MenuItem[]): TreeItem[] => nodes.map((n) => ({ ...n, key: n.id, children: withKeys(n.children) }))

function MenuModal({ value, onClose, onSaved }: { value: Menu | 'new' | null; onClose: () => void; onSaved: (m: Menu) => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ code: string; name: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = value && value !== 'new' ? value : null

  useEffect(() => {
    setError('')
    if (value === 'new') form.setFieldsValue({ code: '', name: '' })
    else if (value) form.setFieldsValue({ code: value.code, name: value.name })
  }, [value, form])

  async function onFinish(v: { code: string; name: string }) {
    if (busy) return
    setBusy(true)
    setError('')
    const body = { code: v.code.trim(), name: v.name.trim() }
    try {
      const saved = editing
        ? await api<Menu>(`/api/admin/menus/${editing.id}`, { method: 'PUT', json: body })
        : await api<Menu>('/api/admin/menus', { method: 'POST', json: body })
      message.success(editing ? 'Đã lưu menu.' : `Đã tạo menu "${saved.name}".`)
      onSaved(saved)
    } catch (err) {
      if (err instanceof ApiError && err.errors) form.setFields(Object.entries(err.errors).map(([k, errors]) => ({ name: k.toLowerCase() as 'code' | 'name', errors })))
      else if (err instanceof ApiError && err.status === 400) form.setFields([{ name: 'code', errors: [err.message] }])
      else setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!value} title={editing ? `Sửa menu "${editing.name}"` : 'Thêm menu'} okText="Lưu" cancelText="Hủy" confirmLoading={busy} onOk={() => form.submit()} onCancel={onClose} destroyOnHidden>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish} disabled={busy} requiredMark>
        <Form.Item name="name" label="Tên menu" rules={[{ required: true, whitespace: true, message: 'Nhập tên menu.' }, { max: 150, message: 'Tên tối đa 150 ký tự.' }]}>
          <Input maxLength={150} placeholder="Ví dụ: Menu chân trang" />
        </Form.Item>
        <Form.Item
          name="code"
          label="Mã menu"
          extra={editing ? 'Website tìm menu theo mã này. Đổi mã thì nơi đang dùng mã cũ sẽ không còn menu.' : 'Website tìm menu theo mã này, ví dụ main (menu chính), footer.'}
          rules={[{ required: true, message: 'Nhập mã menu.' }, { max: 50, message: 'Mã tối đa 50 ký tự.' }, { pattern: /^[a-z0-9-]+$/, message: 'Mã chỉ gồm chữ thường không dấu, chữ số và dấu gạch ngang.' }]}
        >
          <Input maxLength={50} placeholder="footer" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function ItemDrawer({ menuId, tree, action, editing, parentId, onClose, onSaved }: {
  menuId: string
  tree: MenuItem[]
  action: 'create' | 'edit' | null
  editing: MenuItem | null
  parentId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<ItemValues>()
  const kind = Form.useWatch('kind', form)
  const pageId = Form.useWatch('pageId', form)
  const categoryId = Form.useWatch('categoryId', form)
  const [pages, setPages] = useState<PageRef[] | null>(null)
  const [categories, setCategories] = useState<CategoryRef[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parentOpen, setParentOpen] = useState(false)
  const [pageOpen, setPageOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const open = action === 'create' || !!editing

  useEffect(() => {
    if (!open) return
    setError('')
    setParentOpen(false)
    setPageOpen(false)
    setCategoryOpen(false)
    if (editing) {
      form.setFieldsValue({
        label: editing.label,
        kind: editing.kind,
        pageId: editing.pageId ?? undefined,
        categoryId: editing.categoryId ?? undefined,
        externalUrl: editing.externalUrl ?? undefined,
        parentId: editing.parentId,
        isVisible: editing.isVisible,
      })
    } else form.setFieldsValue({ label: '', kind: 'page', pageId: undefined, categoryId: undefined, externalUrl: undefined, parentId: parentId ?? undefined, isVisible: true })
  }, [open, editing, parentId, form])

  // Nguồn chọn đích: tải khi mở drawer. Lỗi thì chỉ mất danh sách chọn, vẫn hiện thông báo.
  useEffect(() => {
    if (!open || pages) return
    // ponytail: lấy tối đa 50 trang tĩnh, lọc ở máy. Khoa có ít trang tĩnh; nhiều hơn thì chuyển sang tìm trên server.
    api<{ items: PageRef[] }>('/api/admin/pages?pageSize=50').then((r) => setPages(r.items)).catch(() => setPages([]))
    api<CategoryRef[]>('/api/admin/categories').then(setCategories).catch(() => setCategories([]))
  }, [open, pages])

  const flat = useMemo(() => flatten(tree, (n) => n.label), [tree])
  const blocked = editing ? subtreeIds(editing) : new Set<string>()
  const ownHeight = editing ? height(editing) : 1
  const parentOptions = [
    { value: '', label: 'Không có (cấp 1 / mục gốc)' },
    ...flat.filter((f) => !blocked.has(f.node.id)).map((f) => ({ value: f.node.id, label: f.path.join(' / ') })),
  ]

  async function onFinish(v: ItemValues) {
    if (busy) return
    setBusy(true)
    setError('')
    const newParent = v.parentId?.trim() || null
    const body = {
      label: v.label.trim(),
      kind: v.kind,
      parentId: newParent,
      pageId: v.kind === 'page' ? v.pageId : null,
      categoryId: v.kind === 'category' ? v.categoryId : null,
      externalUrl: v.kind === 'external' ? v.externalUrl?.trim() : null,
      isVisible: v.isVisible,
    }
    try {
      if (editing) {
        // Đổi mục cha thì đưa xuống cuối danh sách con của cha mới.
        const siblings = newParent ? findNode(tree, newParent)?.children ?? [] : tree
        const sortOrder = newParent === editing.parentId ? editing.sortOrder : siblings.length + 1
        await api(`/api/admin/menu-items/${editing.id}`, { method: 'PUT', json: { ...body, sortOrder } })
      } else await api(`/api/admin/menus/${menuId}/items`, { method: 'POST', json: body })
      message.success(editing ? 'Đã lưu mục menu.' : `Đã thêm "${body.label}" vào menu.`)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        form.setFields(Object.entries(err.errors).flatMap(([k, errors]) => (FIELD[k.toLowerCase()] ? [{ name: FIELD[k.toLowerCase()], errors }] : [])))
      } else if (err instanceof ApiError && err.status === 400) {
        // Lỗi nghiệp vụ (vượt 3 cấp, vòng lặp, đích bị ẩn/xóa): backend chỉ trả detail, hiện ở đầu form và dưới ô liên quan.
        setError(err.message)
        if (/cấp|cha|vòng lặp/i.test(err.message)) form.setFields([{ name: 'parentId', errors: [err.message] }])
        else if (/trang/i.test(err.message) && v.kind === 'page') form.setFields([{ name: 'pageId', errors: [err.message] }])
        else if (/chuyên mục/i.test(err.message) && v.kind === 'category') form.setFields([{ name: 'categoryId', errors: [err.message] }])
      } else {
        setError(errorMessage(err))
        if (err instanceof ApiError && err.status === 404) onSaved()
      }
    } finally {
      setBusy(false)
    }
  }

  const page = pages?.find((p) => p.id === pageId)
  const category = categories?.find((c) => c.id === categoryId)

  return (
    <Drawer
      open={open}
      title={editing ? `Sửa mục "${editing.label}"` : 'Thêm mục menu'}
      size={480}
      onClose={onClose}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" loading={busy} onClick={() => form.submit()}>Lưu</Button>
        </Flex>
      }
    >
      {error && <Alert type="error" showIcon title="Chưa lưu được" description={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish} disabled={busy} requiredMark>
        <Form.Item name="label" label="Tên hiển thị" rules={[{ required: true, whitespace: true, message: 'Nhập tên hiển thị.' }, { max: 150, message: 'Tên tối đa 150 ký tự.' }]}>
          <Input maxLength={150} placeholder="Ví dụ: Lịch thi" />
        </Form.Item>
        <Form.Item name="kind" label="Loại mục" rules={[{ required: true }]}>
          <Segmented block options={(Object.keys(KIND) as Kind[]).map((k) => ({ value: k, label: KIND[k].label }))} />
        </Form.Item>
        {kind === 'page' && (
          <Form.Item name="pageId" label="Trang đích" rules={[{ required: true, message: 'Chọn trang đích.' }]} extra={page ? `Link tự sinh: /pages/${page.slug}` : 'Trang chưa xuất bản thì mục không hiện trên website.'}>
            <Select
              showSearch
              open={pageOpen}
              onOpenChange={setPageOpen}
              onClick={() => setPageOpen(true)}
              filterOption={(input, option) => viSearchMatch(input, String(option?.label ?? ''))}
              loading={!pages}
              placeholder="Chọn trang"
              notFoundContent={pages?.length === 0 ? 'Chưa có trang nào hoặc không tải được.' : undefined}
              options={pages?.map((p) => ({ value: p.id, label: p.status === 'published' ? p.title : `${p.title} (chưa xuất bản)` }))}
              onChange={(val) => {
                form.setFieldValue('pageId', val)
                setPageOpen(false)
              }}
            />
          </Form.Item>
        )}
        {kind === 'category' && (
          <Form.Item name="categoryId" label="Chuyên mục đích" rules={[{ required: true, message: 'Chọn chuyên mục đích.' }]} extra={category ? `Chỉ hiện chuyên mục chưa bị xóa. Link tự sinh: /categories/${category.slug}` : 'Chỉ hiện chuyên mục chưa bị xóa. Chuyên mục đang ẩn không chọn được.'}>
            <Select
              showSearch
              open={categoryOpen}
              onOpenChange={setCategoryOpen}
              onClick={() => setCategoryOpen(true)}
              filterOption={(input, option) => viSearchMatch(input, String(option?.label ?? ''))}
              loading={!categories}
              placeholder="Chọn chuyên mục"
              options={categories?.map((c) => ({ value: c.id, label: c.isVisible ? c.name : `${c.name} (đang ẩn)`, disabled: !c.isVisible && c.id !== editing?.categoryId }))}
              onChange={(val) => {
                form.setFieldValue('categoryId', val)
                setCategoryOpen(false)
              }}
            />
          </Form.Item>
        )}
        {kind === 'external' && (
          <Form.Item
            name="externalUrl"
            label="Địa chỉ liên kết"
            extra="Mở ở tab mới trên website."
            rules={[
              { required: true, whitespace: true, message: 'Nhập địa chỉ liên kết.' },
              { pattern: /^https?:\/\/\S+$/i, message: 'Địa chỉ phải bắt đầu bằng http:// hoặc https://, ví dụ https://tuyensinh.uit.edu.vn' },
            ]}
          >
            <Input type="url" inputMode="url" placeholder="https://" />
          </Form.Item>
        )}
        <Form.Item
          name="parentId"
          label="Mục cha"
          extra="Mặc định là mục cấp 1 (mục gốc). Danh sách không có chính mục này và các mục con của nó."
          rules={[
            {
              validator: (_, value: string | null | undefined) => {
                if (!value) return Promise.resolve()
                const p = flat.find((f) => f.node.id === value)
                if (!p || p.depth + ownHeight <= MAX_DEPTH) return Promise.resolve()
                return Promise.reject(
                  new Error(ownHeight === 1 ? `Không thể tạo mục con vì "${p.node.label}" đã ở cấp ${p.depth}. Menu chỉ cho phép tối đa 3 cấp.` : `Không chuyển được: mục này có mục con, đặt dưới "${p.node.label}" sẽ vượt quá 3 cấp.`),
                )
              },
            },
          ]}
        >
          <Select
            allowClear
            showSearch
            open={parentOpen}
            onOpenChange={setParentOpen}
            onClick={() => setParentOpen(true)}
            filterOption={(input, option) => viSearchMatch(input, String(option?.label ?? ''))}
            placeholder="Không có (cấp 1 / mục gốc)"
            options={parentOptions}
            onChange={(val) => {
              form.setFieldValue('parentId', val)
              setParentOpen(false)
            }}
          />
        </Form.Item>
        <Flex gap={12} align="start" style={{ marginTop: 8 }}>
          <Form.Item name="isVisible" valuePropName="checked" noStyle>
            <Switch id="menu-item-visible" />
          </Form.Item>
          <label htmlFor="menu-item-visible">
            Hiển thị trên website
            <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>Tắt để ẩn tạm, không cần xóa mục.</div>
          </label>
        </Flex>
      </Form>
    </Drawer>
  )
}

export default function Menus() {
  return (
    <RequireRole roles={['admin']}>
      <MenusContent />
    </RequireRole>
  )
}
