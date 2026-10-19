import { useState, type FormEvent } from 'react'
import { useEditMode } from '../lib/editMode'
import {
  reorderCategories,
  saveCategory,
  setCategoryArchived,
  TXN_TYPE_LABEL,
  useCategories,
  type Category,
  type TxnType,
} from '../lib/ledger'
import { useEditAction } from '../lib/useEditAction'

export default function CategoriesPage() {
  const categories = useCategories()
  const action = useEditAction()

  if (categories.isLoading) return <p className="text-slate-500">載入中…</p>
  if (categories.error) return <p className="text-red-600">讀取失敗：{categories.error.message}</p>

  const all = categories.data ?? []
  const archived = all.filter((c) => c.archived_at !== null)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">分類管理</h1>
      {action.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {action.error}
        </p>
      )}
      {(['income', 'expense'] as const).map((type) => (
        <TypeSection
          key={type}
          type={type}
          items={all.filter((c) => c.type === type && c.archived_at === null)}
          action={action}
        />
      ))}
      {archived.length > 0 && <ArchivedSection items={archived} action={action} />}
      <p className="text-xs text-slate-400">
        標示「系統」的分類會被場次和收款單自動記帳用到，可以改名但不能封存。封存的分類不能再選，但舊紀錄照常顯示。
      </p>
    </div>
  )
}

type Action = ReturnType<typeof useEditAction>

function TypeSection({ type, items, action }: { type: TxnType; items: Category[]; action: Action }) {
  const { canEdit } = useEditMode()
  const [name, setName] = useState('')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed.length > 20) return action.setError('分類名稱最多 20 個字')
    const ok = await action.run((password) => saveCategory(password, { id: null, type, name: trimmed }))
    if (ok) setName('')
  }

  function move(index: number, delta: number) {
    const ids = items.map((c) => c.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    void action.run((password) => reorderCategories(password, type, ids))
  }

  function rename(category: Category) {
    const next = window.prompt('新的分類名稱', category.name)?.trim()
    if (!next || next === category.name) return
    if (next.length > 20) return action.setError('分類名稱最多 20 個字')
    void action.run((password) => saveCategory(password, { id: category.id, type, name: next }))
  }

  function archive(category: Category) {
    if (!window.confirm(`封存「${category.name}」？之後記帳就不能再選這個分類。`)) return
    void action.run((password) => setCategoryArchived(password, category.id, true))
  }

  return (
    <section>
      <h2 className={`mb-1 px-1 text-sm font-semibold ${type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
        {TXN_TYPE_LABEL[type]}
      </h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm">
        {items.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1">
              {c.name}
              {c.system_key && <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-xs text-slate-500">系統</span>}
            </span>
            {canEdit && (
              <>
                <IconButton label="上移" disabled={i === 0 || action.busy} onClick={() => move(i, -1)}>
                  ↑
                </IconButton>
                <IconButton label="下移" disabled={i === items.length - 1 || action.busy} onClick={() => move(i, 1)}>
                  ↓
                </IconButton>
                <IconButton label="改名" disabled={action.busy} onClick={() => rename(c)}>
                  ✎
                </IconButton>
                {!c.system_key && (
                  <IconButton label="封存" disabled={action.busy} onClick={() => archive(c)}>
                    🗄
                  </IconButton>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={handleAdd} className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder={`新增${TXN_TYPE_LABEL[type]}分類`}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={!name.trim() || action.busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            新增
          </button>
        </form>
      )}
    </section>
  )
}

function ArchivedSection({ items, action }: { items: Category[]; action: Action }) {
  const { canEdit } = useEditMode()

  return (
    <details className="rounded-xl bg-white shadow-sm">
      <summary className="cursor-pointer px-3 py-2 text-sm text-slate-500">已封存（{items.length}）</summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-slate-500">
            <span className="flex-1">
              {TXN_TYPE_LABEL[c.type]}・{c.name}
            </span>
            {canEdit && (
              <button
                type="button"
                disabled={action.busy}
                onClick={() => void action.run((password) => setCategoryArchived(password, c.id, false))}
                className="text-sm text-emerald-700 disabled:opacity-50"
              >
                還原
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-md text-slate-500 active:bg-slate-100 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
