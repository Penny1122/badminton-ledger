import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import Field from '../components/Field'
import MemberPicker from '../components/MemberPicker'
import { formatTWD, today } from '../lib/format'
import { perPersonShare, saveSession, useMembers, useSession, useSessions, useSettings, type Session } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

/** 新增：/sessions/new；編輯：/sessions/:id/edit */
export default function SessionFormPage() {
  const { id } = useParams()
  const existing = useSession(id)

  if (id === undefined) return <SessionForm key="new" existing={null} />
  if (existing.isLoading) return <p className="text-muted">載入中…</p>
  if (existing.error) return <p className="text-danger">讀取失敗：{existing.error.message}</p>
  if (!existing.data || existing.data.voided_at !== null) {
    return <p className="text-muted">找不到這個場次，可能已被作廢。</p>
  }
  return <SessionForm key={existing.data.id} existing={existing.data} />
}

function SessionForm({ existing }: { existing: Session | null }) {
  const navigate = useNavigate()
  const members = useMembers()
  const settings = useSettings()
  const sessions = useSessions()
  const { run, busy, error, setError } = useEditAction()

  const [playedOn, setPlayedOn] = useState(existing?.played_on ?? today())
  const [venue, setVenue] = useState(existing?.venue ?? '')
  const [courtFee, setCourtFee] = useState(existing ? String(existing.court_fee) : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [selected, setSelected] = useState(() => new Set(existing?.receivables.map((r) => r.member_id)))
  const [newNames, setNewNames] = useState<string[]>([])

  const hasPaid = existing?.receivables.some((r) => r.paid_at !== null) ?? false
  const venues = [...new Set((sessions.data ?? []).map((s) => s.venue).filter((v): v is string => !!v))]

  // 試算：新名字一律當一般參加者
  const memberList = members.data ?? []
  const vipCount = memberList.filter((m) => selected.has(m.id) && m.is_vip).length
  const count = selected.size + newNames.length
  const regularCount = count - vipCount
  const fee = Number(courtFee) || 0
  const share = perPersonShare(fee, count)
  const surcharge = settings.data?.surcharge ?? 0
  const total = share * count + surcharge * regularCount

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!playedOn) return setError('請選擇日期')
    if (!Number.isInteger(fee) || fee <= 0) return setError('場地費要是大於 0 的整數')
    if (count === 0) return setError('至少要有 1 位出席者')

    const result = await run((password) =>
      saveSession(password, {
        id: existing?.id ?? null,
        playedOn,
        venue,
        courtFee: fee,
        note,
        memberIds: [...selected],
        newNames,
      }),
    )
    if (result) navigate(`/sessions/${result.id}`, { replace: true })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h1 className="text-xl font-bold">{existing ? '編輯場次' : '新增場次'}</h1>

      {hasPaid && (
        <p className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
          已經有人付款，只能改日期、場地和備註。要改場地費或出席名單，請先取消勾選付款。
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="日期" htmlFor="played-on">
          <input
            id="played-on"
            type="date"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2"
          />
        </Field>
        <Field label="場地費" htmlFor="court-fee">
          <input
            id="court-fee"
            inputMode="numeric"
            pattern="[0-9]*"
            value={courtFee}
            disabled={hasPaid}
            onChange={(e) => setCourtFee(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-full rounded-lg border border-line-strong px-3 py-2 tabular-nums disabled:bg-subtle"
          />
        </Field>
      </div>

      <Field label="場地（選填）" htmlFor="venue">
        <input
          id="venue"
          list="venue-options"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          maxLength={30}
          placeholder="例如：中正運動中心"
          className="w-full rounded-lg border border-line-strong px-3 py-2"
        />
        <datalist id="venue-options">
          {venues.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </Field>

      <Field label={`出席（${count} 人）`}>
        {members.isLoading ? (
          <p className="text-sm text-faint">載入中…</p>
        ) : hasPaid ? (
          <p className="text-sm text-muted">{existing?.receivables.map((r) => r.member.name).join('、')}</p>
        ) : (
          <MemberPicker
            members={memberList}
            selected={selected}
            onToggle={toggle}
            newNames={newNames}
            onNewNamesChange={setNewNames}
          />
        )}
      </Field>

      {count > 0 && fee > 0 && (
        <div className="space-y-1 rounded-xl bg-surface p-3 text-sm shadow-sm">
          <Row label={`每人場地費 ⌈${fee} ÷ ${count}⌉`} value={formatTWD(share)} />
          {vipCount > 0 && <Row label={`VIP ${vipCount} 人`} value={`各 ${formatTWD(share)}`} />}
          {regularCount > 0 && <Row label={`一般 ${regularCount} 人（含球費 ${surcharge}）`} value={`各 ${formatTWD(share + surcharge)}`} />}
          <div className="border-t border-line pt-1">
            <Row label="應收合計" value={formatTWD(total)} bold />
            <Row label="進公基金（進位 + 球費）" value={formatTWD(total - fee)} />
          </div>
        </div>
      )}

      <Field label="備註（選填）" htmlFor="note">
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-line-strong px-3 py-2"
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-accent py-2.5 font-semibold text-on-accent disabled:opacity-50"
      >
        {busy ? '儲存中…' : '儲存'}
      </button>
      {!existing && <p className="text-center text-xs text-faint">儲存後會自動記一筆場地費支出。</p>}
    </form>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : 'text-ink-2'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
