import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Empty, Flex, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Skeleton, Space, Table, Tag, TreeSelect } from 'antd'
import { FolderSimple, PencilSimple, Plus, Tag as TagIcon, Trash } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import {
  categoryErrorMessage,
  findCategoryDescendantIds,
  flattenCategoryTree,
  generateSlug,
  SLUG_PATTERN,
  tagErrorMessage,
  type CategoryDetailDto,
  type CategoryTreeDto,
  type TagDto,
} from '../../admin/categories'

export const meta = () => noIndex('Chuyên mục và thẻ')

type CategoryFormValues = {
  name: string
  slug?: string
  description?: string
  parentId?: string | null
  sortOrder?: number
  isVisible?: boolean
}

type TagFormValues = {
  name: string
  slug?: string
}

function fieldErrors(err: unknown) {
  if (!(err instanceof ApiError) || !err.errors) return []
  return Object.entries(err.errors).map(([key, errors]) => ({
    name: (key[0].toLowerCase() + key.slice(1)) as keyof CategoryFormValues,
    errors,
  }))
}

function CategoriesContent() {
  const { message } = App.useApp()
  const list = useListParams()
  const activeTab = list.params.get('tab') === 'tags' ? 'tags' : 'categories'
  const searchKeyword = list.params.get('search') ?? ''

  // State cho chuyên mục
  const [categoriesTree, setCategoriesTree] = useState<CategoryTreeDto[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [catReloadKey, setCatReloadKey] = useState(0)
  const reloadCategories = () => setCatReloadKey((k) => k + 1)

  // Drawer sửa/tạo chuyên mục
  const [catForm] = Form.useForm<CategoryFormValues>()
  const [editingCat, setEditingCat] = useState<CategoryDetailDto | null>(null)
  const [catDetailLoading, setCatDetailLoading] = useState(false)
  const [catDrawerError, setCatDrawerError] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  // Safe delete modal cho chuyên mục
  const [deletingCat, setDeletingCat] = useState<CategoryTreeDto | null>(null)
  const [targetCatId, setTargetCatId] = useState<string | null>(null)
  const [safeDeleteLoading, setSafeDeleteLoading] = useState(false)
  const [safeDeleteError, setSafeDeleteError] = useState('')

  // State cho Thẻ (Tags)
  const [tags, setTags] = useState<TagDto[]>([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [tagsError, setTagsError] = useState('')
  const [tagReloadKey, setTagReloadKey] = useState(0)
  const reloadTags = () => setTagReloadKey((k) => k + 1)

  // Modal tạo/sửa thẻ
  const [tagForm] = Form.useForm<TagFormValues>()
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagDto | null>(null)
  const [tagSaving, setTagSaving] = useState(false)
  const [tagModalError, setTagModalError] = useState('')

  // Tải danh sách chuyên mục dạng cây
  useEffect(() => {
    if (activeTab !== 'categories') return
    const ctrl = new AbortController()
    setCategoriesLoading(true)
    setCategoriesError('')

    const endpoint = searchKeyword
      ? `/api/admin/categories?search=${encodeURIComponent(searchKeyword)}`
      : '/api/admin/categories/tree'

    api<CategoryTreeDto[] | CategoryDetailDto[] | { items: unknown[] }>(endpoint, { signal: ctrl.signal })
      .then((res) => {
        const rawList = (Array.isArray(res) ? res : (res as { items?: unknown[] })?.items || []) as (CategoryTreeDto[] | CategoryDetailDto[])
        if (searchKeyword) {
          // Khi tìm kiếm: kết quả trả về dạng phẳng, ta map về cây đơn giản
          const flatItems = rawList as CategoryDetailDto[]
          const mapped: CategoryTreeDto[] = flatItems.map((c) => ({
            id: c.id,
            parentId: c.parentId,
            name: c.name,
            slug: c.slug,
            description: c.description,
            sortOrder: c.sortOrder,
            isVisible: c.isVisible,
            postCount: c.postCount,
            children: [],
          }))
          setCategoriesTree(mapped)
        } else {
          setCategoriesTree(rawList as CategoryTreeDto[])
        }
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setCategoriesTree([])
        setCategoriesError(categoryErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setCategoriesLoading(false))

    return () => ctrl.abort()
  }, [activeTab, searchKeyword, catReloadKey])

  // Tải chi tiết chuyên mục khi mở form sửa
  useEffect(() => {
    setCatDrawerError('')
    if (list.action !== 'edit' || !list.id || activeTab !== 'categories') {
      setEditingCat(null)
      return
    }
    const ctrl = new AbortController()
    setCatDetailLoading(true)
    api<CategoryDetailDto>(`/api/admin/categories/${list.id}`, { signal: ctrl.signal })
      .then((cat) => {
        setEditingCat(cat)
        catForm.setFieldsValue({
          name: cat.name,
          slug: cat.slug,
          description: cat.description ?? undefined,
          parentId: cat.parentId,
          sortOrder: cat.sortOrder,
          isVisible: cat.isVisible,
        })
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setCatDrawerError(categoryErrorMessage(err))
        if (err instanceof ApiError && err.status === 404) reloadCategories()
      })
      .finally(() => !ctrl.signal.aborted && setCatDetailLoading(false))

    return () => ctrl.abort()
  }, [list.action, list.id, activeTab, catForm])

  // Tải danh sách Thẻ
  useEffect(() => {
    if (activeTab !== 'tags') return
    const ctrl = new AbortController()
    setTagsLoading(true)
    setTagsError('')

    const url = searchKeyword ? `/api/admin/tags?search=${encodeURIComponent(searchKeyword)}` : '/api/admin/tags'
    api<TagDto[] | { items: TagDto[] }>(url, { signal: ctrl.signal })
      .then((res) => setTags(Array.isArray(res) ? res : res?.items || []))
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setTags([])
        setTagsError(tagErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setTagsLoading(false))

    return () => ctrl.abort()
  }, [activeTab, searchKeyword, tagReloadKey])

  // Danh sách phẳng của chuyên mục (dùng cho TreeSelect và Safe Delete)
  const flatCategories = useMemo(() => flattenCategoryTree(categoriesTree), [categoriesTree])

  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])

  useEffect(() => {
    if (categoriesTree.length > 0) {
      setExpandedRowKeys(flatCategories.map((c) => c.id))
    }
  }, [categoriesTree, flatCategories])

  // ID các node con cháu của chuyên mục đang sửa hoặc đang xóa
  const editingDescendantIds = useMemo(() => {
    if (!editingCat) return new Set<string>()
    return findCategoryDescendantIds(categoriesTree, editingCat.id)
  }, [categoriesTree, editingCat])

  const deletingDescendantIds = useMemo(() => {
    if (!deletingCat) return new Set<string>()
    return findCategoryDescendantIds(categoriesTree, deletingCat.id)
  }, [categoriesTree, deletingCat])

  // Tạo cây options cho TreeSelect chọn mục cha
  const parentTreeData = useMemo(() => {
    type CategoryTreeNode = {
      value: string
      title: string
      disabled: boolean
      children?: CategoryTreeNode[]
    }

    function mapNode(node: CategoryTreeDto): CategoryTreeNode {
      const isSelfOrDescendant = editingCat ? node.id === editingCat.id || editingDescendantIds.has(node.id) : false
      return {
        value: node.id,
        title: node.name,
        disabled: isSelfOrDescendant,
        children: node.children?.length ? node.children.map(mapNode) : undefined,
      }
    }
    return [
      { value: 'root', title: 'Không có (cấp cao nhất)', disabled: false },
      ...categoriesTree.map(mapNode),
    ]
  }, [categoriesTree, editingCat, editingDescendantIds])

  // Danh sách chuyên mục đích hợp lệ để chuyển bài khi xóa
  const validTargetCategories = useMemo(() => {
    if (!deletingCat) return []
    return flatCategories.filter((c) => c.id !== deletingCat.id && !deletingDescendantIds.has(c.id))
  }, [flatCategories, deletingCat, deletingDescendantIds])

  // Lưu chuyên mục (tạo hoặc sửa)
  async function onSaveCategory(values: CategoryFormValues) {
    if (catSaving) return
    setCatDrawerError('')
    setCatSaving(true)

    const finalSlug = values.slug?.trim() || generateSlug(values.name)
    const payload = {
      name: values.name.trim(),
      slug: finalSlug,
      description: values.description?.trim() || null,
      parentId: values.parentId === 'root' || !values.parentId ? null : values.parentId,
      sortOrder: values.sortOrder ?? 0,
      isVisible: values.isVisible ?? true,
    }

    try {
      if (editingCat) {
        await api<CategoryDetailDto>(`/api/admin/categories/${editingCat.id}`, {
          method: 'PUT',
          json: payload,
        })
        message.success(`Đã cập nhật chuyên mục "${payload.name}".`)
      } else {
        await api<CategoryDetailDto>('/api/admin/categories', {
          method: 'POST',
          json: payload,
        })
        message.success(`Đã tạo chuyên mục "${payload.name}".`)
      }
      list.closeDrawer()
      catForm.resetFields()
      reloadCategories()
    } catch (err) {
      catForm.setFields(fieldErrors(err))
      setCatDrawerError(fieldErrors(err).length ? '' : categoryErrorMessage(err))
    } finally {
      setCatSaving(false)
    }
  }

  // Bật/tắt nhanh hiển thị chuyên mục
  async function toggleCategoryVisibility(row: CategoryTreeDto, checked: boolean) {
    try {
      await api<CategoryDetailDto>(`/api/admin/categories/${row.id}`, {
        method: 'PUT',
        json: {
          name: row.name,
          slug: row.slug,
          description: row.description,
          parentId: row.parentId,
          sortOrder: row.sortOrder,
          isVisible: checked,
        },
      })
      message.success(`Đã ${checked ? 'bật' : 'tắt'} hiển thị chuyên mục "${row.name}".`)
      reloadCategories()
    } catch (err) {
      message.error(categoryErrorMessage(err))
      reloadCategories()
    }
  }

  // Mở modal xóa chuyên mục
  function onRequestDeleteCategory(row: CategoryTreeDto) {
    const hasChildren = row.children && row.children.length > 0
    const hasPosts = row.postCount > 0
    if (hasChildren || hasPosts) {
      setDeletingCat(row)
      setTargetCatId(null)
      setSafeDeleteError('')
    } else {
      // Chuyên mục rỗng: xóa trực tiếp với Popconfirm (xử lý ở render)
    }
  }

  // Xác nhận xóa an toàn chuyên mục có bài hoặc có con
  async function onConfirmSafeDelete() {
    if (!deletingCat) return
    if (!targetCatId) {
      setSafeDeleteError('Vui lòng chọn chuyên mục đích để chuyển giao.')
      return
    }

    setSafeDeleteLoading(true)
    setSafeDeleteError('')
    try {
      await api(`/api/admin/categories/${deletingCat.id}?targetCategoryId=${targetCatId}`, {
        method: 'DELETE',
      })
      message.success(`Đã xóa chuyên mục "${deletingCat.name}" và chuyển giao dữ liệu thành công.`)
      setDeletingCat(null)
      setTargetCatId(null)
      reloadCategories()
    } catch (err) {
      setSafeDeleteError(categoryErrorMessage(err))
    } finally {
      setSafeDeleteLoading(false)
    }
  }

  // Xóa trực tiếp chuyên mục rỗng
  async function onDeleteEmptyCategory(row: CategoryTreeDto) {
    try {
      await api(`/api/admin/categories/${row.id}`, { method: 'DELETE' })
      message.success(`Đã xóa chuyên mục "${row.name}".`)
      reloadCategories()
    } catch (err) {
      message.error(categoryErrorMessage(err))
      reloadCategories()
    }
  }

  // Mở modal tạo/sửa thẻ
  function openCreateTag() {
    setEditingTag(null)
    setTagModalError('')
    tagForm.resetFields()
    setTagModalOpen(true)
  }

  function openEditTag(t: TagDto) {
    setEditingTag(t)
    setTagModalError('')
    tagForm.setFieldsValue({ name: t.name, slug: t.slug })
    setTagModalOpen(true)
  }

  // Lưu thẻ
  async function onSaveTag(values: TagFormValues) {
    if (tagSaving) return
    setTagModalError('')
    setTagSaving(true)

    const finalSlug = values.slug?.trim() || generateSlug(values.name)
    const payload = { name: values.name.trim(), slug: finalSlug }

    try {
      if (editingTag) {
        await api<TagDto>(`/api/admin/tags/${editingTag.id}`, {
          method: 'PUT',
          json: payload,
        })
        message.success(`Đã cập nhật thẻ "${payload.name}".`)
      } else {
        await api<TagDto>('/api/admin/tags', {
          method: 'POST',
          json: payload,
        })
        message.success(`Đã tạo thẻ "${payload.name}".`)
      }
      setTagModalOpen(false)
      tagForm.resetFields()
      reloadTags()
    } catch (err) {
      setTagModalError(tagErrorMessage(err))
    } finally {
      setTagSaving(false)
    }
  }

  // Xóa thẻ
  async function onDeleteTag(t: TagDto) {
    try {
      await api(`/api/admin/tags/${t.id}`, { method: 'DELETE' })
      message.success(`Đã xóa thẻ "${t.name}".`)
      reloadTags()
    } catch (err) {
      message.error(tagErrorMessage(err))
    }
  }

  // Chuyển đổi tab
  function onTabChange(val: string) {
    list.update({ tab: val === 'tags' ? 'tags' : null, search: null })
  }

  return (
    <Card
      title={
        <Segmented
          value={activeTab}
          onChange={onTabChange}
          options={[
            { value: 'categories', label: 'Chuyên mục', icon: <FolderSimple size={16} /> },
            { value: 'tags', label: 'Thẻ', icon: <TagIcon size={16} /> },
          ]}
        />
      }
      extra={
        <Space wrap>
          <Input.Search
            key={searchKeyword}
            allowClear
            defaultValue={searchKeyword}
            placeholder={activeTab === 'categories' ? 'Tìm theo tên chuyên mục' : 'Tìm thẻ'}
            onSearch={(v) => list.update({ search: v.trim() || null })}
            style={{ width: 260 }}
          />
          {activeTab === 'categories' ? (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                catForm.resetFields()
                catForm.setFieldsValue({ sortOrder: 0, isVisible: true, parentId: 'root' })
                list.openCreate()
              }}
            >
              Thêm chuyên mục
            </Button>
          ) : (
            <Button type="primary" icon={<Plus size={16} />} onClick={openCreateTag}>
              Thêm thẻ
            </Button>
          )}
        </Space>
      }
    >
      {activeTab === 'categories' && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Chuyên mục cha bị ẩn thì chuyên mục con cũng không hiện ở trang công khai. Xóa chuyên mục đang có bài hoặc có con phải chọn nơi nhận."
          />

          {categoriesError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              title="Không tải được danh sách chuyên mục"
              description={categoriesError}
              action={<Button size="small" onClick={reloadCategories}>Thử lại</Button>}
            />
          )}

          <Table<CategoryTreeDto>
            rowKey="id"
            loading={categoriesLoading}
            dataSource={categoriesTree}
            pagination={false}
            scroll={{ x: 'max-content' }}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
            }}
            locale={{
              emptyText: categoriesError ? ' ' : (
                <Empty
                  description={searchKeyword ? 'Không có chuyên mục khớp bộ lọc.' : 'Chưa có chuyên mục nào.'}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  {searchKeyword ? (
                    <Button onClick={() => list.update({ search: null })}>Xóa tìm kiếm</Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => {
                        catForm.resetFields()
                        catForm.setFieldsValue({ sortOrder: 0, isVisible: true, parentId: 'root' })
                        list.openCreate()
                      }}
                    >
                      Thêm chuyên mục đầu tiên
                    </Button>
                  )}
                </Empty>
              ),
            }}
            columns={[
              {
                title: 'Tên chuyên mục',
                key: 'name',
                render: (_, r) => {
                  const isParentHidden = Boolean(r.parentId && flatCategories.find((c) => c.id === r.parentId)?.isVisible === false)
                  return (
                    <div>
                      <Space size={6}>
                        <strong>{r.name}</strong>
                        {!r.isVisible && <Tag>Đang ẩn</Tag>}
                      </Space>
                      {isParentHidden && (
                        <div className="muted" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
                          Không hiện công khai vì chuyên mục cha đang ẩn
                        </div>
                      )}
                    </div>
                  )
                },
              },
              {
                title: 'Đường dẫn',
                dataIndex: 'slug',
                render: (slug: string) => <span className="muted">/categories/{slug}</span>,
              },
              {
                title: 'Số bài',
                dataIndex: 'postCount',
                width: 90,
                align: 'center',
              },
              {
                title: 'Thứ tự',
                dataIndex: 'sortOrder',
                width: 80,
                align: 'center',
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
                    aria-label={`Hiển thị chuyên mục ${r.name}`}
                    checked={checked}
                    onChange={(e) => toggleCategoryVisibility(r, e.target.checked)}
                    style={{ cursor: 'pointer', width: 36, height: 20 }}
                  />
                ),
              },
              {
                title: '',
                key: 'actions',
                width: 120,
                align: 'right',
                render: (_, r) => {
                  const hasChildren = r.children && r.children.length > 0
                  const hasPosts = r.postCount > 0
                  const needsSafeDelete = hasChildren || hasPosts

                  return (
                    <Space size={4}>
                      <Button
                        type="text"
                        icon={<Plus size={16} />}
                        title="Thêm chuyên mục con"
                        aria-label={`Thêm con cho ${r.name}`}
                        onClick={() => {
                          catForm.resetFields()
                          catForm.setFieldsValue({ parentId: r.id, sortOrder: 0, isVisible: true })
                          list.openCreate()
                        }}
                      />
                      <Button
                        type="text"
                        icon={<PencilSimple size={16} />}
                        title="Sửa"
                        aria-label={`Sửa ${r.name}`}
                        onClick={() => list.openEdit(r.id)}
                      />
                      {needsSafeDelete ? (
                        <Button
                          type="text"
                          danger
                          icon={<Trash size={16} />}
                          title="Xóa chuyên mục (chuyển giao dữ liệu)"
                          aria-label={`Xóa ${r.name}`}
                          onClick={() => onRequestDeleteCategory(r)}
                        />
                      ) : (
                        <Popconfirm
                          title={`Xóa chuyên mục "${r.name}"?`}
                          description="Chuyên mục chưa có bài viết hay chuyên mục con nào."
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => onDeleteEmptyCategory(r)}
                        >
                          <Button
                            type="text"
                            danger
                            icon={<Trash size={16} />}
                            aria-label={`Xóa ${r.name}`}
                          />
                        </Popconfirm>
                      )}
                    </Space>
                  )
                },
              },
            ]}
          />
        </>
      )}

      {activeTab === 'tags' && (
        <>
          <div className="muted" style={{ marginBottom: 16 }}>
            {tags.length} thẻ, sắp theo tên
          </div>

          {tagsError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              title="Không tải được danh sách thẻ"
              description={tagsError}
              action={<Button size="small" onClick={reloadTags}>Thử lại</Button>}
            />
          )}

          <Table<TagDto>
            rowKey="id"
            loading={tagsLoading}
            dataSource={tags}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: tagsError ? ' ' : (
                <Empty
                  description={searchKeyword ? 'Không tìm thấy thẻ.' : 'Chưa có thẻ nào.'}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  {!searchKeyword && (
                    <Button type="primary" onClick={openCreateTag}>
                      Thêm thẻ đầu tiên
                    </Button>
                  )}
                </Empty>
              ),
            }}
            columns={[
              {
                title: 'Tên thẻ',
                key: 'name',
                render: (_, r) => <Tag color="blue">{r.name}</Tag>,
              },
              {
                title: 'Đường dẫn',
                dataIndex: 'slug',
                render: (slug: string) => <span className="muted">/tags/{slug}</span>,
              },
              {
                title: 'Số bài',
                dataIndex: 'postCount',
                width: 100,
                align: 'center',
              },
              {
                title: '',
                key: 'actions',
                width: 90,
                align: 'right',
                render: (_, r) => (
                  <Space size={4}>
                    <Button
                      type="text"
                      icon={<PencilSimple size={16} />}
                      title="Sửa thẻ"
                      aria-label={`Sửa thẻ ${r.name}`}
                      onClick={() => openEditTag(r)}
                    />
                    <Popconfirm
                      title={`Xóa thẻ "${r.name}"?`}
                      description={`Thẻ bị gỡ khỏi ${r.postCount} bài viết. Bài viết không bị xóa.`}
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => onDeleteTag(r)}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<Trash size={16} />}
                        aria-label={`Xóa thẻ ${r.name}`}
                      />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}

      {/* Drawer Tạo/Sửa chuyên mục */}
      <Drawer
        open={Boolean(list.action && activeTab === 'categories')}
        title={list.action === 'edit' ? `Sửa chuyên mục "${editingCat?.name ?? ''}"` : 'Tạo chuyên mục'}
        size={520}
        onClose={() => {
          list.closeDrawer()
          catForm.resetFields()
        }}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => { list.closeDrawer(); catForm.resetFields() }}>Hủy</Button>
            <Button
              type="primary"
              loading={catSaving}
              disabled={catDetailLoading || (list.action === 'edit' && !editingCat)}
              onClick={() => catForm.submit()}
            >
              Lưu
            </Button>
          </Flex>
        }
      >
        {catDrawerError && <Alert type="error" showIcon title={catDrawerError} style={{ marginBottom: 16 }} />}
        {catDetailLoading && <Skeleton active />}
        <Form
          form={catForm}
          layout="vertical"
          onFinish={onSaveCategory}
          requiredMark
          disabled={catSaving}
          hidden={catDetailLoading}
          initialValues={{ sortOrder: 0, isVisible: true, parentId: 'root' }}
        >
          <Form.Item
            name="name"
            label="Tên chuyên mục"
            rules={[
              { required: true, whitespace: true, message: 'Nhập tên chuyên mục.' },
              { max: 100, message: 'Tên chuyên mục không quá 100 ký tự.' },
            ]}
          >
            <Input
              maxLength={100}
              placeholder="VD: Thông báo học vụ"
              onChange={(e) => {
                if (list.action === 'create' && !catForm.isFieldTouched('slug')) {
                  catForm.setFieldValue('slug', generateSlug(e.target.value))
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Đường dẫn (slug)"
            extra="Đường dẫn chỉ gồm chữ thường không dấu, chữ số và dấu gạch ngang. Ví dụ: thong-bao-hoc-vu. Bỏ trống để tự tạo từ tên. Đổi đường dẫn làm link cũ không còn dùng được."
            rules={[
              {
                validator: async (_, val) => {
                  if (!val || !val.trim()) return
                  if (!SLUG_PATTERN.test(val.trim())) {
                    throw new Error('Đường dẫn chỉ gồm chữ thường không dấu, chữ số và dấu gạch ngang (VD: thong-bao-hoc-vu).')
                  }
                },
              },
            ]}
          >
            <Input placeholder="thong-bao-hoc-vu" autoCapitalize="none" spellCheck={false} />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea maxLength={500} rows={3} placeholder="Mô tả ngắn về chuyên mục" />
          </Form.Item>

          <Form.Item
            name="parentId"
            label="Chuyên mục cha"
            extra="Không chọn được chính chuyên mục này và các chuyên mục con của nó."
          >
            <TreeSelect
              treeData={parentTreeData}
              placeholder="Chọn chuyên mục cha"
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>

          <Form.Item name="sortOrder" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="isVisible"
            label="Hiển thị trên website"
            valuePropName="checked"
            extra="Ẩn thì chuyên mục con cũng không hiện công khai."
          >
            <input type="checkbox" role="switch" style={{ cursor: 'pointer', width: 36, height: 20 }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Modal Xóa an toàn chuyên mục (Chuyển bài viết & con) */}
      <Modal
        open={Boolean(deletingCat)}
        title={`Xóa chuyên mục "${deletingCat?.name}"?`}
        onCancel={() => {
          setDeletingCat(null)
          setTargetCatId(null)
          setSafeDeleteError('')
        }}
        footer={[
          <Button key="cancel" onClick={() => { setDeletingCat(null); setTargetCatId(null) }}>Hủy</Button>,
          <Button key="delete" type="primary" danger disabled={!targetCatId} loading={safeDeleteLoading} onClick={onConfirmSafeDelete}>
            Chuyển và xóa
          </Button>,
        ]}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message={`Chuyên mục đang có ${deletingCat?.postCount ?? 0} bài viết và ${deletingCat?.children?.length ?? 0} chuyên mục con. Chọn chuyên mục nhận lại trước khi xóa. Bài viết và chuyên mục con được chuyển sang trong cùng một lần xử lý.`}
          />

          {safeDeleteError && <Alert type="error" showIcon message={safeDeleteError} />}

          <div>
            <label htmlFor="target-category-select" style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>
              * Chuyển bài viết và chuyên mục con sang:
            </label>
            <select
              id="target-category-select"
              aria-label="Chuyển bài viết và chuyên mục con sang"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-control)',
                borderColor: safeDeleteError ? 'var(--color-danger)' : 'var(--color-border)',
              }}
              value={targetCatId ?? ''}
              onChange={(e) => {
                setTargetCatId(e.target.value || null)
                setSafeDeleteError('')
              }}
            >
              <option value="">-- Chọn chuyên mục đích --</option>
              {validTargetCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 8 }}>
              Bài có chuyên mục chính là "{deletingCat?.name}" sẽ đổi chuyên mục chính sang mục được chọn. Đây là xóa mềm: dữ liệu còn trong cơ sở dữ liệu nhưng giao diện không có nút khôi phục.
            </div>
          </div>
        </Space>
      </Modal>

      {/* Modal Tạo/Sửa thẻ */}
      <Modal
        open={tagModalOpen}
        title={editingTag ? `Sửa thẻ "${editingTag.name}"` : 'Thêm thẻ'}
        onCancel={() => {
          setTagModalOpen(false)
          tagForm.resetFields()
        }}
        onOk={() => tagForm.submit()}
        confirmLoading={tagSaving}
        okText="Lưu"
        cancelText="Hủy"
      >
        {tagModalError && <Alert type="error" showIcon message={tagModalError} style={{ marginBottom: 16 }} />}
        <Form
          form={tagForm}
          layout="vertical"
          onFinish={onSaveTag}
          requiredMark
          disabled={tagSaving}
        >
          <Form.Item
            name="name"
            label="Tên thẻ"
            rules={[
              { required: true, whitespace: true, message: 'Nhập tên thẻ.' },
              { max: 50, message: 'Tên thẻ không được quá 50 ký tự.' },
            ]}
          >
            <Input
              maxLength={50}
              placeholder="VD: AI"
              onChange={(e) => {
                if (!editingTag && !tagForm.isFieldTouched('slug')) {
                  tagForm.setFieldValue('slug', generateSlug(e.target.value))
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Đường dẫn (slug)"
            extra="Tự tạo từ tên"
            rules={[
              {
                validator: async (_, val) => {
                  if (!val || !val.trim()) return
                  if (!SLUG_PATTERN.test(val.trim())) {
                    throw new Error('Đường dẫn chỉ gồm chữ thường không dấu, chữ số và dấu gạch ngang.')
                  }
                },
              },
            ]}
          >
            <Input placeholder="ai" autoCapitalize="none" spellCheck={false} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default function Categories() {
  return (
    <RequireRole roles={['admin']}>
      <CategoriesContent />
    </RequireRole>
  )
}
