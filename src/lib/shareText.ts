import { formatDay, formatTimeRange, formatTWD } from './format'
import { SESSION_FEE_LABEL, type Session, type Venue } from './ledger'

/**
 * 活動分享到 LINE 的文字，依日期由舊到新，直接從日期開始：
 *
 *   📅 10/19（一）19:00–21:00
 *   📍 中正運動中心（2 面場） https://maps.app.goo.gl/…
 *   💰 場地費 $1,200（教練課是教練費）
 *   參加（4 人）：大樹、阿倪、阿明、小華
 *   👉 報名：https://…/sessions/<id>
 *
 * 場地在常用場地裡有地圖連結時自動帶入。
 */
export function sessionsShareText(sessions: Session[], venues: Venue[]) {
  const mapUrls = new Map(venues.map((v) => [v.name, v.map_url]))
  const blocks: string[] = []

  for (const s of [...sessions].sort(
    (a, b) => a.played_on.localeCompare(b.played_on) || (a.start_time ?? '').localeCompare(b.start_time ?? ''),
  )) {
    const time = formatTimeRange(s.start_time, s.end_time)
    const courts = s.courts ? `${s.courts} 面場` : ''
    const lines = [`📅 ${formatDay(s.played_on)}${time ? ` ${time}` : ''}${s.kind === 'coaching' ? '（教練課）' : ''}`]
    if (s.venue) {
      const url = mapUrls.get(s.venue)
      lines.push(`📍 ${s.venue}${courts ? `（${courts}）` : ''}${url ? ` ${url}` : ''}`)
    } else if (courts) {
      lines.push(`🏸 ${courts}`)
    }
    lines.push(`💰 ${SESSION_FEE_LABEL[s.kind]} ${formatTWD(s.court_fee)}`)
    lines.push(`參加（${s.receivables.length} 人）：${s.receivables.map((r) => r.member.name).join('、')}`)
    lines.push(`👉 報名：${window.location.origin}/sessions/${s.id}`)
    blocks.push(lines.join('\n'))
  }

  return blocks.join('\n\n')
}
