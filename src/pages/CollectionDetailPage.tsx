import { Link, useNavigate, useParams } from 'react-router'
import ReceivableList from '../components/ReceivableList'
import { useEditMode } from '../lib/editMode'
import { formatDay, formatTWD } from '../lib/format'
import { useCollection, voidCollection } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

export default function CollectionDetailPage() {
  const { id } = useParams()
  const { canEdit } = useEditMode()
  const navigate = useNavigate()
  const collection = useCollection(id)
  const { run, busy, error } = useEditAction()

  if (collection.isLoading) return <p className="text-slate-500">載入中…</p>
  if (collection.error) return <p className="text-red-600">讀取失敗：{collection.error.message}</p>
  const c = collection.data
  if (!c) return <p className="text-slate-500">找不到這張收款單。</p>

  const voided = c.voided_at !== null
  const hasPaid = c.receivables.some((r) => r.paid_at !== null)

  async function handleVoid() {
    if (!window.confirm('作廢這張收款單？')) return
    const ok = await run((password) => voidCollection(password, c!.id))
    if (ok) navigate('/sessions?tab=collections', { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className={`text-xl font-bold ${voided ? 'line-through opacity-50' : ''}`}>{c.title}</h1>
        <p className="mt-1 text-slate-600">
          {formatDay(c.collected_on)}・每人{' '}
          <span className="font-semibold tabular-nums">{formatTWD(c.receivables[0]?.amount_due ?? 0)}</span>
        </p>
        {c.note && <p className="mt-1 text-sm text-slate-500">{c.note}</p>}
        {voided && <p className="mt-1 text-sm text-red-600">已作廢</p>}
      </div>

      <ReceivableList receivables={c.receivables} canEdit={canEdit && !voided} />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {canEdit && !voided && (
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/collections/${c.id}/edit`}
            className="rounded-lg border border-slate-300 bg-white py-2.5 text-center font-semibold"
          >
            編輯
          </Link>
          <button
            type="button"
            onClick={handleVoid}
            disabled={busy || hasPaid}
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
