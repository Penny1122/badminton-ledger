import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import AppLayout from './components/AppLayout'
import './index.css'
import { EditModeProvider } from './lib/editMode'
import DashboardPage from './pages/DashboardPage'
import PlaceholderPage from './pages/PlaceholderPage'
import UnlockPage from './pages/UnlockPage'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <PlaceholderPage title="金流紀錄" /> },
      { path: 'sessions', element: <PlaceholderPage title="打球場次" /> },
      { path: 'settings', element: <PlaceholderPage title="設定" /> },
      { path: 'unlock', element: <UnlockPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <EditModeProvider>
        <RouterProvider router={router} />
      </EditModeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
