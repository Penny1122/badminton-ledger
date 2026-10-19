import dayjs from 'dayjs'
import { Link } from 'react-router'
import ShareButtons from '../components/ShareButtons'
import { formatDay, formatTWD } from '../lib/format'
import {
  ballFund,
  useDebtors,
  useLedgerSummary,
  useMonthTransactions,
  useSettings,
  useSystemTotals,
  type Debtor,
} from '../lib/ledger'

export default function DashboardPage() {
  const month = dayjs().format('YYYY-MM')
  const summary = useLedgerSummary()
  const totals = useSystemTotals()
  const debtors = useDebtors()
  const monthTxns = useMonthTransactions(month)
  const settings = useSettings()

  if (summary.isLoading) return <p className="text-muted">載入中…</p>
  if (summary.error) return <p className="text-danger">讀取失敗：{summary.error.message}</p>
  if (!summary.data) return null

  const { balance, outstanding } = summary.data
  const active = (monthTxns.data ?? []).filter((t) => t.voided_at === null)
  const monthIncome = active.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const monthExpense = active.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const fund = totals.data ? ballFund(totals.data) : null

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-accent p-4 text-on-accent shadow-sm">
        <p className="text-sm text-on-accent/80">💰 實際餘額</p>
        <p className="text-3xl font-bold tabular-nums">{formatTWD(balance)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-on-accent/25 pt-3 text-sm">
          <div>
            <p className="text-on-accent/80">📋 待收款</p>
            <p className="text-lg font-semibold tabular-nums">{formatTWD(outstanding)}</p>
          </div>
          <div>
            <p className="text-on-accent/80">📈 收齊後</p>
            <p className="text-lg font-semibold tabular-nums">{formatTWD(balance + outstanding)}</p>
          </div>
        </div>
      </div>

      <Link to="/transactions" className="block rounded-xl bg-surface p-3 shadow-sm active:bg-subtle">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted">{dayjs().format('M 月')}收支</p>
          <span className="text-xs text-faint">看明細 ›</span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2 tabular-nums">
          <div>
            <p className="text-xs text-faint">收入</p>
            <p className="font-semibold text-accent-ink">{formatTWD(monthIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-faint">支出</p>
            <p className="font-semibold text-danger">{formatTWD(monthExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-faint">結餘</p>
            <p className="font-semibold">{formatTWD(monthIncome - monthExpense)}</p>
          </div>
        </div>
      </Link>

      {fund !== null && totals.data && (
        <div className="rounded-xl bg-surface p-3 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">🏸 球款水位</p>
            <p className={`text-xl font-bold tabular-nums ${fund < 0 ? 'text-danger' : ''}`}>{formatTWD(fund)}</p>
          </div>
          <p className="mt-1 text-xs text-faint tabular-nums">
            VIP 球款 {formatTWD(totals.data.vip_ball ?? 0)} ＋ 球費 {formatTWD(totals.data.ball_fee ?? 0)} － 買球{' '}
            {formatTWD(totals.data.shuttlecock ?? 0)}
          </p>
          {fund < 0 && <p className="mt-1 text-sm text-danger">買球的錢已經超支，可以收下一輪 VIP 球款了。</p>}
        </div>
      )}

      <DebtorList debtors={debtors.data ?? []} loading={debtors.isLoading} />

      <div className="pt-1">
        <ShareButtons
          text={summaryText({
            groupName: settings.data?.group_name ?? '羽球團',
            balance,
            outstanding,
            fund,
            debtors: debtors.data ?? [],
          })}
        />
      </div>
    </div>
  )
}

function DebtorList({ debtors, loading }: { debtors: Debtor[]; loading: boolean }) {
  if (loading) return null
  if (debtors.length === 0) {
    return <p className="rounded-xl bg-surface p-3 text-center text-sm text-accent-ink shadow-sm">✓ 大家都付清了</p>
  }

  return (
    <section>
      <h2 className="mb-1 px-1 text-sm text-muted">還沒付款（{debtors.length} 人）</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm">
        {debtors.map((d) => (
          <li key={d.name} className="px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{d.name}</span>
              <span className="font-semibold text-warn tabular-nums">{formatTWD(d.total)}</span>
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {d.items.map((item) => (
                <li key={item.receivableId}>
                  <Link to={item.to} className="flex justify-between text-xs text-muted">
                    <span>
                      {formatDay(item.date)} {item.label}
                    </span>
                    <span className="tabular-nums">{formatTWD(item.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 首頁分享到 LINE 的文字 */
function summaryText({
  groupName,
  balance,
  outstanding,
  fund,
  debtors,
}: {
  groupName: string
  balance: number
  outstanding: number
  fund: number | null
  debtors: Debtor[]
}) {
  const lines = [
    `🏸 ${groupName} 帳目（${formatDay(dayjs().format('YYYY-MM-DD'))}）`,
    `💰 目前餘額：${formatTWD(balance)}`,
    `📋 待收款：${formatTWD(outstanding)}`,
  ]
  if (fund !== null) lines.push(`🏸 球款水位：${formatTWD(fund)}`)
  if (debtors.length > 0) {
    lines.push('', '還沒付款：', ...debtors.map((d) => `・${d.name} ${formatTWD(d.total)}`))
  }
  lines.push('', `查看明細：${window.location.origin}`)
  return lines.join('\n')
}
