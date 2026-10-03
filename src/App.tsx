import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider } from './components/ui'
import Landing from './pages/Landing'
import Auth, { Redirector } from './pages/Auth'
import GuestPage from './pages/GuestPage'
import StaffPage from './pages/StaffPage'
import ManagerLayout from './pages/manager/ManagerLayout'
import SchedulePage from './pages/manager/SchedulePage'
import AvailabilityBoard from './pages/manager/AvailabilityBoard'
import StaffList from './pages/manager/StaffList'
import Settings from './pages/manager/Settings'
import PrintPage from './pages/manager/PrintPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/go" element={<Redirector />} />
            <Route path="/s/:code" element={<GuestPage />} />
            <Route path="/me" element={<StaffPage />} />
            <Route path="/manager" element={<ManagerLayout />}>
              <Route index element={<SchedulePage />} />
              <Route path="availability" element={<AvailabilityBoard />} />
              <Route path="staff" element={<StaffList />} />
              <Route path="settings" element={<Settings />} />
              <Route path="print" element={<PrintPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
