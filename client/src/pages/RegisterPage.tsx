import { useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate, Link } from 'react-router-dom'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

async function handleRegister() {
  setLoading(true)
  setError('')

  if (!name || !email || !password) {
    setError('Please fill in all fields')
    setLoading(false)
    return
  }

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  })

  if (signUpError) {
    setError(signUpError.message)
    setLoading(false)
    return
  }

  if (data.user) {
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        name,
        email,
        role: 'staff',
        status: 'probationary',
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }
  }

  navigate('/dashboard')
  setLoading(false)
}

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Create account</h1>
        <p className="text-gray-500 text-sm mb-6">Join your team on Shift Scheduler</p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Kristin Han"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2 text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}