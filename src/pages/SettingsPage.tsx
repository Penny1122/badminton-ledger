import { Link } from 'react-router'

const items = [{ to: '/settings/categories', label: '分類管理', hint: '收入、支出分類' }]

export default function SettingsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">設定</h1>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm">
        {items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="flex items-center justify-between px-3 py-3 active:bg-slate-50">
              <span>{item.label}</span>
              <span className="text-sm text-slate-400">{item.hint} ›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
