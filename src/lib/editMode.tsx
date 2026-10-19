import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isPasswordError, toApiError, verifyEditPassword } from './api'

/**
 * 記住這台裝置的編輯密碼，下次打開不用再輸入。
 * 這只是方便，不是安全機制：真正的權限檢查在資料庫函式裡。
 */
const KEY = 'badminton.editPassword'

function loadEditPassword(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function saveEditPassword(password: string) {
  try {
    localStorage.setItem(KEY, password)
  } catch {
    // 無法儲存時只在這次開啟期間有效
  }
}

function clearEditPassword() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 同上
  }
}

type EditMode = {
  /** 解鎖後才有值，寫入時傳給資料庫函式 */
  password: string | null
  canEdit: boolean
  /** 額外提示，例如「密碼已變更，請重新解鎖」 */
  notice: string | null
  /** 回傳錯誤訊息；成功回傳 null */
  unlock: (password: string) => Promise<string | null>
  lock: (notice?: string | null) => void
}

const EditModeContext = createContext<EditMode | null>(null)

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState<string | null>(loadEditPassword)
  const [notice, setNotice] = useState<string | null>(null)

  const lock = useCallback((next: string | null = null) => {
    clearEditPassword()
    setPassword(null)
    setNotice(next)
  }, [])

  const unlock = useCallback(async (candidate: string) => {
    try {
      await verifyEditPassword(candidate)
      saveEditPassword(candidate)
      setPassword(candidate)
      setNotice(null)
      return null
    } catch (e) {
      return toApiError(e).message
    }
  }, [])

  // 記住的密碼可能已在別處被更改，啟動時確認一次（網路錯誤時先保留）
  useEffect(() => {
    const stored = loadEditPassword()
    if (!stored) return
    verifyEditPassword(stored).catch((e) => {
      if (isPasswordError(e)) lock('編輯密碼已變更，請重新解鎖。')
    })
  }, [lock])

  return (
    <EditModeContext.Provider value={{ password, canEdit: password !== null, notice, unlock, lock }}>
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode() {
  const value = useContext(EditModeContext)
  if (!value) throw new Error('useEditMode 必須放在 EditModeProvider 裡')
  return value
}
