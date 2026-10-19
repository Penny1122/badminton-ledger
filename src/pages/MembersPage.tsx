import { useState, type FormEvent } from 'react'
import { useEditMode } from '../lib/editMode'
import { formatDay } from '../lib/format'
import { saveMember, useMembers, type Member } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

export default function MembersPage() {
  const { canEdit } = useEditMode()
  const members = useMembers()
  const action = useEditAction()
  const [name, setName] = useState('')
  const [isVip, setIsVip] = useState(false)

  if (members.isLoading) return <p className="text-muted">載入中…</p>
  if (members.error) return <p className="text-danger">讀取失敗：{members.error.message}</p>

  const all = members.data ?? []
  const active = all.filter((m) => m.is_active)
  const inactive = all.filter((m) => !m.is_active)
  const vipCount = active.filter((m) => m.is_vip).length

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const ok = await action.run((password) =>
      saveMember(password, { id: null, name: trimmed, isVip, isActive: true }),
    )
    if (ok) {
      setName('')
      setIsVip(false)
    }
  }

  function update(member: Member, changes: { name?: string; isVip?: boolean; isActive?: boolean }) {
    void action.run((password) =>
      saveMember(password, {
        id: member.id,
        name: changes.name ?? member.name,
        isVip: changes.isVip ?? null,
        isActive: changes.isActive ?? null,
      }),
    )
  }

  function rename(member: Member) {
    const next = window.prompt('新的名字', member.name)?.trim()
    if (next && next !== member.name) update(member, { name: next })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">成員名冊</h1>
        <p className="text-sm text-muted">
          {active.length} 人，其中 VIP {vipCount} 人。名字會出現在公開頁面，建議用暱稱。
        </p>
      </div>

      {action.error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {action.error}
        </p>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="新增成員"
            className="min-w-0 flex-1 rounded-lg border border-line-strong px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} />
            VIP
          </label>
          <button
            type="submit"
            disabled={!name.trim() || action.busy}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            新增
          </button>
        </form>
      )}

      {active.length === 0 ? (
        <p className="py-8 text-center text-faint">名冊是空的。建立場次時輸入名字，也會自動加進來。</p>
      ) : (
        <MemberList members={active} canEdit={canEdit} busy={action.busy} onRename={rename} onUpdate={update} />
      )}

      {inactive.length > 0 && (
        <details className="rounded-xl bg-surface shadow-sm">
          <summary className="cursor-pointer px-3 py-2 text-sm text-muted">已停用（{inactive.length}）</summary>
          <MemberList members={inactive} canEdit={canEdit} busy={action.busy} onRename={rename} onUpdate={update} />
        </details>
      )}

      <p className="text-xs text-faint">
        停用的成員不會出現在出席名單，但舊場次照常顯示。VIP 身分的變更只影響之後建立的場次。
      </p>
    </div>
  )
}

function MemberList({
  members,
  canEdit,
  busy,
  onRename,
  onUpdate,
}: {
  members: Member[]
  canEdit: boolean
  busy: boolean
  onRename: (m: Member) => void
  onUpdate: (m: Member, changes: { isVip?: boolean; isActive?: boolean }) => void
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p>
              {m.name}
              {m.is_vip && <span className="ml-1 text-xs text-warn">VIP</span>}
            </p>
            <p className="text-xs text-faint">
              {m.sessions_count > 0 ? `來過 ${m.sessions_count} 次・最近 ${formatDay(m.last_played_on!)}` : '還沒出席過'}
            </p>
          </div>
          {canEdit && (
            <>
              <SmallButton disabled={busy} onClick={() => onUpdate(m, { isVip: !m.is_vip })}>
                {m.is_vip ? '取消 VIP' : '設為 VIP'}
              </SmallButton>
              <SmallButton disabled={busy} onClick={() => onRename(m)}>
                改名
              </SmallButton>
              <SmallButton disabled={busy} onClick={() => onUpdate(m, { isActive: !m.is_active })}>
                {m.is_active ? '停用' : '啟用'}
              </SmallButton>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

function SmallButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted active:bg-subtle disabled:opacity-40"
    >
      {children}
    </button>
  )
}
