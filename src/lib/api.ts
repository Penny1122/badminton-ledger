import { supabase } from './supabase'

export type ApiErrorCode =
  | 'invalid_password'
  | 'too_many_attempts'
  | 'password_not_set'
  | 'too_many_requests'
  | 'invalid_input'
  | 'not_found'
  | 'linked_transaction'
  | 'network'
  | 'unknown'

const MESSAGES: Record<ApiErrorCode, string> = {
  invalid_password: '密碼錯誤',
  too_many_attempts: '密碼錯誤次數太多，請 10 分鐘後再試',
  password_not_set: '尚未設定編輯密碼，請先在 Supabase 執行 set-password.sql',
  too_many_requests: '操作太頻繁，請 10 分鐘後再試',
  invalid_input: '資料不正確',
  not_found: '找不到這筆資料，可能已被作廢',
  linked_transaction: '這筆是活動或收款單自動產生的，請到原本的地方修改',
  network: '無法連線，請檢查網路後再試',
  unknown: '發生錯誤，請稍後再試',
}

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]}：${detail}` : MESSAGES[code])
    this.code = code
    this.name = 'ApiError'
  }
}

/** 密碼錯誤或尚未設定：前端要回到唯讀 */
export function isPasswordError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'invalid_password' || error.code === 'password_not_set')
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return new ApiError('network')
  }
  const invalid = /invalid_input:\s*(.*)/.exec(message)
  if (invalid) return new ApiError('invalid_input', invalid[1])
  if (message.includes('linked_transaction')) return new ApiError('linked_transaction')
  if (message.includes('not_found')) return new ApiError('not_found')
  return new ApiError('unknown', message || undefined)
}

type RpcResult = { ok?: true; error?: string } & Record<string, unknown>

/**
 * 呼叫需要編輯密碼的資料庫函式。
 * 函式以 {"error": "..."} 回報密碼問題，這裡轉成 ApiError 丟出。
 */
export async function callWrite<T extends RpcResult = RpcResult>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toApiError(error)
  const result = data as T
  if (result?.error) {
    const code = result.error in MESSAGES ? (result.error as ApiErrorCode) : 'unknown'
    throw new ApiError(code, code === 'unknown' ? result.error : undefined)
  }
  return result
}

export function verifyEditPassword(password: string) {
  return callWrite('verify_edit_password', { p_password: password })
}
