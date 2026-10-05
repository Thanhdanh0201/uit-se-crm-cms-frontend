import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  TreeSelect,
} from 'antd'
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsDownUp,
  ArrowUp,
  DotsSixVertical,
  FloppyDisk,
  Info,
  ListBullets,
  PencilSimple,
  Plus,
  Trash,
  Warning,
} from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import {
  countDescendants,
  findMenuItemDescendantIds,
  flattenMenuTreeForReorder,
  menuErrorMessage,
  moveMenuNode,
  recalculateTreeMetadata,
  type MenuDto,
  type MenuItemKind,
  type MenuItemTreeDto,
} from '../../admin/menus'
import type { CategoryTreeDto } from '../../admin/categories'

export const meta = () => noIndex('Menu')

type MenuItemFormValues = {
  label: string
  kind: MenuItemKind
  parentId?: string | null
  pageId?: string | null
  categoryId?: string | null
  externalUrl?: string | null
  isVisible?: boolean
}

type MenuFormValues = {
  name: string
  code: string
}

type PageDto = {
  id: string
  title: string
  slug: string
  status?: string
}

function fieldErrors(err: unknown) {
  if (!(err instanceof ApiError) || !err.errors) return []
  return Object.entries(err.errors).map(([key, errors]) => ({
    name: (key[0].toLowerCase() + key.slice(1)) as keyof MenuItemFormValues,
    errors,
  }))
}

function MenusContent() {
  const { message } = App.useApp()
  const list = useListParams()
  const selectedMenuId = list.params.get('menu')

  // Danh sách Menu bên trái
  const [menus, setMenus] = useState<MenuDto[]>([])
  const [menusLoading, setMenusLoading] = useState(true)
  const [menusError, setMenusError] = useState('')
  const [menusReloadKey, setMenusReloadKey] = useState(0)
  const reloadMenus = () => setMenusReloadKey((k) => k + 1)

  // Modal Tạo/Sửa Menu bên trái
  const [menuModalOpen, setMenuModalOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<MenuDto | null>(null)
  const [menuModalSaving, setMenuModalSaving] = useState(false)
  const [menuModalError, setMenuModalError] = useState('')
  const [menuForm] = Form.useForm<MenuFormValues>()

  // Cây mục Menu bên phải
  const [serverTree, setServerTree] = useState<MenuItemTreeDto[]>([])
  const [treeData, setTreeData] = useState<MenuItemTreeDto[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState('')
  const [itemsReloadKey, setItemsReloadKey] = useState(0)
  const reloadItems = () => setItemsReloadKey((k) => k + 1)

  // Lưu thứ tự cây
  const [savingTree, setSavingTree] = useState(false)
  const [treeSaveError, setTreeSaveError] = useState('')

  // Drawer Tạo/Sửa mục menu
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemTreeDto | null>(null)
  const [itemDrawerError, setItemDrawerError] = useState('')
  const [itemSaving, setItemSaving] = useState(false)
  const [itemForm] = Form.useForm<MenuItemFormValues>()
  const itemKind = Form.useWatch('kind', itemForm) ?? 'category'

  // Dữ liệu hỗ trợ chọn đích (Chuyên mục & Trang)
  const [categories, setCategories] = useState<CategoryTreeDto[]>([])
  const [pages, setPages] = useState<PageDto[]>([])
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])

  useEffect(() => {
    if (treeData.length > 0) {
      function collectIds(items: MenuItemTreeDto[]): string[] {
        return items.flatMap((i) => [i.id, ...(i.children ? collectIds(i.children) : [])])
      }
      setExpandedRowKeys(collectIds(treeData))
    }
  }, [treeData])

  // 1. Tải danh sách menu
  useEffect(() => {
    const ctrl = new AbortController()
    setMenusLoading(true)
    setMenusError('')

    api<MenuDto[] | { items: MenuDto[] }>('/api/admin/menus', { signal: ctrl.signal })
      .then((res) => {
        const listItems = Array.isArray(res) ? res : res?.items ?? []
        setMenus(listItems)
        // Nếu URL chưa có menu, chọn menu đầu tiên
        if (!selectedMenuId && listItems.length > 0) {
          list.update({ menu: listItems[0].id })
        }
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setMenus([])
        setMenusError(menuErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setMenusLoading(false))

    return () => ctrl.abort()
  }, [selectedMenuId, menusReloadKey])

  // 2. Tải cây mục của menu đang chọn
  useEffect(() => {
    if (!selectedMenuId) {
      setServerTree([])
      setTreeData([])
      return
    }

    const ctrl = new AbortController()
    setItemsLoading(true)
    setItemsError('')
    setTreeSaveError('')

    api<MenuItemTreeDto[] | { items: MenuItemTreeDto[] }>(`/api/admin/menus/${selectedMenuId}/items`, { signal: ctrl.signal })
      .catch((err) => {
        if (ctrl.signal.aborted) throw err
        return api<MenuItemTreeDto[] | { items: MenuItemTreeDto[] }>(`/api/admin/menus/${selectedMenuId}/tree`, { signal: ctrl.signal })
      })
      .then((res) => {
        const rawItems = Array.isArray(res) ? res : res?.items ?? []
        const withMeta = recalculateTreeMetadata(rawItems)
        setServerTree(withMeta)
        setTreeData(withMeta)
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setServerTree([])
        setTreeData([])
        setItemsError(menuErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setItemsLoading(false))

    return () => ctrl.abort()
  }, [selectedMenuId, itemsReloadKey])

  // 3. Tải danh mục & trang tĩnh phục vụ chọn đích
  const reloadTargetData = useCallback(() => {
    api<CategoryTreeDto[] | { items: CategoryTreeDto[] }>('/api/admin/categories/tree')
      .catch(() => api<CategoryTreeDto[] | { items: CategoryTreeDto[] }>('/api/public/categories/tree'))
      .catch(() => api<CategoryTreeDto[] | { items: CategoryTreeDto[] }>('/api/public/categories'))
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.items ?? []
        setCategories(list)
      })
      .catch(() => setCategories([]))

    api<{ items: PageDto[] } | PageDto[]>('/api/admin/pages')
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.items ?? []
        setPages(items)
      })
      .catch(() => setPages([]))
  }, [])

  useEffect(() => {
    reloadTargetData()
  }, [reloadTargetData])

  // Tự động tải lại danh mục & trang tĩnh mỗi khi mở Drawer để bắt kịp dữ liệu vừa tạo
  useEffect(() => {
    if (itemDrawerOpen) {
      reloadTargetData()
    }
  }, [itemDrawerOpen, reloadTargetData])

  // Kiểm tra trạng thái đã thay đổi thứ tự cục bộ (isDirty)
  const isDirty = useMemo(() => {
    const s = JSON.stringify(flattenMenuTreeForReorder(serverTree))
    const c = JSON.stringify(flattenMenuTreeForReorder(treeData))
    return s !== c
  }, [serverTree, treeData])

  // Cảnh báo người dùng khi rời trang có thay đổi chưa lưu
  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Menu hiện tại đang được chọn
  const currentMenu = useMemo(
    () => menus.find((m) => m.id === selectedMenuId),
    [menus, selectedMenuId],
  )

  // Danh sách ID con cháu của mục đang sửa
  const editingDescendantIds = useMemo(() => {
    if (!editingItem) return new Set<string>()
    return findMenuItemDescendantIds(treeData, editingItem.id)
  }, [treeData, editingItem])

  // Tạo cây dữ liệu cho TreeSelect chọn mục cha
  const parentTreeData = useMemo(() => {
    type MenuTreeNode = {
      value: string
      title: string
      disabled: boolean
      children?: MenuTreeNode[]
    }

    function mapNode(node: MenuItemTreeDto): MenuTreeNode {
      const isSelfOrDescendant = editingItem ? node.id === editingItem.id || editingDescendantIds.has(node.id) : false
      // Không cho phép chọn node đã ở cấp 3 làm cha (vì con sẽ thành cấp 4)
      const isAlreadyLevel3 = node.depth >= 3
      return {
        value: node.id,
        title: node.label,
        disabled: isSelfOrDescendant || isAlreadyLevel3,
        children: node.children?.length ? node.children.map(mapNode) : undefined,
      }
    }
    return [
      { value: 'root', title: 'Không có (cấp 1)', disabled: false },
      ...treeData.map(mapNode),
    ]
  }, [treeData, editingItem, editingDescendantIds])

  // Tạo options phẳng cho chọn chuyên mục
  const flatCategoryOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    function walk(cats: CategoryTreeDto[], prefix = '') {
      for (const c of cats) {
        opts.push({ value: c.id, label: prefix ? `${prefix} / ${c.name}` : c.name })
        if (c.children?.length) walk(c.children, prefix ? `${prefix} / ${c.name}` : c.name)
      }
    }
    walk(categories)
    return opts
  }, [categories])

  // Thao tác di chuyển mục trên cây (Lên / Xuống / Vào trong / Ra ngoài)
  function handleMove(nodeId: string, direction: 'up' | 'down' | 'in' | 'out') {
    const res = moveMenuNode(treeData, nodeId, direction)
    if (!res.success) {
      message.warning(res.error || 'Không thể di chuyển mục.')
      return
    }
    setTreeData(res.newTree)
  }

  // Hủy thay đổi thứ tự
  function handleCancelReorder() {
    setTreeData(JSON.parse(JSON.stringify(serverTree)))
    setTreeSaveError('')
  }

  // Lưu thứ tự cây mới lên API
  async function handleSaveReorder() {
    if (!selectedMenuId) return
    setSavingTree(true)
    setTreeSaveError('')
    const flattened = flattenMenuTreeForReorder(treeData)

    try {
      const updated = await api<MenuItemTreeDto[]>(`/api/admin/menus/${selectedMenuId}/tree`, {
        method: 'PUT',
        json: { items: flattened },
      })
      const withMeta = recalculateTreeMetadata(updated)
      setServerTree(withMeta)
      setTreeData(withMeta)
      message.success('Cập nhật và sắp xếp cấu trúc cây Menu thành công.')
      reloadMenus()
    } catch (err) {
      setTreeSaveError(menuErrorMessage(err))
    } finally {
      setSavingTree(false)
    }
  }

  // Mở drawer tạo mục mới
  function openCreateItem(parentId?: string | null) {
    setEditingItem(null)
    setItemDrawerError('')
    itemForm.resetFields()
    itemForm.setFieldsValue({
      kind: 'category',
      parentId: parentId ?? 'root',
      isVisible: true,
    })
    setItemDrawerOpen(true)
  }

  // Mở drawer sửa mục
  function openEditItem(item: MenuItemTreeDto) {
    setEditingItem(item)
    setItemDrawerError('')
    itemForm.resetFields()
    itemForm.setFieldsValue({
      label: item.label,
      kind: item.kind,
      parentId: item.parentId ?? 'root',
      categoryId: item.categoryId ?? undefined,
      pageId: item.pageId ?? undefined,
      externalUrl: item.externalUrl ?? undefined,
      isVisible: item.isVisible,
    })
    setItemDrawerOpen(true)
  }

  // Lưu mục menu (Tạo mới hoặc Cập nhật)
  async function onSaveItem(values: MenuItemFormValues) {
    if (!selectedMenuId || itemSaving) return
    setItemDrawerError('')
    setItemSaving(true)

    const parentIdVal = values.parentId === 'root' || !values.parentId ? null : values.parentId
    const payload = {
      label: values.label.trim(),
      kind: values.kind,
      parentId: parentIdVal,
      categoryId: values.kind === 'category' ? values.categoryId : null,
      pageId: values.kind === 'page' ? values.pageId : null,
      externalUrl: values.kind === 'external' ? values.externalUrl?.trim() : null,
      isVisible: values.isVisible ?? true,
    }

    try {
      if (editingItem) {
        await api(`/api/admin/menu-items/${editingItem.id}`, {
          method: 'PUT',
          json: { ...payload, sortOrder: editingItem.sortOrder },
        })
        message.success(`Đã cập nhật mục "${payload.label}".`)
      } else {
        await api(`/api/admin/menus/${selectedMenuId}/items`, {
          method: 'POST',
          json: payload,
        })
        message.success(`Đã thêm mục "${payload.label}".`)
      }
      setItemDrawerOpen(false)
      itemForm.resetFields()
      reloadItems()
      reloadMenus()
    } catch (err) {
      itemForm.setFields(fieldErrors(err))
      setItemDrawerError(fieldErrors(err).length ? '' : menuErrorMessage(err))
    } finally {
      setItemSaving(false)
    }
  }

  // Bật/tắt hiển thị nhanh một mục
  async function toggleItemVisibility(item: MenuItemTreeDto, checked: boolean) {
    try {
      await api(`/api/admin/menu-items/${item.id}/visibility`, {
        method: 'PATCH',
        json: { isVisible: checked },
      })
      message.success(`Đã ${checked ? 'hiển thị' : 'ẩn'} mục "${item.label}".`)
      reloadItems()
    } catch (err) {
      message.error(menuErrorMessage(err))
      reloadItems()
    }
  }

  // Xóa mục menu
  async function onDeleteItem(item: MenuItemTreeDto) {
    try {
      await api(`/api/admin/menu-items/${item.id}`, { method: 'DELETE' })
      message.success(`Đã xóa mục "${item.label}".`)
      reloadItems()
      reloadMenus()
    } catch (err) {
      message.error(menuErrorMessage(err))
    }
  }

  // Modal Tạo/Sửa Menu bên trái
  function openCreateMenu() {
    setEditingMenu(null)
    setMenuModalError('')
    menuForm.resetFields()
    setMenuModalOpen(true)
  }

  function openEditMenu(m: MenuDto) {
    setEditingMenu(m)
    setMenuModalError('')
    menuForm.setFieldsValue({ name: m.name, code: m.code })
    setMenuModalOpen(true)
  }

  async function onSaveMenu(values: MenuFormValues) {
    if (menuModalSaving) return
    setMenuModalError('')
    setMenuModalSaving(true)

    try {
      if (editingMenu) {
        await api<MenuDto>(`/api/admin/menus/${editingMenu.id}`, {
          method: 'PUT',
          json: { name: values.name.trim() },
        })
        message.success(`Đã cập nhật menu "${values.name.trim()}".`)
      } else {
        const created = await api<MenuDto>('/api/admin/menus', {
          method: 'POST',
          json: { name: values.name.trim(), code: values.code.trim().toLowerCase() },
        })
        message.success(`Đã tạo menu "${values.name.trim()}".`)
        list.update({ menu: created.id })
      }
      setMenuModalOpen(false)
      menuForm.resetFields()
      reloadMenus()
    } catch (err) {
      setMenuModalError(menuErrorMessage(err))
    } finally {
      setMenuModalSaving(false)
    }
  }

  async function onDeleteMenu(m: MenuDto) {
    try {
      await api(`/api/admin/menus/${m.id}`, { method: 'DELETE' })
      message.success(`Đã xóa menu "${m.name}".`)
      if (selectedMenuId === m.id) {
        list.update({ menu: null })
      }
      reloadMenus()
    } catch (err) {
      message.error(menuErrorMessage(err))
    }
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 20 }}>Menu website</h2>

      <Row gutter={16}>
        {/* Cột trái: Danh sách Menu */}
        <Col xs={24} md={8} lg={7} style={{ marginBottom: 16 }}>
          <Card
            title="Menu"
            extra={
              <Button type="primary" size="small" icon={<Plus size={14} />} onClick={openCreateMenu} title="Thêm menu mới" aria-label="Thêm menu mới" />
            }
          >
            {menusError && (
              <Alert
                type="error"
                showIcon
                message={menusError}
                style={{ marginBottom: 12 }}
                action={<Button size="small" onClick={reloadMenus}>Thử lại</Button>}
              />
            )}

            {menusLoading && <Skeleton active paragraph={{ rows: 4 }} />}

            {!menusLoading && menus.length === 0 && !menusError && (
              <Empty description="Chưa có menu nào." image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="primary" size="small" onClick={openCreateMenu}>
                  Tạo menu đầu tiên
                </Button>
              </Empty>
            )}

            {!menusLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {menus.map((m) => {
                  const isSelected = m.id === selectedMenuId
                  return (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => list.update({ menu: m.id })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          list.update({ menu: m.id })
                        }
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-control)',
                        border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        backgroundColor: isSelected ? '#eef3ff' : 'var(--color-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: isSelected ? 'var(--color-primary)' : 'inherit' }}>
                          {m.name}
                        </div>
                        <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>
                          Mã: {m.code} · {m.itemCount} mục
                        </div>
                      </div>

                      <Space size={2} onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="text"
                          size="small"
                          icon={<PencilSimple size={14} />}
                          aria-label={`Sửa tên menu ${m.name}`}
                          title={`Sửa tên menu "${m.name}"`}
                          onClick={() => openEditMenu(m)}
                        />
                        <Popconfirm
                          title={`Xóa menu "${m.name}"?`}
                          description="Toàn bộ các mục trong menu này cũng sẽ bị xóa."
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => onDeleteMenu(m)}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash size={14} />}
                            aria-label={`Xóa menu ${m.name}`}
                          />
                        </Popconfirm>
                      </Space>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Cột phải: Cây mục của Menu đang chọn */}
        <Col xs={24} md={16} lg={17}>
          <Card
            title={
              <Space size={8}>
                <span>{currentMenu?.name || 'Chi tiết menu'}</span>
                {currentMenu?.code && <Tag>{currentMenu.code}</Tag>}
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<Plus size={16} />}
                disabled={!selectedMenuId}
                onClick={() => openCreateItem(null)}
              >
                Thêm mục
              </Button>
            }
          >
            {/* Alert banner khi đã thay đổi thứ tự nhưng chưa lưu */}
            {isDirty && (
              <Alert
                type="warning"
                showIcon
                icon={<Warning size={18} />}
                style={{ marginBottom: 16 }}
                message={
                  <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                    <span>Đã đổi thứ tự các mục, chưa lưu.</span>
                    <Space size={8}>
                      <Button size="small" onClick={handleCancelReorder} disabled={savingTree}>
                        Hủy thay đổi
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<FloppyDisk size={14} />}
                        loading={savingTree}
                        onClick={handleSaveReorder}
                      >
                        Lưu thứ tự
                      </Button>
                    </Space>
                  </Flex>
                }
              />
            )}

            {/* Alert lỗi khi lưu thứ tự thất bại */}
            {treeSaveError && (
              <Alert
                type="error"
                showIcon
                title="Chưa lưu được"
                description={treeSaveError}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Dòng hướng dẫn kỹ thuật */}
            <div className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={16} aria-hidden />
              <span>Kéo ⋮⋮ để đổi thứ tự hoặc cấp, hoặc dùng nút Di chuyển (dùng được bằng bàn phím). Tối đa 3 cấp.</span>
            </div>

            {itemsError && (
              <Alert
                type="error"
                showIcon
                title="Không tải được cây menu"
                description={itemsError}
                style={{ marginBottom: 16 }}
                action={<Button size="small" onClick={reloadItems}>Thử lại</Button>}
              />
            )}

            {itemsLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Table<MenuItemTreeDto>
                rowKey="id"
                dataSource={treeData}
                pagination={false}
                scroll={{ x: 'max-content' }}
                expandable={{
                  expandedRowKeys,
                  onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
                }}
                rowClassName={(r) => {
                  const isBroken = (r.kind === 'page' && !r.pageSlug) || (r.kind === 'category' && !r.categorySlug)
                  return isBroken ? 'menu-row--broken' : ''
                }}
                locale={{
                  emptyText: itemsError ? ' ' : (
                    <Empty
                      description="Menu này chưa có mục nào."
                      image={<ListBullets size={48} style={{ opacity: 0.3 }} />}
                    >
                      <Button type="primary" onClick={() => openCreateItem(null)}>
                        Thêm mục đầu tiên
                      </Button>
                    </Empty>
                  ),
                }}
                columns={[
                  {
                    title: 'Tên mục và đích',
                    key: 'label',
                    render: (_, r) => {
                      const isBroken = (r.kind === 'page' && !r.pageSlug) || (r.kind === 'category' && !r.categorySlug)
                      const displayUrl = r.resolvedUrl || r.externalUrl || (r.kind === 'external' ? r.externalUrl : '')

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="muted" style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                            <DotsSixVertical size={16} />
                          </span>
                          <div>
                            <Space size={6}>
                              <strong>{r.label}</strong>
                              {!r.isVisible && <Tag>Đang ẩn</Tag>}
                            </Space>
                            {isBroken ? (
                              <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Warning size={13} />
                                <span>Trang đích đã bị xóa, chọn trang khác</span>
                              </div>
                            ) : (
                              <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>
                                {displayUrl}
                                {r.kind === 'external' && <ArrowSquareOut size={12} style={{ marginInlineStart: 4 }} />}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    },
                  },
                  {
                    title: 'Loại',
                    dataIndex: 'kind',
                    width: 130,
                    render: (k: MenuItemKind) => {
                      if (k === 'page') return <Tag color="cyan">Trang</Tag>
                      if (k === 'category') return <Tag color="green">Chuyên mục</Tag>
                      return <Tag color="orange">Liên kết ngoài</Tag>
                    },
                  },
                  {
                    title: 'Hiển thị',
                    dataIndex: 'isVisible',
                    width: 100,
                    align: 'center',
                    render: (checked: boolean, r) => (
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Hiển thị mục ${r.label}`}
                        checked={checked}
                        onChange={(e) => toggleItemVisibility(r, e.target.checked)}
                        style={{ cursor: 'pointer', width: 36, height: 20 }}
                      />
                    ),
                  },
                  {
                    title: '',
                    key: 'actions',
                    width: 160,
                    align: 'right',
                    render: (_, r) => {
                      const isAtLevel3 = r.depth >= 3
                      const childrenCount = countDescendants(r)

                      const moveMenuItems = [
                        { key: 'up', label: 'Lên trên', icon: <ArrowUp size={14} />, onClick: () => handleMove(r.id, 'up') },
                        { key: 'down', label: 'Xuống dưới', icon: <ArrowDown size={14} />, onClick: () => handleMove(r.id, 'down') },
                        { key: 'in', label: 'Vào trong (làm mục con của mục trên)', onClick: () => handleMove(r.id, 'in') },
                        { key: 'out', label: 'Ra ngoài một cấp', onClick: () => handleMove(r.id, 'out') },
                      ]

                      return (
                        <Space size={4}>
                          <Dropdown menu={{ items: moveMenuItems }} trigger={['click']}>
                            <Button
                              type="text"
                              icon={<ArrowsDownUp size={16} />}
                              title="Di chuyển mục"
                              aria-label={`Di chuyển mục ${r.label}`}
                            />
                          </Dropdown>

                          {isAtLevel3 ? (
                            <Button
                              type="text"
                              icon={<Plus size={16} />}
                              disabled
                              title="Đã ở cấp 3, không thêm mục con được"
                              aria-label="Đã ở cấp 3, không thêm mục con được"
                            />
                          ) : (
                            <Button
                              type="text"
                              icon={<Plus size={16} />}
                              title="Thêm mục con"
                              aria-label={`Thêm con cho ${r.label}`}
                              onClick={() => openCreateItem(r.id)}
                            />
                          )}

                          <Button
                            type="text"
                            icon={<PencilSimple size={16} />}
                            title="Sửa mục"
                            aria-label={`Sửa mục ${r.label}`}
                            onClick={() => openEditItem(r)}
                          />

                          <Popconfirm
                            title={`Xóa mục "${r.label}"?`}
                            description={
                              childrenCount > 0
                                ? `${childrenCount} mục con bên trong cũng bị xóa khỏi menu. Chuyên mục và bài viết không bị ảnh hưởng.`
                                : 'Mục này sẽ bị xóa khỏi menu.'
                            }
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => onDeleteItem(r)}
                          >
                            <Button
                              type="text"
                              danger
                              icon={<Trash size={16} />}
                              title="Xóa mục"
                              aria-label={`Xóa mục ${r.label}`}
                            />
                          </Popconfirm>
                        </Space>
                      )
                    },
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Drawer Tạo/Sửa Mục Menu */}
      <Drawer
        open={itemDrawerOpen}
        title={editingItem ? `Sửa mục "${editingItem.label}"` : 'Thêm mục menu'}
        size={520}
        onClose={() => {
          setItemDrawerOpen(false)
          itemForm.resetFields()
        }}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => { setItemDrawerOpen(false); itemForm.resetFields() }}>Hủy</Button>
            <Button type="primary" loading={itemSaving} onClick={() => itemForm.submit()}>
              Lưu
            </Button>
          </Flex>
        }
      >
        {itemDrawerError && (
          <Alert
            type="error"
            showIcon
            title="Chưa lưu được"
            description={itemDrawerError}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={itemForm}
          layout="vertical"
          onFinish={onSaveItem}
          requiredMark
          disabled={itemSaving}
          initialValues={{ kind: 'category', parentId: 'root', isVisible: true }}
        >
          <Form.Item
            name="label"
            label="Tên hiển thị"
            rules={[
              { required: true, whitespace: true, message: 'Nhập tên hiển thị.' },
              { max: 100, message: 'Tên không quá 100 ký tự.' },
            ]}
          >
            <Input placeholder="VD: Lịch thi bổ sung" />
          </Form.Item>

          <Form.Item name="kind" label="Loại mục" rules={[{ required: true }]}>
            <Segmented
              options={[
                { value: 'page', label: 'Trang' },
                { value: 'category', label: 'Chuyên mục' },
                { value: 'external', label: 'Liên kết ngoài' },
              ]}
              block
            />
          </Form.Item>

          {itemKind === 'category' && (
            <Form.Item
              name="categoryId"
              label={
                <Space size={8}>
                  <span>Chuyên mục đích</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowsClockwise size={13} />}
                    title="Tải lại danh sách chuyên mục"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      reloadTargetData()
                      message.info('Đang tải lại danh mục...')
                    }}
                    aria-label="Tải lại danh sách chuyên mục"
                  />
                </Space>
              }
              extra={
                flatCategoryOptions.length === 0 ? (
                  <span style={{ color: 'var(--color-warning)' }}>
                    Chưa có chuyên mục nào trong hệ thống. Vui lòng vào{' '}
                    <Link to="/admin/categories" target="_blank" style={{ textDecoration: 'underline' }}>
                      Quản lý chuyên mục
                    </Link>{' '}
                    để tạo chuyên mục trước, sau đó bấm nút tải lại ⟳.
                  </span>
                ) : (
                  'Chỉ hiện chuyên mục chưa bị xóa. Link tự sinh: /categories/<slug>'
                )
              }
              rules={[{ required: true, message: 'Chọn chuyên mục đích.' }]}
            >
              <Select
                placeholder={flatCategoryOptions.length === 0 ? 'Chưa có chuyên mục nào' : 'Chọn chuyên mục'}
                options={flatCategoryOptions}
                showSearch
                optionFilterProp="label"
                allowClear
                notFoundContent={
                  <div style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--color-text-muted)' }}>Chưa có chuyên mục nào trong hệ thống</p>
                    <Link to="/admin/categories" target="_blank">Tạo chuyên mục mới</Link>
                  </div>
                }
              />
            </Form.Item>
          )}

          {itemKind === 'page' && (
            <Form.Item
              name="pageId"
              label="Trang đích"
              extra={
                pages.length === 0 ? (
                  <span style={{ color: 'var(--color-warning)' }}>
                    Chưa có trang tĩnh nào trong hệ thống.
                  </span>
                ) : (
                  'Chỉ hiện trang đã xuất bản. Link tự sinh: /pages/<slug>'
                )
              }
              rules={[{ required: true, message: 'Chọn trang đích.' }]}
            >
              <Select
                placeholder={pages.length === 0 ? 'Chưa có trang tĩnh nào' : 'Chọn trang tĩnh'}
                options={pages.map((p) => ({ value: p.id, label: p.title }))}
                showSearch
                optionFilterProp="label"
                allowClear
                notFoundContent={
                  <div style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Chưa có trang tĩnh nào trong hệ thống</p>
                  </div>
                }
              />
            </Form.Item>
          )}

          {itemKind === 'external' && (
            <Form.Item
              name="externalUrl"
              label="Địa chỉ liên kết"
              extra="Liên kết ngoài mở ở tab mới."
              rules={[
                { required: true, whitespace: true, message: 'Nhập địa chỉ liên kết.' },
                {
                  validator: async (_, val) => {
                    if (!val) return
                    if (!/^https?:\/\/.+/i.test(val.trim())) {
                      throw new Error('Nhập liên kết đầy đủ, bắt đầu bằng https:// hoặc http://')
                    }
                  },
                },
              ]}
            >
              <Input placeholder="https://tuyensinh.uit.edu.vn" />
            </Form.Item>
          )}

          <Form.Item
            name="parentId"
            label="Mục cha"
            extra="Bỏ trống để đặt ở cấp 1. Danh sách không có chính mục này và các mục con của nó."
          >
            <TreeSelect
              treeData={parentTreeData}
              placeholder="Chọn mục cha"
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="isVisible"
            label="Hiển thị trên website"
            valuePropName="checked"
            extra="Tắt để ẩn tạm, không cần xóa mục."
          >
            <input type="checkbox" role="switch" style={{ cursor: 'pointer', width: 36, height: 20 }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Modal Tạo/Sửa Menu */}
      <Modal
        open={menuModalOpen}
        title={editingMenu ? `Sửa menu "${editingMenu.name}"` : 'Tạo menu mới'}
        onCancel={() => {
          setMenuModalOpen(false)
          menuForm.resetFields()
        }}
        onOk={() => menuForm.submit()}
        confirmLoading={menuModalSaving}
        okText="Lưu"
        cancelText="Hủy"
      >
        {menuModalError && <Alert type="error" showIcon message={menuModalError} style={{ marginBottom: 16 }} />}
        <Form form={menuForm} layout="vertical" onFinish={onSaveMenu} requiredMark disabled={menuModalSaving}>
          <Form.Item
            name="name"
            label="Tên menu"
            rules={[
              { required: true, whitespace: true, message: 'Nhập tên menu.' },
              { max: 100, message: 'Tên menu không được quá 100 ký tự.' },
            ]}
          >
            <Input placeholder="VD: Menu chân trang" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Mã định danh (code)"
            extra={editingMenu ? 'Mã menu không thể thay đổi sau khi tạo.' : 'Chỉ dùng chữ thường không dấu, số và gạch ngang (VD: main, footer, quick-links).'}
            rules={[
              { required: true, whitespace: true, message: 'Nhập mã menu.' },
              { pattern: /^[a-z0-9-]+$/, message: 'Mã menu chỉ gồm chữ thường không dấu, số và dấu gạch ngang.' },
            ]}
          >
            <Input placeholder="footer" disabled={Boolean(editingMenu)} autoCapitalize="none" spellCheck={false} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function Menus() {
  return (
    <RequireRole roles={['admin']}>
      <MenusContent />
    </RequireRole>
  )
}
