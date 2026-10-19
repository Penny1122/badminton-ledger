import { Link, useNavigate, useParams } from 'react-router'
import ReceivableList from '../components/ReceivableList'
import SignupPanel from '../components/SignupPanel'
import { useEditMode } from '../lib/editMode'
import { formatDay, formatTimeRange, formatTWD } from '../lib/format'
import { leaveSession, SESSION_FEE_LABEL, useSession, useVenues, voidSession, type Receivable } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'
import { usePublicAction } from '../lib/usePublicAction'

export default function SessionDetailPage() {
  const { id } = useParams()
  const { canEdit } = useEditMode()
  const navigate = useNavigate()
  const session = useSession(id)
  const venues = useVenues()
  const { run, busy, error } = useEditAction()
  const signup = usePublicAction()

  if (session.isLoading) return <p className="text-muted">載入中…</p>
  if (session.error) return <p className="text-danger">讀取失敗：{session.error.message}</p>
  const s = session.data
  if (!s) return <p className="text-muted">找不到這個活動。</p>

  const voided = s.voided_at !== null
  const mapUrl = venues.data?.find((v) => v.name === s.venue)?.map_url
  const hasPaid = s.receivables.some((r) => r.paid_at !== null)
  // 公開報名：沒作廢、還沒有人付款時，任何人都可以加入或取消
  const signupOpen = !voided && !hasPaid

  function handleLeave(r: Receivable) {
    if (s!.receivables.length === 1) return signup.setError('至少要留 1 位參加者')
    if (!window.confirm(`取消「${r.member.name}」的報名？`)) return
    void signup.run(() => leaveSession(s!.id, r.member_id))
  }

  async function handleVoid() {
    const reason = window.prompt(`作廢這個活動？${SESSION_FEE_LABEL[s!.kind]}支出也會一起作廢。可以填寫原因（選填）`)
    if (reason === null) return
    const ok = await run((password) => voidSession(password, s!.id, reason))
    if (ok) navigate('/sessions', { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <h1 className={`text-xl font-bold ${voided ? 'line-through opacity-50' : ''}`}>
          {s.kind === 'coaching' && '🎓 '}
          {formatDay(s.played_on)}
          {(s.start_time || s.end_time) && (
            <span className="ml-2 font-normal text-muted">{formatTimeRange(s.start_time, s.end_time)}</span>
          )}
        </h1>
        {s.venue && (
          <p className="mt-1">
            📍{' '}
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="text-accent-ink underline">
                {s.venue}
              </a>
            ) : (
              s.venue
            )}
          </p>
        )}
        <p className="mt-1 text-ink-2">
          {SESSION_FEE_LABEL[s.kind]} <span className="font-semibold tabular-nums">{formatTWD(s.court_fee)}</span>・{s.receivables.length} 人
        </p>
        {s.note && <p className="mt-1 text-sm text-muted">{s.note}</p>}
        {voided && <p className="mt-1 text-sm text-danger">已作廢{s.void_reason ? `：${s.void_reason}` : ''}</p>}
      </div>

      {signup.error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {signup.error}
        </p>
      )}

      {signupOpen && <SignupPanel session={s} action={signup} />}

      <ReceivableList
        receivables={s.receivables}
        canEdit={canEdit && !voided}
        showBreakdown
        onRemove={signupOpen ? handleLeave : undefined}
        removeDisabled={signup.busy}
      />
      {!voided && hasPaid && (
        <p className="text-center text-xs text-faint">已經有人付款，報名名單已鎖定。</p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {canEdit && !voided && (
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/sessions/${s.id}/edit`}
            className="rounded-lg border border-line-strong bg-surface py-2.5 text-center font-semibold"
          >
            編輯
          </Link>
          <button
            type="button"
            onClick={handleVoid}
            disabled={busy || hasPaid}
            title={hasPaid ? '已經有人付款，請先取消勾選' : undefined}
            className="rounded-lg border border-danger/40 py-2.5 font-semibold text-danger disabled:opacity-40"
          >
            作廢
          </button>
        </div>
      )}
      {canEdit && !voided && hasPaid && (
        <p className="text-center text-xs text-faint">已經有人付款，要作廢請先取消勾選付款。</p>
      )}
    </div>
  )
}
