import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useEditMode } from '../lib/editMode'

export default function UnlockPage() {
  const { canEdit, notice, unlock } = useEditMode()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (canEdit) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    const message = await unlock(password)
    setSubmitting(false)
    if (message) setError(message)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-4">
      <div className="space-y-2 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-ink-2">目前為唯讀模式</p>
        <p className="text-sm text-muted">輸入編輯密碼後，才能新增、編輯、作廢帳目。</p>
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
          {notice}
        </p>
      )}

      <div>
        <label htmlFor="edit-password" className="mb-1.5 block text-sm text-ink-2">
          編輯密碼
        </label>
        <input
          id="edit-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 ${error ? 'border-danger' : 'border-line-strong'}`}
        />
        {error && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!password || submitting}
        className="w-full rounded-lg bg-accent py-2 font-semibold text-on-accent disabled:opacity-50"
      >
        {submitting ? '確認中…' : '解鎖'}
      </button>

      <p className="text-center text-xs text-faint">解鎖後這台裝置會記住，點右上角「已解鎖」可以鎖定。</p>
    </form>
  )
}
