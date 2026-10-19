import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import ShareButtons from '../components/ShareButtons'
import { useEditMode } from '../lib/editMode'
import { formatDay, formatTimeRange, formatTWD } from '../lib/format'
import { SESSION_FEE_LABEL, useCollections, useSessions, useVenues, type Receivable } from '../lib/ledger'
import { sessionsShareText } from '../lib/shareText'

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
        <h1 className="text-xl font-bold">活動與收款</h1>
        {canEdit && (
          <Link
            to={tab === 'sessions' ? '/sessions/new' : '/collections/new'}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent"
          >
            ＋ {tab === 'sessions' ? '新增活動' : '新增收款單'}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1">
        {(
          [
            ['sessions', '活動'],
            ['collections', '收款單'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setParam('tab', value === 'sessions' ? '' : value)}
            className={`rounded-md py-1.5 text-sm ${tab === value ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 px-1 text-sm text-muted">
        <input type="checkbox" checked={showVoided} onChange={(e) => setParam('voided', e.target.checked ? '1' : '')} />
        顯示已作廢
      </label>

      {tab === 'sessions' ? <SessionList showVoided={showVoided} /> : <CollectionList showVoided={showVoided} />}
    </div>
  )
}

function SessionList({ showVoided }: { showVoided: boolean }) {
  const sessions = useSessions()
  const venues = useVenues()
  // 選取模式：點卡片改成勾選，下方出現分享列
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (sessions.isLoading) return <p className="text-muted">載入中…</p>
  if (sessions.error) return <p className="text-danger">讀取失敗：{sessions.error.message}</p>

  const items = (sessions.data ?? []).filter((s) => (showVoided && !selecting) || s.voided_at === null)
  if (items.length === 0) return <p className="py-8 text-center text-faint">還沒有活動</p>

  const chosen = items.filter((s) => selected.has(s.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
  }

  return (
    <div className={`space-y-2 ${selecting ? 'pb-24' : ''}`}>
      <div className="flex items-center justify-between px-1 text-sm">
        {selecting ? (
          <>
            <span className="text-muted">點選要分享的活動（已選 {chosen.length} 場）</span>
            <button type="button" onClick={stopSelecting} className="text-accent-ink">
              取消
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setSelecting(true)} className="ml-auto text-accent-ink">
            選取分享
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.id}>
            <Card
              to={`/sessions/${s.id}`}
              title={`${s.kind === 'coaching' ? '🎓 ' : ''}${formatDay(s.played_on)} ${formatTimeRange(s.start_time, s.end_time)}`}
              subtitle={[
                s.venue,
                s.courts ? `${s.courts} 面場` : null,
                `${SESSION_FEE_LABEL[s.kind]} ${formatTWD(s.court_fee)}`,
                `${s.receivables.length} 人`,
              ]
                .filter(Boolean)
                .join('・')}
              receivables={s.receivables}
              voided={s.voided_at !== null}
              selected={selecting ? selected.has(s.id) : undefined}
              onSelect={() => toggle(s.id)}
            />
          </li>
        ))}
      </ul>

      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] border-t border-line bg-surface p-3">
          <div className="mx-auto max-w-lg">
            <ShareButtons
              text={sessionsShareText(chosen, venues.data ?? [])}
              disabled={chosen.length === 0}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CollectionList({ showVoided }: { showVoided: boolean }) {
  const collections = useCollections()
  if (collections.isLoading) return <p className="text-muted">載入中…</p>
  if (collections.error) return <p className="text-danger">讀取失敗：{collections.error.message}</p>

  const items = (collections.data ?? []).filter((c) => showVoided || c.voided_at === null)
  if (items.length === 0) {
    return <p className="py-8 text-center text-faint">還沒有收款單。向 VIP 收球款時可以建立一張。</p>
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
  selected,
  onSelect,
}: {
  to: string
  title: string
  subtitle: string
  receivables: Receivable[]
  voided: boolean
  /** 有值時是選取模式：點卡片切換勾選，不會跳頁 */
  selected?: boolean
  onSelect?: () => void
}) {
  const unpaid = receivables.filter((r) => r.paid_at === null)
  const outstanding = unpaid.reduce((sum, r) => sum + r.amount_due, 0)

  const content = (
    <div className="flex items-start justify-between gap-2">
      {selected !== undefined && (
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
            selected ? 'border-accent bg-accent text-on-accent' : 'border-line-strong'
          }`}
        >
          {selected && '✓'}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${voided ? 'line-through' : ''}`}>{title}</p>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      {voided ? (
        <span className="shrink-0 text-sm text-danger">已作廢</span>
      ) : unpaid.length === 0 ? (
        <span className="shrink-0 text-sm text-accent-ink">✓ 已收齊</span>
      ) : (
        <span className="shrink-0 text-right text-sm">
          <span className="block font-semibold text-warn tabular-nums">待收 {formatTWD(outstanding)}</span>
          <span className="text-muted">
            {receivables.length - unpaid.length}/{receivables.length} 已付
          </span>
        </span>
      )}
    </div>
  )

  if (selected !== undefined) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`block w-full rounded-xl border-2 bg-surface p-3 text-left shadow-sm ${
          selected ? 'border-accent' : 'border-transparent'
        }`}
      >
        {content}
      </button>
    )
  }

  return (
    <Link to={to} className={`block rounded-xl bg-surface p-3 shadow-sm active:bg-subtle ${voided ? 'opacity-50' : ''}`}>
      {content}
    </Link>
  )
}
