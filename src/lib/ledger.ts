import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { callWrite } from './api'
import { supabase } from './supabase'

export type TxnType = 'income' | 'expense'

export const TXN_TYPE_LABEL: Record<TxnType, string> = { income: '收入', expense: '支出' }

export type Category = {
  id: string
  type: TxnType
  name: string
  system_key: string | null
  sort_order: number
  archived_at: string | null
}

export type Transaction = {
  id: string
  type: TxnType
  category_id: string
  amount: number
  occurred_on: string
  note: string | null
  session_id: string | null
  collection_id: string | null
  receivable_id: string | null
  created_at: string
  voided_at: string | null
  void_reason: string | null
}

/** 場次或收款單自動產生的帳目，不能直接修改 */
export function isLinked(txn: Transaction) {
  return txn.session_id !== null || txn.collection_id !== null || txn.receivable_id !== null
}

export type Settings = { group_name: string; surcharge: number }

export type Member = {
  id: string
  name: string
  is_vip: boolean
  is_active: boolean
  created_at: string
  last_played_on: string | null
  sessions_count: number
}

export type Receivable = {
  id: string
  member_id: string
  is_vip: boolean
  share_amount: number
  surcharge_amount: number
  amount_due: number
  paid_at: string | null
  member: { name: string }
}

export type Session = {
  id: string
  played_on: string
  venue: string | null
  court_fee: number
  note: string | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
  receivables: Receivable[]
}

export type Collection = {
  id: string
  title: string
  collected_on: string
  note: string | null
  voided_at: string | null
  created_at: string
  receivables: Receivable[]
}

/** 每人場地費：無條件進位到元，和資料庫 save_session 的算法一致 */
export function perPersonShare(courtFee: number, count: number) {
  return count > 0 ? Math.ceil(courtFee / count) : 0
}

// ---------------------------------------------------------------------------
// 讀取
// ---------------------------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, type, name, system_key, sort_order, archived_at')
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data as Category[]
    },
  })
}

const TXN_COLUMNS =
  'id, type, category_id, amount, occurred_on, note, session_id, collection_id, receivable_id, created_at, voided_at, void_reason'

/** 某個月（YYYY-MM）的帳目，新到舊 */
export function useMonthTransactions(month: string) {
  return useQuery({
    queryKey: ['transactions', month],
    queryFn: async () => {
      const start = dayjs(`${month}-01`)
      const { data, error } = await supabase
        .from('transactions')
        .select(TXN_COLUMNS)
        .gte('occurred_on', start.format('YYYY-MM-DD'))
        .lt('occurred_on', start.add(1, 'month').format('YYYY-MM-DD'))
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transaction', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select(TXN_COLUMNS).eq('id', id!).maybeSingle()
      if (error) throw error
      return data as Transaction | null
    },
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('group_name, surcharge').single()
      if (error) throw error
      return data as Settings
    },
  })
}

/** 成員名冊：VIP 在前，其餘依最近出席排序 */
export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const [members, stats] = await Promise.all([
        supabase.from('members').select('id, name, is_vip, is_active, created_at'),
        supabase.from('member_stats').select('member_id, last_played_on, sessions_count'),
      ])
      if (members.error) throw members.error
      if (stats.error) throw stats.error
      const byId = new Map(
        (stats.data as { member_id: string; last_played_on: string | null; sessions_count: number }[]).map((s) => [
          s.member_id,
          s,
        ]),
      )
      return (members.data as Omit<Member, 'last_played_on' | 'sessions_count'>[])
        .map((m) => ({
          ...m,
          last_played_on: byId.get(m.id)?.last_played_on ?? null,
          sessions_count: byId.get(m.id)?.sessions_count ?? 0,
        }))
        .sort(
          (a, b) =>
            Number(b.is_vip) - Number(a.is_vip) ||
            (b.last_played_on ?? '').localeCompare(a.last_played_on ?? '') ||
            b.created_at.localeCompare(a.created_at),
        ) as Member[]
    },
  })
}

const RECEIVABLE_COLUMNS =
  'receivables(id, member_id, is_vip, share_amount, surcharge_amount, amount_due, paid_at, member:members(name))'

function sortReceivables<T extends { receivables: Receivable[] }>(row: T): T {
  row.receivables.sort(
    (a, b) => Number(b.is_vip) - Number(a.is_vip) || a.member.name.localeCompare(b.member.name, 'zh-TW'),
  )
  return row
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`id, played_on, venue, court_fee, note, voided_at, void_reason, created_at, ${RECEIVABLE_COLUMNS}`)
        .order('played_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as Session[]).map(sortReceivables)
    },
  })
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['session', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`id, played_on, venue, court_fee, note, voided_at, void_reason, created_at, ${RECEIVABLE_COLUMNS}`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? sortReceivables(data as unknown as Session) : null
    },
  })
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select(`id, title, collected_on, note, voided_at, created_at, ${RECEIVABLE_COLUMNS}`)
        .order('collected_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as Collection[]).map(sortReceivables)
    },
  })
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ['collection', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select(`id, title, collected_on, note, voided_at, created_at, ${RECEIVABLE_COLUMNS}`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? sortReceivables(data as unknown as Collection) : null
    },
  })
}

export type LedgerSummary = { balance: number; outstanding: number }

export function useLedgerSummary() {
  return useQuery({
    queryKey: ['ledger_summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ledger_summary').select('balance, outstanding').single()
      if (error) throw error
      return data as LedgerSummary
    },
  })
}

/** 各系統分類的累計金額（不含作廢），key 是 system_key */
export function useSystemTotals() {
  return useQuery({
    queryKey: ['category_totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_totals')
        .select('system_key, total')
        .not('system_key', 'is', null)
      if (error) throw error
      return Object.fromEntries((data as { system_key: string; total: number }[]).map((r) => [r.system_key, r.total]))
    },
  })
}

/** 球款水位 = VIP 球款 + 球費 − 羽球支出 */
export function ballFund(totals: Record<string, number>) {
  return (totals.vip_ball ?? 0) + (totals.ball_fee ?? 0) - (totals.shuttlecock ?? 0)
}

export type Debt = {
  receivableId: string
  amount: number
  label: string
  date: string
  to: string
}

export type Debtor = { name: string; total: number; items: Debt[] }

/** 還沒付的人，依欠款金額由多到少（不含作廢的場次和收款單） */
export function useDebtors() {
  return useQuery({
    queryKey: ['debtors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select(
          'id, amount_due, member:members(name), session:sessions(id, played_on, venue, voided_at), collection:collections(id, title, collected_on, voided_at)',
        )
        .is('paid_at', null)
      if (error) throw error

      type Row = {
        id: string
        amount_due: number
        member: { name: string }
        session: { id: string; played_on: string; venue: string | null; voided_at: string | null } | null
        collection: { id: string; title: string; collected_on: string; voided_at: string | null } | null
      }
      const byName = new Map<string, Debtor>()
      for (const r of data as unknown as Row[]) {
        let debt: Debt
        if (r.session) {
          if (r.session.voided_at) continue
          debt = {
            receivableId: r.id,
            amount: r.amount_due,
            label: r.session.venue ?? '打球',
            date: r.session.played_on,
            to: `/sessions/${r.session.id}`,
          }
        } else if (r.collection) {
          if (r.collection.voided_at) continue
          debt = {
            receivableId: r.id,
            amount: r.amount_due,
            label: r.collection.title,
            date: r.collection.collected_on,
            to: `/collections/${r.collection.id}`,
          }
        } else continue

        const debtor = byName.get(r.member.name) ?? { name: r.member.name, total: 0, items: [] }
        debtor.total += debt.amount
        debtor.items.push(debt)
        byName.set(r.member.name, debtor)
      }
      for (const d of byName.values()) d.items.sort((a, b) => a.date.localeCompare(b.date))
      return [...byName.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh-TW'))
    },
  })
}

// ---------------------------------------------------------------------------
// 寫入（都需要編輯密碼）
// ---------------------------------------------------------------------------

export function updateSettings(password: string, input: Settings) {
  return callWrite('update_settings', {
    p_password: password,
    p_group_name: input.group_name,
    p_surcharge: input.surcharge,
  })
}

export function saveMember(
  password: string,
  input: { id: string | null; name: string; isVip: boolean | null; isActive: boolean | null },
) {
  return callWrite('save_member', {
    p_password: password,
    p_id: input.id,
    p_name: input.name,
    p_is_vip: input.isVip,
    p_is_active: input.isActive,
  })
}

export type SessionInput = {
  id: string | null
  playedOn: string
  venue: string
  courtFee: number
  note: string
  memberIds: string[]
  newNames: string[]
}

export function saveSession(password: string, input: SessionInput) {
  return callWrite<{ ok: true; id: string }>('save_session', {
    p_password: password,
    p_id: input.id,
    p_played_on: input.playedOn,
    p_venue: input.venue,
    p_court_fee: input.courtFee,
    p_note: input.note,
    p_member_ids: input.memberIds,
    p_new_names: input.newNames,
  })
}

export function voidSession(password: string, id: string, reason: string) {
  return callWrite('void_session', { p_password: password, p_id: id, p_reason: reason })
}

export type CollectionInput = {
  id: string | null
  title: string
  collectedOn: string
  amount: number
  note: string
  memberIds: string[]
}

export function saveCollection(password: string, input: CollectionInput) {
  return callWrite<{ ok: true; id: string }>('save_collection', {
    p_password: password,
    p_id: input.id,
    p_title: input.title,
    p_collected_on: input.collectedOn,
    p_amount: input.amount,
    p_note: input.note,
    p_member_ids: input.memberIds,
  })
}

export function voidCollection(password: string, id: string) {
  return callWrite('void_collection', { p_password: password, p_id: id })
}

export function setReceivablePaid(password: string, id: string, paid: boolean) {
  return callWrite('set_receivable_paid', { p_password: password, p_id: id, p_paid: paid })
}

export function saveCategory(password: string, input: { id: string | null; type: TxnType; name: string }) {
  return callWrite('save_category', { p_password: password, p_id: input.id, p_type: input.type, p_name: input.name })
}

export function setCategoryArchived(password: string, id: string, archived: boolean) {
  return callWrite('set_category_archived', { p_password: password, p_id: id, p_archived: archived })
}

export function reorderCategories(password: string, type: TxnType, ids: string[]) {
  return callWrite('reorder_categories', { p_password: password, p_type: type, p_ids: ids })
}

export type TransactionInput = {
  id: string | null
  type: TxnType
  categoryId: string
  amount: number
  occurredOn: string
  note: string
}

export function saveTransaction(password: string, input: TransactionInput) {
  return callWrite('save_transaction', {
    p_password: password,
    p_id: input.id,
    p_type: input.type,
    p_category_id: input.categoryId,
    p_amount: input.amount,
    p_occurred_on: input.occurredOn,
    p_note: input.note,
  })
}

export function voidTransaction(password: string, id: string, reason: string) {
  return callWrite('void_transaction', { p_password: password, p_id: id, p_reason: reason })
}
