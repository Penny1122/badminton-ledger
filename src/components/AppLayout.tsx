import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useEditMode } from '../lib/editMode'
import { useSettings } from '../lib/ledger'
import { useTheme } from '../lib/theme'

/** 底部分頁；icon 是 24×24 的線條圖，跟著文字顏色 */
const tabs = [
  { to: '/', label: '首頁', end: true, icon: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9' },
  { to: '/transactions', label: '帳務', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  {
    to: '/sessions',
    label: '活動',
    icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  },
  {
    to: '/settings',
    label: '設定',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  },
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
      {/* 底部留出導覽列＋iPhone Home 指示條的高度 */}
      <main className="flex-1 p-4 pb-[calc(var(--nav-height)+env(safe-area-inset-bottom)+1.5rem)]">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid h-(--nav-height) max-w-lg grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex h-full flex-col items-center justify-center gap-1 text-xs ${
                    isActive ? 'font-semibold text-accent-ink' : 'text-muted'
                  }`
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
