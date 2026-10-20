import { useEffect, useState } from 'react'
import { EditorContent, Node, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Button, Checkbox, Divider, Flex, Input, InputNumber, Modal, Popover, Select, Tooltip } from 'antd'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsMerge,
  ArrowsSplit,
  Columns,
  ColumnsPlusLeft,
  ColumnsPlusRight,
  Highlighter,
  ImageSquare,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Quotes,
  Rows,
  RowsPlusBottom,
  RowsPlusTop,
  Table,
  TextAlignCenter,
  TextAlignJustify,
  TextAlignLeft,
  TextAlignRight,
  TextAUnderline,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextSubscript,
  TextSuperscript,
  TextUnderline,
  Trash,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { safeHref, type RichNode } from '../components/PostArticle'
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '../components/richTextPalette'
import { MediaPicker } from './MediaPicker'
import { videoIdOf, type MediaDto } from './media'

// Ảnh và video trong nội dung chỉ lưu mediaId (backend bỏ src khi lưu, vì signed URL có hạn).
// src/videoId chỉ dùng để hiện trong trình soạn thảo, được gắn lại từ danh sách media khi mở bài (withMediaUrls).
const MediaImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      mediaId: { default: null, parseHTML: (el) => el.getAttribute('data-media-id'), renderHTML: (a) => ({ 'data-media-id': a.mediaId }) },
      alt: { default: '' },
      src: { default: null },
    }
  },
  parseHTML: () => [{ tag: 'img[data-media-id]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', { ...HTMLAttributes, class: 'rich-editor__image' }],
})

const MediaVideo = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      mediaId: { default: null, parseHTML: (el) => el.getAttribute('data-media-id'), renderHTML: (a) => ({ 'data-media-id': a.mediaId }) },
      videoId: { default: null, renderHTML: () => ({}) },
      title: { default: '', renderHTML: () => ({}) },
    }
  },
  parseHTML: () => [{ tag: 'div[data-video][data-media-id]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    { ...HTMLAttributes, 'data-video': '', class: 'rich-editor__video' },
    ['img', { src: node.attrs.videoId ? `https://i.ytimg.com/vi/${node.attrs.videoId}/hqdefault.jpg` : '', alt: '' }],
    ['span', {}, `Video: ${node.attrs.title || 'YouTube'}`],
  ],
})

type MediaMap = Record<string, { url: string | null; videoId: string | null; name: string; altText: string | null }>

// Gắn URL hiển thị vào node ảnh/video trước khi nạp vào trình soạn thảo.
export function withMediaUrls(node: RichNode, media: MediaMap): RichNode {
  const m = node.attrs?.mediaId ? media[String(node.attrs.mediaId)] : undefined
  const attrs =
    node.type === 'image' && m ? { ...node.attrs, src: m.url } : node.type === 'video' && m ? { ...node.attrs, videoId: m.videoId, title: m.name } : node.attrs
  return { ...node, ...(attrs && { attrs }), ...(node.content && { content: node.content.map((c) => withMediaUrls(c, media)) }) }
}

// Chuỗi so sánh "có thay đổi chưa lưu". Bỏ đoạn trống cuối bài (Tiptap tự thêm khi bài kết thúc bằng ảnh,
// danh sách, trích dẫn...). Sắp key: backend trả node dạng {"text","type"}, Tiptap trả {"type","text"}.
// Bỏ thuộc tính null và attrs rỗng: Tiptap thêm giá trị mặc định (textAlign: null...) mà backend không lưu.
export function docSnapshot(doc: RichNode): string {
  const c = [...(doc.content ?? [])]
  while (c.length && c[c.length - 1].type === 'paragraph' && !c[c.length - 1].content?.length) c.pop()
  return JSON.stringify({ ...doc, content: c }, (key, x) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return x
    const entries = Object.entries(x).filter(([, v]) => v !== null && v !== undefined)
    if (key === 'attrs' && entries.length === 0) return undefined
    return Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : 1)))
  })
}

const BLOCKS = [
  { value: 'p', label: 'Đoạn văn' },
  { value: '2', label: 'Tiêu đề lớn' },
  { value: '3', label: 'Tiêu đề vừa' },
  { value: '4', label: 'Tiêu đề nhỏ' },
]

export function RichTextEditor({
  initial,
  editable = true,
  onChange,
  onReady,
  onMediaAdded,
  labelledBy,
}: {
  // Chỉ dùng khi tạo editor. Muốn nạp lại nội dung (khôi phục, tải lại) thì đổi key của component.
  initial: RichNode
  editable?: boolean
  onChange: (doc: RichNode) => void
  // Nội dung sau khi Tiptap chuẩn hóa (thêm thuộc tính mặc định). Dùng làm mốc để biết người dùng đã sửa chưa.
  onReady?: (doc: RichNode) => void
  onMediaAdded: (media: MediaDto) => void
  labelledBy: string
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, isAllowedUri: (url) => safeHref(url) !== null, HTMLAttributes: { rel: 'noopener noreferrer', target: null } },
      }),
      MediaImage,
      MediaVideo,
      // Bảng và định dạng kiểu Word (SCRUM-68). Backend lọc lại theo allowlist (RichTextContent.cs): tối đa 50 hàng x 20 cột,
      // không lồng bảng, màu chỉ trong bảng màu richTextPalette.ts. Dán từ Word/Google Docs: Tiptap đọc bảng HTML thành bảng.
      TableKit.configure({ table: { resizable: true, cellMinWidth: 60 } }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Subscript,
      Superscript,
    ],
    content: initial,
    editorProps: { attributes: { class: 'rich-text rich-editor__content', role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': labelledBy } },
    onCreate: ({ editor }) => onReady?.(editor.getJSON() as RichNode),
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichNode),
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  const [picker, setPicker] = useState<'image' | 'video' | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  function insertMedia(m: MediaDto) {
    if (!editor) return
    onMediaAdded(m)
    const node =
      m.kind === 'video'
        ? { type: 'video', attrs: { mediaId: m.id, videoId: videoIdOf(m), title: m.name } }
        : { type: 'image', attrs: { mediaId: m.id, alt: m.altText ?? '', src: m.url } }
    editor.chain().focus().insertContent(node).run()
    setPicker(null)
  }

  return (
    <div className="rich-editor">
      {editor && editable && <Toolbar editor={editor} onImage={() => setPicker('image')} onVideo={() => setPicker('video')} onLink={() => setLinkOpen(true)} />}
      <EditorContent editor={editor} />
      <MediaPicker
        key={picker ?? 'none'}
        open={picker !== null}
        kinds={picker === 'video' ? ['video'] : ['image']}
        title={picker === 'video' ? 'Chèn video' : 'Chèn ảnh'}
        onCancel={() => setPicker(null)}
        onSelect={insertMedia}
      />
      {editor && <LinkModal open={linkOpen} editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  )
}

function Toolbar({ editor, onImage, onVideo, onLink }: { editor: Editor; onImage: () => void; onVideo: () => void; onLink: () => void }) {
  // Đọc trạng thái nút theo selection hiện tại; chỉ render lại khi các giá trị này đổi.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 }) ? '2' : e.isActive('heading', { level: 3 }) ? '3' : e.isActive('heading', { level: 4 }) ? '4' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
      align: (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      subscript: e.isActive('subscript'),
      superscript: e.isActive('superscript'),
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      highlight: e.isActive('highlight'),
      inTable: e.isActive('table'),
      canMerge: e.can().mergeCells(),
      canSplit: e.can().splitCell(),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, pressed?: boolean, disabled?: boolean) => (
    <Tooltip title={label} key={label}>
      <Button type={pressed ? 'primary' : 'text'} ghost={pressed} size="small" icon={icon} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} />
    </Tooltip>
  )
  const chain = () => editor.chain().focus()

  return (
    <Flex className="rich-editor__toolbar" wrap gap={4} align="center" role="toolbar" aria-label="Định dạng nội dung">
      <Select
        size="small"
        aria-label="Kiểu đoạn"
        value={s.block}
        options={BLOCKS}
        style={{ width: 130 }}
        onChange={(v) => (v === 'p' ? chain().setParagraph().run() : chain().setHeading({ level: Number(v) as 2 | 3 | 4 }).run())}
      />
      {btn('In đậm', <TextB size={16} />, () => chain().toggleBold().run(), s.bold)}
      {btn('In nghiêng', <TextItalic size={16} />, () => chain().toggleItalic().run(), s.italic)}
      {btn('Gạch chân', <TextUnderline size={16} />, () => chain().toggleUnderline().run(), s.underline)}
      {btn('Gạch ngang', <TextStrikethrough size={16} />, () => chain().toggleStrike().run(), s.strike)}
      {btn('Danh sách dấu chấm', <ListBullets size={16} />, () => chain().toggleBulletList().run(), s.bulletList)}
      {btn('Danh sách đánh số', <ListNumbers size={16} />, () => chain().toggleOrderedList().run(), s.orderedList)}
      {btn('Trích dẫn', <Quotes size={16} />, () => chain().toggleBlockquote().run(), s.blockquote)}
      {btn('Chỉ số dưới', <TextSubscript size={16} />, () => chain().toggleSubscript().run(), s.subscript)}
      {btn('Chỉ số trên', <TextSuperscript size={16} />, () => chain().toggleSuperscript().run(), s.superscript)}
      <ColorPicker
        label="Màu chữ"
        icon={<TextAUnderline size={16} />}
        colors={TEXT_COLORS}
        active={s.color}
        onPick={(c) => (c ? chain().setColor(c).run() : chain().unsetColor().run())}
      />
      <ColorPicker
        label="Tô nền chữ"
        icon={<Highlighter size={16} />}
        colors={HIGHLIGHT_COLORS}
        active={s.highlight ? 'on' : null}
        onPick={(c) => (c ? chain().setHighlight({ color: c }).run() : chain().unsetHighlight().run())}
      />
      <Divider type="vertical" style={{ margin: '0 2px' }} />
      {btn('Căn trái', <TextAlignLeft size={16} />, () => chain().setTextAlign('left').run(), s.align === 'left')}
      {btn('Căn giữa', <TextAlignCenter size={16} />, () => chain().setTextAlign('center').run(), s.align === 'center')}
      {btn('Căn phải', <TextAlignRight size={16} />, () => chain().setTextAlign('right').run(), s.align === 'right')}
      {btn('Căn đều hai bên', <TextAlignJustify size={16} />, () => chain().setTextAlign('justify').run(), s.align === 'justify')}
      <Divider type="vertical" style={{ margin: '0 2px' }} />
      <InsertTable onInsert={(rows, cols, header) => chain().insertTable({ rows, cols, withHeaderRow: header }).run()} disabled={s.inTable} />
      {btn('Chèn liên kết', <LinkSimple size={16} />, onLink, s.link)}
      {btn('Chèn ảnh từ thư viện', <ImageSquare size={16} />, onImage)}
      {btn('Chèn video YouTube từ thư viện', <YoutubeLogo size={16} />, onVideo)}
      {btn('Hoàn tác', <ArrowCounterClockwise size={16} />, () => chain().undo().run(), false, !s.canUndo)}
      {btn('Làm lại', <ArrowClockwise size={16} />, () => chain().redo().run(), false, !s.canRedo)}
      {s.inTable && (
        // Công cụ bảng chỉ hiện khi con trỏ đang ở trong bảng.
        <Flex className="rich-editor__table-tools" wrap gap={4} align="center" role="group" aria-label="Công cụ bảng">
          {btn('Thêm hàng phía trên', <RowsPlusTop size={16} />, () => chain().addRowBefore().run())}
          {btn('Thêm hàng phía dưới', <RowsPlusBottom size={16} />, () => chain().addRowAfter().run())}
          {btn('Thêm cột bên trái', <ColumnsPlusLeft size={16} />, () => chain().addColumnBefore().run())}
          {btn('Thêm cột bên phải', <ColumnsPlusRight size={16} />, () => chain().addColumnAfter().run())}
          {btn('Xóa hàng', <Rows size={16} />, () => chain().deleteRow().run())}
          {btn('Xóa cột', <Columns size={16} />, () => chain().deleteColumn().run())}
          {btn('Gộp ô đã chọn', <ArrowsMerge size={16} />, () => chain().mergeCells().run(), false, !s.canMerge)}
          {btn('Tách ô', <ArrowsSplit size={16} />, () => chain().splitCell().run(), false, !s.canSplit)}
          {btn('Bật/tắt hàng tiêu đề', <Table size={16} weight="fill" />, () => chain().toggleHeaderRow().run())}
          {btn('Xóa bảng', <Trash size={16} />, () => chain().deleteTable().run())}
        </Flex>
      )}
    </Flex>
  )
}

// Ô chọn màu: chỉ các màu trong bảng màu cố định (server bỏ màu khác), nút "Bỏ màu" gỡ định dạng.
function ColorPicker({ label, icon, colors, active, onPick }: {
  label: string
  icon: React.ReactNode
  colors: readonly { value: string; label: string }[]
  active: string | null
  onPick: (color: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const pick = (c: string | null) => {
    onPick(c)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={
        <Flex vertical gap={8}>
          <Flex gap={6} role="group" aria-label={label}>
            {colors.map((c) => (
              <button key={c.value} type="button" className="rich-editor__swatch" style={{ background: c.value }} aria-label={`${label}: ${c.label}`} title={c.label} onClick={() => pick(c.value)} />
            ))}
          </Flex>
          <Button size="small" onClick={() => pick(null)}>Bỏ {label.toLowerCase()}</Button>
        </Flex>
      }
    >
      {/* Không bọc Tooltip quanh nút mở Popover: tooltip đè lên nội dung popover (xem design.md). */}
      <Button type={active ? 'primary' : 'text'} ghost={!!active} size="small" icon={icon} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} />
    </Popover>
  )
}

// Chèn bảng: chọn số hàng, số cột (cùng giới hạn backend 50 x 20) và có hàng tiêu đề hay không.
function InsertTable({ onInsert, disabled }: { onInsert: (rows: number, cols: number, header: boolean) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [header, setHeader] = useState(true)
  return (
    <Popover
      open={open}
      onOpenChange={(o) => !disabled && setOpen(o)}
      trigger="click"
      title="Chèn bảng"
      content={
        <Flex vertical gap={8}>
          <Flex gap={8} align="center">
            <label htmlFor="table-rows" style={{ width: 56 }}>Số hàng</label>
            <InputNumber id="table-rows" min={1} max={50} value={rows} onChange={(v) => setRows(v ?? 1)} size="small" />
          </Flex>
          <Flex gap={8} align="center">
            <label htmlFor="table-cols" style={{ width: 56 }}>Số cột</label>
            <InputNumber id="table-cols" min={1} max={20} value={cols} onChange={(v) => setCols(v ?? 1)} size="small" />
          </Flex>
          <Checkbox checked={header} onChange={(e) => setHeader(e.target.checked)}>Hàng đầu là tiêu đề</Checkbox>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              onInsert(Math.min(Math.max(rows, 1), 50), Math.min(Math.max(cols, 1), 20), header)
              setOpen(false)
            }}
          >
            Tạo bảng
          </Button>
        </Flex>
      }
    >
      <Button type="text" size="small" icon={<Table size={16} />} aria-label="Chèn bảng" title={disabled ? 'Không chèn bảng trong bảng' : 'Chèn bảng'} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} />
    </Popover>
  )
}

function LinkModal({ open, editor, onClose }: { open: boolean; editor: Editor; onClose: () => void }) {
  const [href, setHref] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setHref(String(editor.getAttributes('link').href ?? ''))
      setError('')
    }
  }, [open, editor])

  function apply() {
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return onClose()
    }
    const safe = safeHref(href)
    if (!safe) return setError('Chỉ nhận liên kết bắt đầu bằng https://, http://, mailto: hoặc đường dẫn trong site bắt đầu bằng /.')
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run()
    onClose()
  }

  return (
    <Modal open={open} title="Chèn liên kết" okText="Áp dụng" cancelText="Hủy" onOk={apply} onCancel={onClose} destroyOnHidden>
      <label htmlFor="link-href">Địa chỉ liên kết</label>
      <Input
        id="link-href"
        value={href}
        status={error ? 'error' : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? 'link-href-error' : 'link-href-hint'}
        placeholder="https://se.uit.edu.vn/..."
        onChange={(e) => {
          setHref(e.target.value)
          setError('')
        }}
        onPressEnter={apply}
        autoFocus
      />
      {error ? (
        <div id="link-href-error" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</div>
      ) : (
        <div id="link-href-hint" className="muted" style={{ fontSize: 'var(--text-sm)' }}>Để trống rồi Áp dụng để gỡ liên kết.</div>
      )}
    </Modal>
  )
}
