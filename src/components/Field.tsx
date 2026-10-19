import type { ReactNode } from 'react'

export default function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-ink-2">
        {label}
      </label>
      {children}
    </div>
  )
}
