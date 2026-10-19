import { useState, type FormEvent } from 'react'
import { joinSession, useMembers, type Session } from '../lib/ledger'
import { usePublicAction } from '../lib/usePublicAction'

/** 公開報名：不用解鎖，點自己的名字或輸入新名字 */
export default function SignupPanel({ session, action }: { session: Session; action: ReturnType<typeof usePublicAction> }) {
  const members = useMembers()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const joined = new Set(session.receivables.map((r) => r.member_id))
  const candidates = (members.data ?? []).filter((m) => m.is_active && !joined.has(m.id))

  async function join(who: { memberId: string } | { newName: string }, label: string) {
    if (!window.confirm(`幫「${label}」報名這個活動？`)) return
    const ok = await action.run(() => joinSession(session.id, who))
    if (ok) {
      setName('')
      setOpen(false)
    }
  }

  function handleNewName(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    // 名冊裡已經有這個名字就直接用
    const existing = (members.data ?? []).find((m) => m.name === trimmed)
    if (existing && joined.has(existing.id)) return action.setError(`「${trimmed}」已經在名單裡了`)
    void join(existing ? { memberId: existing.id } : { newName: trimmed }, trimmed)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-accent py-2.5 font-semibold text-on-accent"
      >
        ＋ 我要參加
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">點你的名字報名</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">
          收起
        </button>
      </div>

      {members.isLoading ? (
        <p className="text-sm text-faint">載入中…</p>
      ) : candidates.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {candidates.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={action.busy}
              onClick={() => void join({ memberId: m.id }, m.name)}
              className="rounded-full border border-line-strong bg-surface px-3 py-1 text-sm active:bg-subtle disabled:opacity-40"
            >
              {m.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-faint">名冊裡的人都報名了</p>
      )}

      <form onSubmit={handleNewName} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="第一次來？輸入名字"
          className="min-w-0 flex-1 rounded-lg border border-line-strong px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={!name.trim() || action.busy}
          className="rounded-lg border border-accent-ink px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
        >
          報名
        </button>
      </form>
    </div>
  )
}
