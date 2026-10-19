import { Link, NavLink, Outlet } from 'react-router'
import { useEditMode } from '../lib/editMode'
import { useSettings } from '../lib/ledger'

const tabs = [
  { to: '/', label: '首頁', end: true },
  { to: '/transactions', label: '金流' },
  { to: '/sessions', label: '場次' },
  { to: '/settings', label: '設定' },
]

export default function AppLayout() {
  const { canEdit, lock } = useEditMode()
  const settings = useSettings()

  function handleLock() {
    if (window.confirm('要鎖定嗎？鎖定後需要重新輸入編輯密碼。')) lock()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="font-bold">🏸 {settings.data?.group_name ?? '羽球記帳'}</span>
        {canEdit ? (
          <button
            type="button"
            onClick={handleLock}
            className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700"
          >
            🔓 已解鎖
          </button>
        ) : (
          <Link to="/unlock" className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            🔒 唯讀
          </Link>
        )}
      </header>
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
