import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import Field from '../components/Field'
import MemberPicker from '../components/MemberPicker'
import { formatTWD, today } from '../lib/format'
import { saveCollection, useCollection, useCollections, useMembers, type Collection, type Member } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

/** 新增：/collections/new；編輯：/collections/:id/edit */
export default function CollectionFormPage() {
  const { id } = useParams()
  const existing = useCollection(id)
  const members = useMembers()
  const collections = useCollections()

  if (members.isLoading || collections.isLoading || existing.isLoading) return <p className="text-slate-500">載入中…</p>
  const loadError = members.error ?? collections.error ?? existing.error
  if (loadError) return <p className="text-red-600">讀取失敗：{loadError.message}</p>

  if (id === undefined) {
    // 預設標題「VIP 球款 第 N 次」，預設選取所有 VIP
    const count = (collections.data ?? []).filter((c) => c.voided_at === null).length
    return (
      <CollectionForm
        key="new"
        existing={null}
        members={members.data ?? []}
        defaultTitle={`VIP 球款 第 ${count + 1} 次`}
      />
    )
  }
  if (!existing.data || existing.data.voided_at !== null) {
    return <p className="text-slate-500">找不到這張收款單，可能已被作廢。</p>
  }
  return <CollectionForm key={existing.data.id} existing={existing.data} members={members.data ?? []} defaultTitle="" />
}

function CollectionForm({
  existing,
  members,
  defaultTitle,
}: {
  existing: Collection | null
  members: Member[]
  defaultTitle: string
}) {
  const navigate = useNavigate()
  const { run, busy, error, setError } = useEditAction()

  const [title, setTitle] = useState(existing?.title ?? defaultTitle)
  const [collectedOn, setCollectedOn] = useState(existing?.collected_on ?? today())
  const [amount, setAmount] = useState(existing ? String(existing.receivables[0]?.share_amount ?? '') : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [selected, setSelected] = useState(
    () =>
      new Set(
        existing
          ? existing.receivables.map((r) => r.member_id)
          : members.filter((m) => m.is_vip && m.is_active).map((m) => m.id),
      ),
  )

  const hasPaid = existing?.receivables.some((r) => r.paid_at !== null) ?? false
  const value = Number(amount) || 0

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
    if (!title.trim()) return setError('請填寫標題')
    if (!collectedOn) return setError('請選擇日期')
    if (!Number.isInteger(value) || value <= 0) return setError('每人金額要是大於 0 的整數')
    if (selected.size === 0) return setError('至少要選 1 個人')

    const result = await run((password) =>
      saveCollection(password, {
        id: existing?.id ?? null,
        title,
        collectedOn,
        amount: value,
        note,
        memberIds: [...selected],
      }),
    )
    if (result) navigate(`/collections/${result.id}`, { replace: true })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h1 className="text-xl font-bold">{existing ? '編輯收款單' : '新增收款單'}</h1>

      {hasPaid && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          已經有人付款，只能改標題、日期和備註。要改金額或名單，請先取消勾選付款。
        </p>
      )}

      <Field label="標題" htmlFor="title">
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={30}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="日期" htmlFor="collected-on">
          <input
            id="collected-on"
            type="date"
            value={collectedOn}
            onChange={(e) => setCollectedOn(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </Field>
        <Field label="每人金額" htmlFor="amount">
          <input
            id="amount"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            disabled={hasPaid}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="例如 250"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 tabular-nums disabled:bg-slate-100"
          />
        </Field>
      </div>

      <Field label={`向誰收（${selected.size} 人）`}>
        {hasPaid ? (
          <p className="text-sm text-slate-500">{existing?.receivables.map((r) => r.member.name).join('、')}</p>
        ) : (
          <MemberPicker members={members} selected={selected} onToggle={toggle} />
        )}
      </Field>

      {selected.size > 0 && value > 0 && (
        <p className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
          {formatTWD(value)} × {selected.size} 人 = <span className="font-semibold">{formatTWD(value * selected.size)}</span>
        </p>
      )}

      <Field label="備註（選填）" htmlFor="note">
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {busy ? '儲存中…' : '儲存'}
      </button>
      <p className="text-center text-xs text-slate-400">收到錢時勾選，會自動記一筆「VIP 球款」收入。</p>
    </form>
  )
}
