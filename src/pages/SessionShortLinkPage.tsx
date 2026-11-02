import { Navigate, useParams } from 'react-router'
import { useSessionIdByCode } from '../lib/ledger'

/** 分享到 LINE 的報名短網址 /s/<code>，找到活動後轉到完整網址 */
export default function SessionShortLinkPage() {
  const { code } = useParams()
  const found = useSessionIdByCode(code)

  if (found.isLoading) return <p className="text-muted">載入中…</p>
  if (found.error) return <p className="text-danger">讀取失敗：{found.error.message}</p>
  if (!found.data) return <p className="text-muted">找不到這個活動。</p>
  return <Navigate to={`/sessions/${found.data}`} replace />
}
