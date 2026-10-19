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
