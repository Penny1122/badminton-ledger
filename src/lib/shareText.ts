import { formatDay, formatTimeRange } from './format'
import type { Session, Venue } from './ledger'

/**
 * 多個活動分享到 LINE 的文字，依日期由舊到新，列日期、時間、地點、參加成員：
 *
 *   📅 10/19（一）19:00–21:00
 *   📍 中正運動中心 https://maps.app.goo.gl/…
 *   參加（4 人）：大樹、阿倪、阿明、小華
 *   👉 報名：https://…/sessions/<id>
 *
 * 場地在常用場地裡有地圖連結時自動帶入。
 */
export function sessionsShareText(groupName: string, sessions: Session[], venues: Venue[]) {
  const mapUrls = new Map(venues.map((v) => [v.name, v.map_url]))
  const lines = [`🏸 ${groupName} 活動`]

  for (const s of [...sessions].sort(
    (a, b) => a.played_on.localeCompare(b.played_on) || (a.start_time ?? '').localeCompare(b.start_time ?? ''),
  )) {
    const time = formatTimeRange(s.start_time, s.end_time)
    lines.push('', `📅 ${formatDay(s.played_on)}${time ? ` ${time}` : ''}${s.kind === 'coaching' ? '（教練課）' : ''}`)
    if (s.venue) {
      const url = mapUrls.get(s.venue)
      lines.push(`📍 ${s.venue}${url ? ` ${url}` : ''}`)
    }
    lines.push(`參加（${s.receivables.length} 人）：${s.receivables.map((r) => r.member.name).join('、')}`)
    lines.push(`👉 報名：${window.location.origin}/sessions/${s.id}`)
  }

  return lines.join('\n')
}
