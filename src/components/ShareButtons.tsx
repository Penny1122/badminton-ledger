import { useState } from 'react'

/** 分享到 LINE ＋ 複製文字。disabled 時兩個按鈕都不能按 */
export default function ShareButtons({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('複製下面的文字', text)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <a
        href={disabled ? undefined : `https://line.me/R/share?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        aria-disabled={disabled}
        className={`rounded-lg bg-[#06C755] py-2.5 text-center font-semibold text-white ${
          disabled ? 'pointer-events-none opacity-40' : ''
        }`}
      >
        分享到 LINE
      </a>
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        className="rounded-lg border border-line-strong bg-surface py-2.5 font-semibold disabled:opacity-40"
      >
        {copied ? '已複製 ✓' : '複製文字'}
      </button>
    </div>
  )
}
