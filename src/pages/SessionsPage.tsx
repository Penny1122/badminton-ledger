import { Link, useSearchParams } from 'react-router'
import { useEditMode } from '../lib/editMode'
import { formatDay, formatTWD } from '../lib/format'
import { useCollections, useSessions, type Receivable } from '../lib/ledger'

type Tab = 'sessions' | 'collections'

export default function SessionsPage() {
  const { canEdit } = useEditMode()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'collections' ? 'collections' : 'sessions'
  const showVoided = params.get('voided') === '1'

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">場次與收款</h1>
        {canEdit && (
          <Link
            to={tab === 'sessions' ? '/sessions/new' : '/collections/new'}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            ＋ {tab === 'sessions' ? '新增場次' : '新增收款單'}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/60 p-1">
        {(
          [
            ['sessions', '打球場次'],
            ['collections', '收款單'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setParam('tab', value === 'sessions' ? '' : value)}
            className={`rounded-md py-1.5 text-sm ${tab === value ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 px-1 text-sm text-slate-500">
        <input type="checkbox" checked={showVoided} onChange={(e) => setParam('voided', e.target.checked ? '1' : '')} />
        顯示已作廢
      </label>

      {tab === 'sessions' ? <SessionList showVoided={showVoided} /> : <CollectionList showVoided={showVoided} />}
    </div>
  )
}

function SessionList({ showVoided }: { showVoided: boolean }) {
  const sessions = useSessions()
  if (sessions.isLoading) return <p className="text-slate-500">載入中…</p>
  if (sessions.error) return <p className="text-red-600">讀取失敗：{sessions.error.message}</p>

  const items = (sessions.data ?? []).filter((s) => showVoided || s.voided_at === null)
  if (items.length === 0) return <p className="py-8 text-center text-slate-400">還沒有場次</p>

  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id}>
          <Card
            to={`/sessions/${s.id}`}
            title={`${formatDay(s.played_on)}${s.venue ? `・${s.venue}` : ''}`}
            subtitle={`場地費 ${formatTWD(s.court_fee)}・${s.receivables.length} 人`}
            receivables={s.receivables}
            voided={s.voided_at !== null}
          />
        </li>
      ))}
    </ul>
  )
}

function CollectionList({ showVoided }: { showVoided: boolean }) {
  const collections = useCollections()
  if (collections.isLoading) return <p className="text-slate-500">載入中…</p>
  if (collections.error) return <p className="text-red-600">讀取失敗：{collections.error.message}</p>

  const items = (collections.data ?? []).filter((c) => showVoided || c.voided_at === null)
  if (items.length === 0) {
    return <p className="py-8 text-center text-slate-400">還沒有收款單。向 VIP 收球款時可以建立一張。</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <Card
            to={`/collections/${c.id}`}
            title={c.title}
            subtitle={`${formatDay(c.collected_on)}・每人 ${formatTWD(c.receivables[0]?.amount_due ?? 0)}`}
            receivables={c.receivables}
            voided={c.voided_at !== null}
          />
        </li>
      ))}
    </ul>
  )
}

function Card({
  to,
  title,
  subtitle,
  receivables,
  voided,
}: {
  to: string
  title: string
  subtitle: string
  receivables: Receivable[]
  voided: boolean
}) {
  const unpaid = receivables.filter((r) => r.paid_at === null)
  const outstanding = unpaid.reduce((sum, r) => sum + r.amount_due, 0)

  return (
    <Link to={to} className={`block rounded-xl bg-white p-3 shadow-sm active:bg-slate-50 ${voided ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold ${voided ? 'line-through' : ''}`}>{title}</p>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {voided ? (
          <span className="shrink-0 text-sm text-red-600">已作廢</span>
        ) : unpaid.length === 0 ? (
          <span className="shrink-0 text-sm text-emerald-600">✓ 已收齊</span>
        ) : (
          <span className="shrink-0 text-right text-sm">
            <span className="block font-semibold text-amber-600 tabular-nums">待收 {formatTWD(outstanding)}</span>
            <span className="text-slate-500">
              {receivables.length - unpaid.length}/{receivables.length} 已付
            </span>
          </span>
        )}
      </div>
    </Link>
  )
}
