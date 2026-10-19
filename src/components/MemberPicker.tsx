import { useState, type KeyboardEvent } from 'react'
import type { Member } from '../lib/ledger'

type Props = {
  members: Member[]
  selected: Set<string>
  onToggle: (id: string) => void
  /** 第一次來、要新增到名冊的名字；不傳就不能新增 */
  newNames?: string[]
  onNewNamesChange?: (names: string[]) => void
}

/** 點選出席者；輸入名字時，名冊裡已經有的人直接選取，沒有的才新增 */
export default function MemberPicker({ members, selected, onToggle, newNames, onNewNamesChange }: Props) {
  const [input, setInput] = useState('')
  // 已停用的成員不列出，但編輯舊場次時已選的人要看得到
  const visible = members.filter((m) => m.is_active || selected.has(m.id))

  function addName() {
    const name = input.trim()
    if (!name || !newNames || !onNewNamesChange) return
    const existing = members.find((m) => m.name === name)
    if (existing) {
      if (!selected.has(existing.id)) onToggle(existing.id)
    } else if (!newNames.includes(name)) {
      onNewNamesChange([...newNames, name])
    }
    setInput('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addName()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {visible.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggle(m.id)}
            aria-pressed={selected.has(m.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              selected.has(m.id) ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white'
            }`}
          >
            {m.name}
            {m.is_vip && <span className="ml-1 text-xs text-amber-600">VIP</span>}
          </button>
        ))}
        {newNames?.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onNewNamesChange?.(newNames.filter((n) => n !== name))}
            className="rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-sm text-emerald-700"
            title="點一下移除"
          >
            {name}
            <span className="ml-1 text-xs text-slate-500">新 ✕</span>
          </button>
        ))}
      </div>
      {newNames && (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={20}
            placeholder="第一次來？輸入名字"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={addName}
            disabled={!input.trim()}
            className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm text-emerald-700 disabled:opacity-40"
          >
            加入
          </button>
        </div>
      )}
    </div>
  )
}
