import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useEditMode } from '../lib/editMode'

/** 需要解鎖才能進入的頁面；唯讀時帶到解鎖頁 */
export default function RequireEdit({ children }: { children: ReactNode }) {
  const { canEdit } = useEditMode()
  if (!canEdit) return <Navigate to="/unlock" replace />
  return children
}
