import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toApiError } from './api'

/** 不需要密碼的寫入（公開報名）：成功後重新載入所有資料，錯誤放在 error 給畫面顯示 */
export function usePublicAction() {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 成功回傳 true */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      await action()
      await queryClient.invalidateQueries()
      return true
    } catch (e) {
      setError(toApiError(e).message)
      // 名單可能已被別人改過或鎖定，重新載入看最新狀態
      await queryClient.invalidateQueries()
      return false
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, error, setError }
}
