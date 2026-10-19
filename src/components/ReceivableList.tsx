import { formatTWD } from '../lib/format'
import { setReceivablePaid, type Receivable } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

/** 應收款清單：解鎖後可以勾選已付款，勾選時自動記收入 */
export default function ReceivableList({
  receivables,
  canEdit,
  showBreakdown,
}: {
  receivables: Receivable[]
  canEdit: boolean
  /** 顯示「場地 + 球費」的拆分（場次用） */
  showBreakdown?: boolean
}) {
  const { run, busy, error } = useEditAction()
  const paid = receivables.filter((r) => r.paid_at !== null)
  const paidTotal = paid.reduce((sum, r) => sum + r.amount_due, 0)
  const total = receivables.reduce((sum, r) => sum + r.amount_due, 0)

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-semibold">
          收款 {paid.length}/{receivables.length}
        </h2>
        <span className="text-sm text-slate-500 tabular-nums">
          已收 {formatTWD(paidTotal)}・待收 <span className="text-amber-600">{formatTWD(total - paidTotal)}</span>
        </span>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm">
        {receivables.map((r) => {
          const isPaid = r.paid_at !== null
          const row = (
            <>
              <span className="flex-1">
                {r.member.name}
                {r.is_vip && <span className="ml-1 text-xs text-amber-600">VIP</span>}
              </span>
              <span className="text-right tabular-nums">
                <span className={isPaid ? 'text-slate-400' : 'font-semibold'}>{formatTWD(r.amount_due)}</span>
                {showBreakdown && r.surcharge_amount > 0 && (
                  <span className="block text-xs text-slate-400">
                    {r.share_amount} + 球費 {r.surcharge_amount}
                  </span>
                )}
              </span>
            </>
          )
          return (
            <li key={r.id}>
              {canEdit ? (
                <label className={`flex items-center gap-3 px-3 py-2.5 ${busy ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isPaid}
                    disabled={busy}
                    onChange={(e) => void run((password) => setReceivablePaid(password, r.id, e.target.checked))}
                    className="h-5 w-5 accent-emerald-600"
                  />
                  {row}
                </label>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`w-5 text-center ${isPaid ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {isPaid ? '✓' : '○'}
                  </span>
                  {row}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
