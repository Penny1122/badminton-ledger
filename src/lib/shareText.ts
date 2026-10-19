import { formatDay } from './format'
import type { Session } from './ledger'

/**
 * 多個場次分享到 LINE 的文字，依日期由舊到新，只列日期、地點、參加成員：
 *
 *   📅 10/19（一）・中正運動中心
 *   參加（4 人）：大樹、阿倪、阿明、小華
 */
export function sessionsShareText(groupName: string, sessions: Session[]) {
  const lines = [`🏸 ${groupName} 場次`]

  for (const s of [...sessions].sort((a, b) => a.played_on.localeCompare(b.played_on))) {
    lines.push(
      '',
      `📅 ${formatDay(s.played_on)}${s.venue ? `・${s.venue}` : ''}${s.kind === 'coaching' ? '（教練課）' : ''}`,
      `參加（${s.receivables.length} 人）：${s.receivables.map((r) => r.member.name).join('、')}`,
    )
  }

  lines.push('', `查看明細：${window.location.origin}/sessions`)
  return lines.join('\n')
}
