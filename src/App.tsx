import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import { FullPageLoader } from '@/components/ui'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import { ToastProvider } from '@/context/ToastContext'
import CustomerDetails from '@/pages/CustomerDetails'
import Customers from '@/pages/Customers'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ServiceRecords from '@/pages/ServiceRecords'
import Settings from '@/pages/Settings'
import VehicleDetails from '@/pages/VehicleDetails'
import Vehicles from '@/pages/Vehicles'
import type { ReactNode } from 'react'

/** Blocks unauthenticated access to every workshop data route. */
function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader label="Checking your session…" />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Keeps signed-in staff away from the login/register screens. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader label="Loading…" />
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnly>
                  <Register />
                </PublicOnly>
              }
            />
            <Route
              element={
                <Protected>
                  <DataProvider>
                    <Layout />
                  </DataProvider>
                </Protected>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetails />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/vehicles/:id" element={<VehicleDetails />} />
              <Route path="/services" element={<ServiceRecords />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  )
}
