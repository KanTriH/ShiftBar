import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

interface User {
  id: string
  name: string
  email: string
  role: 'manager' | 'staff'
  status: string
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        navigate('/login')
        return
    }

    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

    if (!data?.organization_id) {
        navigate('/onboarding')
        return
    }

    setUser(data)
    setLoading(false)
    }
    loadUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Shift Scheduler</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
            {user?.role}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {user?.role === 'manager' ? (
          <ManagerView />
        ) : (
          <StaffView name={user?.name ?? ''} />
        )}
      </main>
    </div>
  )
}

function ManagerView() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Manager Dashboard</h2>
      <p className="text-gray-500 text-sm">Schedule management coming soon.</p>
    </div>
  )
}

function StaffView({ name }: { name: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Hi, {name}!</h2>
      <p className="text-gray-500 text-sm">Your schedule will appear here.</p>
    </div>
  )
}