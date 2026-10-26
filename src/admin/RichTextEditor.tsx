import { useEffect, useState } from 'react'
import { EditorContent, Node, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button, Flex, Input, Modal, Select, Tooltip } from 'antd'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ImageSquare,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Quotes,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { safeHref, type RichNode } from '../components/PostArticle'
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
export function docSnapshot(doc: RichNode): string {
  const c = [...(doc.content ?? [])]
  while (c.length && c[c.length - 1].type === 'paragraph' && !c[c.length - 1].content?.length) c.pop()
  return JSON.stringify({ ...doc, content: c }, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x,
  )
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
      {btn('Chèn liên kết', <LinkSimple size={16} />, onLink, s.link)}
      {btn('Chèn ảnh từ thư viện', <ImageSquare size={16} />, onImage)}
      {btn('Chèn video YouTube từ thư viện', <YoutubeLogo size={16} />, onVideo)}
      {btn('Hoàn tác', <ArrowCounterClockwise size={16} />, () => chain().undo().run(), false, !s.canUndo)}
      {btn('Làm lại', <ArrowClockwise size={16} />, () => chain().redo().run(), false, !s.canRedo)}
    </Flex>
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
