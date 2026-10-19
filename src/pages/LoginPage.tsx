import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('登入失敗，請確認帳號密碼')
    setSubmitting(false)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-center text-2xl font-bold">🏸 羽球記帳</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="密碼"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  )
}
