import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import AppLayout from './components/AppLayout'
import './index.css'
import { AuthProvider } from './lib/auth'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/s/:token', element: <PlaceholderPage title="公開帳本" /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <PlaceholderPage title="金流紀錄" /> },
      { path: 'sessions', element: <PlaceholderPage title="打球場次" /> },
      { path: 'settings', element: <PlaceholderPage title="設定" /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
