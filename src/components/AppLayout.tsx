import { Link, NavLink, Outlet } from 'react-router'
import { useEditMode } from '../lib/editMode'
import { useSettings } from '../lib/ledger'
import { useTheme } from '../lib/theme'

const tabs = [
  { to: '/', label: '首頁', end: true },
  { to: '/transactions', label: '金流' },
  { to: '/sessions', label: '場次' },
  { to: '/settings', label: '設定' },
]

export default function AppLayout() {
  const { canEdit, lock } = useEditMode()
  const settings = useSettings()
  const { theme, toggle } = useTheme()

  function handleLock() {
    if (window.confirm('要鎖定嗎？鎖定後需要重新輸入編輯密碼。')) lock()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <span className="font-bold">🏸 {settings.data?.group_name ?? '羽球記帳'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? '切換成淺色' : '切換成深色'}
            title={theme === 'dark' ? '切換成淺色' : '切換成深色'}
            className="h-8 w-8 rounded-full bg-subtle text-sm"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={handleLock}
              className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-ink"
            >
              🔓 已解鎖
            </button>
          ) : (
            <Link to="/unlock" className="rounded-full bg-subtle px-3 py-1 text-sm text-ink-2">
              🔒 唯讀
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `block py-3 text-center text-sm ${isActive ? 'font-semibold text-accent-ink' : 'text-muted'}`
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
