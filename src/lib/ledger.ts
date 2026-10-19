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
  receivable_id: string | null
  created_at: string
  voided_at: string | null
  void_reason: string | null
}

/** 場次或收款單自動產生的帳目，不能直接修改 */
export function isLinked(txn: Transaction) {
  return txn.session_id !== null || txn.receivable_id !== null
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
  'id, type, category_id, amount, occurred_on, note, session_id, receivable_id, created_at, voided_at, void_reason'

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

// ---------------------------------------------------------------------------
// 寫入（都需要編輯密碼）
// ---------------------------------------------------------------------------

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
