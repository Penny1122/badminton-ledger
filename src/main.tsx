import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import AppLayout from './components/AppLayout'
import './index.css'
import { EditModeProvider } from './lib/editMode'
import RequireEdit from './components/RequireEdit'
import CategoriesPage from './pages/CategoriesPage'
import CollectionDetailPage from './pages/CollectionDetailPage'
import CollectionFormPage from './pages/CollectionFormPage'
import DashboardPage from './pages/DashboardPage'
import MembersPage from './pages/MembersPage'
import SessionDetailPage from './pages/SessionDetailPage'
import SessionFormPage from './pages/SessionFormPage'
import SessionsPage from './pages/SessionsPage'
import SettingsPage from './pages/SettingsPage'
import TransactionFormPage from './pages/TransactionFormPage'
import TransactionsPage from './pages/TransactionsPage'
import UnlockPage from './pages/UnlockPage'
import VenuesPage from './pages/VenuesPage'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'transactions/new', element: <RequireEdit><TransactionFormPage /></RequireEdit> },
      { path: 'transactions/:id', element: <RequireEdit><TransactionFormPage /></RequireEdit> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'sessions/new', element: <RequireEdit><SessionFormPage /></RequireEdit> },
      { path: 'sessions/:id', element: <SessionDetailPage /> },
      { path: 'sessions/:id/edit', element: <RequireEdit><SessionFormPage /></RequireEdit> },
      { path: 'collections/new', element: <RequireEdit><CollectionFormPage /></RequireEdit> },
      { path: 'collections/:id', element: <CollectionDetailPage /> },
      { path: 'collections/:id/edit', element: <RequireEdit><CollectionFormPage /></RequireEdit> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/members', element: <MembersPage /> },
      { path: 'settings/categories', element: <CategoriesPage /> },
      { path: 'settings/venues', element: <VenuesPage /> },
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
