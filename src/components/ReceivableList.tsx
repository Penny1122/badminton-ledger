import { formatTWD } from '../lib/format'
import { setReceivablePaid, type Receivable } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

/** 應收款清單：解鎖後可以勾選已付款，勾選時自動記收入 */
export default function ReceivableList({
  receivables,
  canEdit,
  showBreakdown,
  onRemove,
  removeDisabled,
}: {
  receivables: Receivable[]
  canEdit: boolean
  /** 顯示「場地 + 球費」的拆分（活動用） */
  showBreakdown?: boolean
  /** 有傳就在每一列顯示 ✕（公開取消報名） */
  onRemove?: (r: Receivable) => void
  removeDisabled?: boolean
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
        <span className="text-sm text-muted tabular-nums">
          已收 {formatTWD(paidTotal)}・待收 <span className="text-warn">{formatTWD(total - paidTotal)}</span>
        </span>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm">
        {receivables.map((r) => {
          const isPaid = r.paid_at !== null
          const row = (
            <>
              <span className="flex-1">
                {r.member.name}
                {r.is_vip && <span className="ml-1 text-xs text-warn">VIP</span>}
              </span>
              <span className="text-right tabular-nums">
                <span className={isPaid ? 'text-faint' : 'font-semibold'}>{formatTWD(r.amount_due)}</span>
                {showBreakdown && r.surcharge_amount > 0 && (
                  <span className="block text-xs text-faint">
                    {r.share_amount} + 球費 {r.surcharge_amount}
                  </span>
                )}
              </span>
            </>
          )
          return (
            <li key={r.id} className="flex items-center">
              {canEdit ? (
                <label className={`flex flex-1 items-center gap-3 px-3 py-2.5 ${busy ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isPaid}
                    disabled={busy}
                    onChange={(e) => void run((password) => setReceivablePaid(password, r.id, e.target.checked))}
                    className="h-5 w-5 accent-accent"
                  />
                  {row}
                </label>
              ) : (
                <div className="flex flex-1 items-center gap-3 px-3 py-2.5">
                  <span className={`w-5 text-center ${isPaid ? 'text-accent-ink' : 'text-faint'}`}>
                    {isPaid ? '✓' : '○'}
                  </span>
                  {row}
                </div>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  disabled={removeDisabled}
                  aria-label={`取消 ${r.member.name} 的報名`}
                  title="取消報名"
                  className="mr-1 h-9 w-9 shrink-0 rounded-md text-faint active:bg-subtle disabled:opacity-30"
                >
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
