import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import AppLayout from './components/AppLayout'
import './index.css'
import { EditModeProvider } from './lib/editMode'
import RequireEdit from './components/RequireEdit'
import CategoriesPage from './pages/CategoriesPage'
import DashboardPage from './pages/DashboardPage'
import PlaceholderPage from './pages/PlaceholderPage'
import SettingsPage from './pages/SettingsPage'
import TransactionFormPage from './pages/TransactionFormPage'
import TransactionsPage from './pages/TransactionsPage'
import UnlockPage from './pages/UnlockPage'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'transactions/new', element: <RequireEdit><TransactionFormPage /></RequireEdit> },
      { path: 'transactions/:id', element: <RequireEdit><TransactionFormPage /></RequireEdit> },
      { path: 'sessions', element: <PlaceholderPage title="打球場次" /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/categories', element: <CategoriesPage /> },
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
