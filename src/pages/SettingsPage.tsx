import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import Field from '../components/Field'
import { useEditMode } from '../lib/editMode'
import { updateSettings, useSettings, type Settings } from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

const items = [
  { to: '/settings/members', label: '成員名冊', hint: 'VIP、停用' },
  { to: '/settings/categories', label: '分類管理', hint: '收入、支出分類' },
]

export default function SettingsPage() {
  const settings = useSettings()

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">設定</h1>
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm">
        {items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="flex items-center justify-between px-3 py-3 active:bg-subtle">
              <span>{item.label}</span>
              <span className="text-sm text-faint">{item.hint} ›</span>
            </Link>
          </li>
        ))}
      </ul>
      {settings.data && <GroupSettings key={JSON.stringify(settings.data)} initial={settings.data} />}
    </div>
  )
}

function GroupSettings({ initial }: { initial: Settings }) {
  const { canEdit } = useEditMode()
  const { run, busy, error, setError } = useEditAction()
  const [groupName, setGroupName] = useState(initial.group_name)
  const [surcharge, setSurcharge] = useState(String(initial.surcharge))
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    if (!groupName.trim()) return setError('請填寫群組名稱')
    const ok = await run((password) =>
      updateSettings(password, { group_name: groupName.trim(), surcharge: Number(surcharge) || 0 }),
    )
    if (ok) setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-xl bg-surface p-3 shadow-sm">
      <h2 className="font-semibold">群組設定</h2>
      <Field label="群組名稱" htmlFor="group-name">
        <input
          id="group-name"
          value={groupName}
          disabled={!canEdit}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={30}
          className="w-full rounded-lg border border-line-strong px-3 py-2 disabled:bg-subtle"
        />
      </Field>
      <Field label="非 VIP 每次加收（球費）" htmlFor="surcharge">
        <input
          id="surcharge"
          inputMode="numeric"
          pattern="[0-9]*"
          value={surcharge}
          disabled={!canEdit}
          onChange={(e) => setSurcharge(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-lg border border-line-strong px-3 py-2 tabular-nums disabled:bg-subtle"
        />
        <p className="mt-1 text-xs text-faint">只影響之後建立的場次，舊場次的金額不會變。</p>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-accent-ink">已儲存</p>}
      {canEdit && (
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent py-2 font-semibold text-on-accent disabled:opacity-50"
        >
          {busy ? '儲存中…' : '儲存'}
        </button>
      )}
    </form>
  )
}
