import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useEditMode } from '../lib/editMode'
import { useSettings } from '../lib/ledger'
import { useTheme } from '../lib/theme'

const tabs = [
  { to: '/', label: '首頁', end: true },
  { to: '/transactions', label: '帳務' },
  { to: '/sessions', label: '活動' },
  { to: '/settings', label: '設定' },
]

/** 上一層：/sessions/abc/edit → /sessions/abc → /sessions；/unlock → / */
function parentPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return '/' + parts.slice(0, -1).join('/')
}

export default function AppLayout() {
  const { canEdit, lock } = useEditMode()
  const settings = useSettings()
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // 底部分頁本身不顯示返回鍵，其他頁面都有
  const isTabRoot = tabs.some((t) => t.to === pathname)

  function handleLock() {
    if (window.confirm('要鎖定嗎？鎖定後需要重新輸入編輯密碼。')) lock()
  }

  function goBack() {
    // 從 LINE 或書籤直接打開時沒有上一頁，改回上一層
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(parentPath(pathname), { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        {isTabRoot ? (
          <span className="font-bold">🏸 {settings.data?.group_name ?? '羽球記帳'}</span>
        ) : (
          <button type="button" onClick={goBack} className="-ml-1 flex items-center gap-1 px-1 font-semibold text-accent-ink">
            <span className="text-xl leading-none">‹</span> 返回
          </button>
        )}
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
