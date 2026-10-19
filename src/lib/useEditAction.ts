import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { isPasswordError, toApiError } from './api'
import { useEditMode } from './editMode'

/**
 * 執行需要編輯密碼的寫入：成功後重新載入所有資料；
 * 密碼失效時回到唯讀並帶到解鎖頁；其他錯誤放在 error 給畫面顯示。
 */
export function useEditAction() {
  const { password, lock } = useEditMode()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: (password: string) => Promise<unknown>): Promise<boolean> {
    if (!password || busy) return false
    setBusy(true)
    setError(null)
    try {
      await action(password)
      await queryClient.invalidateQueries()
      return true
    } catch (e) {
      if (isPasswordError(e)) {
        lock('編輯密碼已變更，請重新解鎖。')
        navigate('/unlock')
      } else {
        setError(toApiError(e).message)
      }
      return false
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, error, setError }
}
