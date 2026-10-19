import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

type Summary = { balance: number; outstanding: number }

function formatTWD(n: number) {
  return `$${n.toLocaleString('zh-TW')}`
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger_summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ledger_summary').select('balance, outstanding').single()
      if (error) throw error
      return data as Summary
    },
  })

  if (isLoading) return <p className="text-slate-500">載入中…</p>
  if (error) return <p className="text-red-600">讀取失敗：{error.message}</p>
  if (!data) return null

  const cards = [
    { label: '💰 實際餘額', value: data.balance },
    { label: '📋 待收款', value: data.outstanding },
    { label: '📈 預估餘額', value: data.balance + data.outstanding },
  ]

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">首頁</h1>
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className="text-2xl font-bold tabular-nums">{formatTWD(card.value)}</p>
        </div>
      ))}
    </div>
  )
}
