import type { ReactNode } from 'react'

export default function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    // min-w-0：放在 grid 裡時允許縮小，不被內容（例如 iOS 日期欄位）撐開
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-ink-2">
        {label}
      </label>
      {children}
    </div>
  )
}
