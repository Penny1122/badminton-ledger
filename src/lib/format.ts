import dayjs from 'dayjs'

export function formatTWD(n: number) {
  return `$${n.toLocaleString('zh-TW')}`
}

/** 收入加正號、支出加負號 */
export function formatSigned(type: 'income' | 'expense', amount: number) {
  return `${type === 'income' ? '+' : '-'}${formatTWD(amount)}`
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 2026-10-19 → 10/19（一） */
export function formatDay(date: string) {
  const d = dayjs(date)
  return `${d.format('M/D')}（${WEEKDAYS[d.day()]}）`
}

export function today() {
  return dayjs().format('YYYY-MM-DD')
}

/**
 * 19:00:00、21:30:00 → 19:00–21:30；結束比開始早代表跨日 → 22:00–01:00（跨日）
 * 只有開始時間 → 19:00 起；都沒有 → 空字串
 */
export function formatTimeRange(start: string | null, end: string | null) {
  const s = start?.slice(0, 5)
  const e = end?.slice(0, 5)
  if (s && e) return `${s}–${e}${e < s ? '（跨日）' : ''}`
  if (s) return `${s} 起`
  if (e) return `到 ${e}`
  return ''
}
