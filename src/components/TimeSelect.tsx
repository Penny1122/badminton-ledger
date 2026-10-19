const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

/**
 * 時、分兩個下拉選單。value 是 HH:MM，空字串代表不設定。
 * 選了小時、分鐘還沒選時自動帶 00（瀏覽器內建的時間欄位做不到）。
 */
export default function TimeSelect({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
}) {
  const [hour, minute] = value ? value.split(':') : ['', '']
  // 舊資料的分鐘不在選項裡（例如 19:10）時也要顯示得出來
  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES

  const selectClass = 'min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-2 tabular-nums'

  return (
    <div className="flex items-center gap-1">
      <select
        id={id}
        value={hour}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${minute || '00'}` : '')}
        aria-label="時"
        className={selectClass}
      >
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-muted">:</span>
      <select
        value={minute}
        disabled={!hour}
        onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        aria-label="分"
        className={`${selectClass} disabled:opacity-50`}
      >
        {!hour && <option value="">--</option>}
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
