import { Link, useNavigate, useParams } from 'react-router'
import ReceivableList from '../components/ReceivableList'
import { useEditMode } from '../lib/editMode'
import { formatDay, formatTWD } from '../lib/format'
import { useSession, voidSession } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

export default function SessionDetailPage() {
  const { id } = useParams()
  const { canEdit } = useEditMode()
  const navigate = useNavigate()
  const session = useSession(id)
  const { run, busy, error } = useEditAction()

  if (session.isLoading) return <p className="text-slate-500">載入中…</p>
  if (session.error) return <p className="text-red-600">讀取失敗：{session.error.message}</p>
  const s = session.data
  if (!s) return <p className="text-slate-500">找不到這個場次。</p>

  const voided = s.voided_at !== null
  const hasPaid = s.receivables.some((r) => r.paid_at !== null)

  async function handleVoid() {
    const reason = window.prompt('作廢這個場次？場地費支出也會一起作廢。可以填寫原因（選填）')
    if (reason === null) return
    const ok = await run((password) => voidSession(password, s!.id, reason))
    if (ok) navigate('/sessions', { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className={`text-xl font-bold ${voided ? 'line-through opacity-50' : ''}`}>
          {formatDay(s.played_on)}
          {s.venue && <span className="font-normal text-slate-500">・{s.venue}</span>}
        </h1>
        <p className="mt-1 text-slate-600">
          場地費 <span className="font-semibold tabular-nums">{formatTWD(s.court_fee)}</span>・{s.receivables.length} 人
        </p>
        {s.note && <p className="mt-1 text-sm text-slate-500">{s.note}</p>}
        {voided && <p className="mt-1 text-sm text-red-600">已作廢{s.void_reason ? `：${s.void_reason}` : ''}</p>}
      </div>

      <ReceivableList receivables={s.receivables} canEdit={canEdit && !voided} showBreakdown />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {canEdit && !voided && (
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/sessions/${s.id}/edit`}
            className="rounded-lg border border-slate-300 bg-white py-2.5 text-center font-semibold"
          >
            編輯
          </Link>
          <button
            type="button"
            onClick={handleVoid}
            disabled={busy || hasPaid}
            title={hasPaid ? '已經有人付款，請先取消勾選' : undefined}
            className="rounded-lg border border-red-300 py-2.5 font-semibold text-red-600 disabled:opacity-40"
          >
            作廢
          </button>
        </div>
      )}
      {canEdit && !voided && hasPaid && (
        <p className="text-center text-xs text-slate-400">已經有人付款，要作廢請先取消勾選付款。</p>
      )}
    </div>
  )
}
