import { Navigate, NavLink, Outlet } from 'react-router'
import { useAuth } from '../lib/auth'

const tabs = [
  { to: '/', label: '首頁', end: true },
  { to: '/transactions', label: '金流' },
  { to: '/sessions', label: '場次' },
  { to: '/settings', label: '設定' },
]

export default function AppLayout() {
  const { session, loading } = useAuth()

  if (loading) return <p className="p-6 text-center text-slate-500">載入中…</p>
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `block py-3 text-center text-sm ${isActive ? 'font-semibold text-emerald-600' : 'text-slate-500'}`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
