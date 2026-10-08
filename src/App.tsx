import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider } from './components/ui'
import { I18nProvider, useI18n } from './i18n'
import Landing from './pages/Landing'
import Auth, { Redirector } from './pages/Auth'
import GuestPage from './pages/GuestPage'
import StaffPage from './pages/StaffPage'
import ManagerLayout from './pages/manager/ManagerLayout'
import SchedulePage from './pages/manager/SchedulePage'
import AvailabilityBoard from './pages/manager/AvailabilityBoard'
import StaffList from './pages/manager/StaffList'
import Settings from './pages/manager/Settings'
import ScheduleSettings from './pages/manager/ScheduleSettings'
import AccountSettings from './pages/manager/AccountSettings'
import ResetPassword from './pages/ResetPassword'
import PrintPage from './pages/manager/PrintPage'

/** 用语言作 key：切换语言时整棵页面树重新渲染（登录状态和路由不受影响） */
function AppRoutes() {
  const { lang } = useI18n()
  return (
    <Routes key={lang}>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/go" element={<Redirector />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/s/:code" element={<GuestPage />} />
      <Route path="/me" element={<StaffPage />} />
      <Route path="/manager" element={<ManagerLayout />}>
        <Route index element={<SchedulePage />} />
        <Route path="availability" element={<AvailabilityBoard />} />
        <Route path="staff" element={<StaffList />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/preferences" element={<ScheduleSettings />} />
        <Route path="settings/account" element={<AccountSettings />} />
        <Route path="print" element={<PrintPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  )
}
