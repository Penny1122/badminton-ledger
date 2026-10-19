import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import Field from '../components/Field'
import { today } from '../lib/format'
import {
  isLinked,
  saveTransaction,
  TXN_TYPE_LABEL,
  useCategories,
  useTransaction,
  voidTransaction,
  type Transaction,
  type TxnType,
} from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

/** 新增：/transactions/new；編輯：/transactions/:id */
export default function TransactionFormPage() {
  const { id } = useParams()
  const existing = useTransaction(id)

  if (id === undefined) return <TransactionForm key="new" existing={null} />
  if (existing.isLoading) return <p className="text-muted">載入中…</p>
  if (existing.error) return <p className="text-danger">讀取失敗：{existing.error.message}</p>

  const txn = existing.data
  if (!txn || txn.voided_at !== null) return <p className="text-muted">找不到這筆紀錄，可能已被作廢。</p>
  if (isLinked(txn)) return <p className="text-muted">這筆是活動或收款單自動產生的，請到原本的地方修改。</p>

  return <TransactionForm key={txn.id} existing={txn} />
}

function TransactionForm({ existing }: { existing: Transaction | null }) {
  const navigate = useNavigate()
  const categories = useCategories()
  const { run, busy, error, setError } = useEditAction()

  const [type, setType] = useState<TxnType>(existing?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [occurredOn, setOccurredOn] = useState(existing?.occurred_on ?? today())
  const [note, setNote] = useState(existing?.note ?? '')

  // 封存的分類不能選；編輯時維持原本的分類則可以
  const options = (categories.data ?? []).filter(
    (c) => c.type === type && (c.archived_at === null || c.id === existing?.category_id),
  )

  function changeType(next: TxnType) {
    setType(next)
    setCategoryId('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!categoryId) return setError('請選擇分類')
    if (!Number.isInteger(value) || value <= 0) return setError('金額要是大於 0 的整數')
    if (!occurredOn) return setError('請選擇日期')
    if (note.trim().length > 200) return setError('備註最多 200 個字')

    const ok = await run((password) =>
      saveTransaction(password, { id: existing?.id ?? null, type, categoryId, amount: value, occurredOn, note }),
    )
    if (ok) navigate(-1)
  }

  async function handleVoid() {
    if (!existing) return
    const reason = window.prompt('作廢這筆紀錄？可以填寫原因（選填）')
    if (reason === null) return
    const ok = await run((password) => voidTransaction(password, existing.id, reason))
    if (ok) navigate(-1)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h1 className="text-xl font-bold">{existing ? '編輯紀錄' : '記一筆'}</h1>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeType(t)}
            className={`rounded-md py-2 font-semibold ${
              type === t ? `bg-surface shadow-sm ${t === 'income' ? 'text-accent-ink' : 'text-danger'}` : 'text-muted'
            }`}
          >
            {TXN_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <Field label="分類">
        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                categoryId === c.id ? 'border-accent-ink bg-accent-soft text-accent-ink' : 'border-line-strong bg-surface'
              }`}
            >
              {c.name}
            </button>
          ))}
          {categories.isLoading && <span className="text-sm text-faint">載入中…</span>}
        </div>
      </Field>

      <Field label="金額" htmlFor="amount">
        <input
          id="amount"
          inputMode="numeric"
          pattern="[0-9]*"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
          placeholder="0"
          className="w-full rounded-lg border border-line-strong px-3 py-2 text-lg tabular-nums"
        />
      </Field>

      <Field label="日期" htmlFor="occurred-on">
        <input
          id="occurred-on"
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2"
        />
      </Field>

      <Field label="備註（選填）" htmlFor="note">
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="例如：勝利羽球 3 打"
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

      {existing && (
        <button
          type="button"
          onClick={handleVoid}
          disabled={busy}
          className="w-full rounded-lg border border-danger/40 py-2.5 font-semibold text-danger disabled:opacity-50"
        >
          作廢這筆
        </button>
      )}
    </form>
  )
}
