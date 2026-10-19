import dayjs from 'dayjs'
import { Link, useSearchParams } from 'react-router'
import { useEditMode } from '../lib/editMode'
import { formatDay, formatSigned, formatTWD } from '../lib/format'
import { isLinked, TXN_TYPE_LABEL, useCategories, useMonthTransactions, type Transaction, type TxnType } from '../lib/ledger'

const TYPE_FILTERS: { value: '' | TxnType; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'income', label: '收入' },
  { value: 'expense', label: '支出' },
]

export default function TransactionsPage() {
  const { canEdit } = useEditMode()
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? dayjs().format('YYYY-MM')
  const type = (params.get('type') ?? '') as '' | TxnType
  const categoryId = params.get('category') ?? ''
  const q = params.get('q') ?? ''
  const showVoided = params.get('voided') === '1'

  const categories = useCategories()
  const transactions = useMonthTransactions(month)

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

  function shiftMonth(delta: number) {
    setParam('month', dayjs(`${month}-01`).add(delta, 'month').format('YYYY-MM'))
  }

  const categoryName = new Map(categories.data?.map((c) => [c.id, c.name]))
  const all = transactions.data ?? []
  const active = all.filter((t) => t.voided_at === null)
  const income = active.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expense = active.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

  const keyword = q.trim().toLowerCase()
  const visible = all.filter(
    (t) =>
      (showVoided || t.voided_at === null) &&
      (!type || t.type === type) &&
      (!categoryId || t.category_id === categoryId) &&
      (!keyword ||
        (t.note ?? '').toLowerCase().includes(keyword) ||
        (categoryName.get(t.category_id) ?? '').toLowerCase().includes(keyword)),
  )

  const byDay = new Map<string, Transaction[]>()
  for (const t of visible) byDay.set(t.occurred_on, [...(byDay.get(t.occurred_on) ?? []), t])

  const categoryOptions = (categories.data ?? []).filter((c) => !type || c.type === type)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">金流紀錄</h1>
        {canEdit && (
          <Link to="/transactions/new" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">
            ＋ 記一筆
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-white p-2 shadow-sm">
        <button type="button" onClick={() => shiftMonth(-1)} className="px-3 py-1 text-slate-500" aria-label="上個月">
          ‹
        </button>
        <span className="font-semibold">{dayjs(`${month}-01`).format('YYYY 年 M 月')}</span>
        <button type="button" onClick={() => shiftMonth(1)} className="px-3 py-1 text-slate-500" aria-label="下個月">
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="收入" value={formatTWD(income)} className="text-emerald-600" />
        <Stat label="支出" value={formatTWD(expense)} className="text-red-600" />
        <Stat label="結餘" value={formatTWD(income - expense)} />
      </div>

      <div className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setParam('type', f.value)
                setParam('category', '')
              }}
              className={`rounded-md py-1 text-sm ${type === f.value ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setParam('category', e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            aria-label="分類"
          >
            <option value="">所有分類</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {type ? '' : `${TXN_TYPE_LABEL[c.type]}・`}
                {c.name}
                {c.archived_at ? '（已封存）' : ''}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="搜尋備註"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={showVoided} onChange={(e) => setParam('voided', e.target.checked ? '1' : '')} />
          顯示已作廢
        </label>
      </div>

      {transactions.isLoading && <p className="text-slate-500">載入中…</p>}
      {transactions.error && <p className="text-red-600">讀取失敗：{transactions.error.message}</p>}
      {transactions.data && visible.length === 0 && <p className="py-8 text-center text-slate-400">這個月沒有符合的紀錄</p>}

      {[...byDay].map(([day, items]) => (
        <section key={day}>
          <h2 className="mb-1 px-1 text-sm text-slate-500">{formatDay(day)}</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm">
            {items.map((t) => (
              <li key={t.id}>
                <TransactionRow txn={t} categoryName={categoryName.get(t.category_id) ?? '（未知分類）'} canEdit={canEdit} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-white p-2 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  )
}

function TransactionRow({ txn, categoryName, canEdit }: { txn: Transaction; categoryName: string; canEdit: boolean }) {
  const voided = txn.voided_at !== null
  const content = (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${voided ? 'opacity-50' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${voided ? 'line-through' : ''}`}>
          {categoryName}
          {isLinked(txn) && <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-xs font-normal text-slate-500">自動</span>}
        </p>
        {txn.note && <p className="truncate text-sm text-slate-500">{txn.note}</p>}
        {voided && <p className="text-xs text-red-600">已作廢{txn.void_reason ? `：${txn.void_reason}` : ''}</p>}
      </div>
      <span
        className={`font-semibold tabular-nums ${voided ? 'line-through' : ''} ${
          txn.type === 'income' ? 'text-emerald-600' : 'text-red-600'
        }`}
      >
        {formatSigned(txn.type, txn.amount)}
      </span>
    </div>
  )

  if (canEdit && !voided && !isLinked(txn)) {
    return (
      <Link to={`/transactions/${txn.id}`} className="block active:bg-slate-50">
        {content}
      </Link>
    )
  }
  return content
}
