import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import ShareButtons from '../components/ShareButtons'
import { useEditMode } from '../lib/editMode'
import { formatDay, formatTimeRange, formatTWD } from '../lib/format'
import {
  isUpcoming,
  SESSION_FEE_LABEL,
  SESSION_KIND_LABEL,
  useCollections,
  useSessions,
  useVenues,
  type Receivable,
  type SessionKind,
} from '../lib/ledger'
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
  // 分享面板：選打球或教練課，直接分享該類所有還沒開始的活動
  const [sharing, setSharing] = useState(false)
  const [shareKind, setShareKind] = useState<SessionKind>('play')

  if (sessions.isLoading) return <p className="text-muted">載入中…</p>
  if (sessions.error) return <p className="text-danger">讀取失敗：{sessions.error.message}</p>

  const items = (sessions.data ?? []).filter((s) => showVoided || s.voided_at === null)
  if (items.length === 0) return <p className="py-8 text-center text-faint">還沒有活動</p>

  const upcoming = (sessions.data ?? []).filter((s) => s.voided_at === null && isUpcoming(s))
  const upcomingOf = (kind: SessionKind) =>
    upcoming
      .filter((s) => s.kind === kind)
      .sort((a, b) => a.played_on.localeCompare(b.played_on) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  const chosen = upcomingOf(shareKind)

  return (
    <div className={`space-y-2 ${sharing ? 'pb-48' : ''}`}>
      <div className="flex justify-end px-1 text-sm">
        <button type="button" onClick={() => setSharing(true)} className="text-accent-ink">
          分享未開始的活動
        </button>
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
            />
          </li>
        ))}
      </ul>

      {sharing && (
        // 點面板以外的地方（遮罩）就關掉分享；遮罩停在底部分頁上方，切換分頁照常可以按
        <button
          type="button"
          aria-label="取消分享"
          onClick={() => setSharing(false)}
          className="fixed inset-x-0 top-0 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] bg-page/60"
        />
      )}
      {sharing && (
        <div className="fixed inset-x-0 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] border-t border-line bg-surface p-3">
          <div className="mx-auto max-w-lg space-y-2">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1">
              {(['play', 'coaching'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setShareKind(kind)}
                  className={`rounded-md py-1.5 text-sm ${shareKind === kind ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}`}
                >
                  {SESSION_KIND_LABEL[kind]}（{upcomingOf(kind).length}）
                </button>
              ))}
            </div>
            <p className="px-1 text-sm text-muted">
              {chosen.length === 0
                ? `沒有還沒開始的${SESSION_KIND_LABEL[shareKind]}`
                : `將分享：${chosen.map((s) => formatDay(s.played_on)).join('、')}`}
            </p>
            <ShareButtons text={sessionsShareText(chosen, venues.data ?? [])} disabled={chosen.length === 0} />
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
}: {
  to: string
  title: string
  subtitle: string
  receivables: Receivable[]
  voided: boolean
}) {
  const unpaid = receivables.filter((r) => r.paid_at === null)
  const outstanding = unpaid.reduce((sum, r) => sum + r.amount_due, 0)

  const content = (
    <div className="flex items-start justify-between gap-2">
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

  return (
    <Link to={to} className={`block rounded-xl bg-surface p-3 shadow-sm active:bg-subtle ${voided ? 'opacity-50' : ''}`}>
      {content}
    </Link>
  )
}
