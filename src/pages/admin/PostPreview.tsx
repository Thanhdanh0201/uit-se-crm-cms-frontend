import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Button, Card, Flex, Skeleton, Tag } from 'antd'
import { ArrowLeft } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { noIndex } from '../../lib/seo'
import { PostArticle } from '../../components/PostArticle'
import { postErrorMessage, STATUS_COLOR, statusLabel, type PostView } from '../../admin/posts'

export const meta = () => noIndex('Xem trước bài viết')

// Xem trước bài đã lưu, hiển thị giống trang công khai (FR-POST-04). Chỉ tác giả hoặc Admin (server kiểm tra).
export default function PostPreview() {
  const { id } = useParams()
  const [post, setPost] = useState<PostView | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    api<PostView>(`/api/posts/${id}/preview`, { signal: ctrl.signal })
      .then(setPost)
      .catch((err) => !ctrl.signal.aborted && setError(postErrorMessage(err)))
    return () => ctrl.abort()
  }, [id])

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <Link to="/admin/posts" aria-label="Về danh sách bài viết"><ArrowLeft size={18} aria-hidden /></Link>
          Xem trước {post && <Tag color={STATUS_COLOR[post.status]}>{statusLabel(post.status)}</Tag>}
        </Flex>
      }
      extra={post && post.status === 'published' && <Button href={`/posts/${post.slug}`} target="_blank" rel="noopener noreferrer">Mở trang công khai</Button>}
    >
      {error ? <Alert type="error" showIcon title="Không xem trước được" description={error} /> : !post ? <Skeleton active /> : (
        <PostArticle post={{ ...post, categoryName: post.category.name, summary: post.summary || null }} />
      )}
    </Card>
  )
}
