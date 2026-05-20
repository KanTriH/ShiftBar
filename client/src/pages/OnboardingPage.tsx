import { useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'choose' | 'create' | 'join'>('choose')
  const [orgName, setOrgName] = useState('')
  const [openTime, setOpenTime] = useState('09:00')
  const [closeTime, setCloseTime] = useState('21:00')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

    async function handleCreateOrg() {
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const code = generateInviteCode()

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
        name: orgName,
        business_hours_start: openTime,
        business_hours_end: closeTime,
        invite_code: code,
        })
        .select()
        .single()

    if (orgError) {
        setError(orgError.message)
        setLoading(false)
        return
    }

    const { error: posError } = await supabase.from('positions').insert({
        organization_id: org.id,
        name: 'Closing',
        color: '#6B7280',
    })
    console.log('positions insert error:', posError)

    const { error: userError } = await supabase
        .from('users')
        .update({ organization_id: org.id, role: 'manager' })
        .eq('id', session.user.id)

    if (userError) {
        setError(userError.message)
        setLoading(false)
        return
    }

    navigate('/dashboard')
    setLoading(false)
    }

  async function handleJoinOrg() {
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (orgError || !org) {
      setError('Invalid invite code. Please check and try again.')
      setLoading(false)
      return
    }

    const { error: userError } = await supabase
      .from('users')
      .update({ organization_id: org.id })
      .eq('id', session.user.id)

    if (userError) {
      setError(userError.message)
      setLoading(false)
      return
    }

    navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">

        {step === 'choose' && (
          <>
            <h1 className="text-2xl font-semibold text-gray-800 mb-1">Welcome!</h1>
            <p className="text-gray-500 text-sm mb-6">How would you like to get started?</p>
            <button
              onClick={() => setStep('create')}
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors mb-3"
            >
              <p className="font-medium text-gray-800">Create a new shop</p>
              <p className="text-sm text-gray-500 mt-1">I'm a manager setting up scheduling for my team</p>
            </button>
            <button
              onClick={() => setStep('join')}
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <p className="font-medium text-gray-800">Join an existing shop</p>
              <p className="text-sm text-gray-500 mt-1">I have an invite code or link from my manager</p>
            </button>
          </>
        )}

        {step === 'create' && (
          <>
            <button onClick={() => setStep('choose')} className="text-sm text-gray-400 hover:text-gray-600 mb-4">← Back</button>
            <h1 className="text-2xl font-semibold text-gray-800 mb-1">Create your shop</h1>
            <p className="text-gray-500 text-sm mb-6">You'll be set as the manager.</p>

            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Heytea 505"
              />
            </div>

            <div className="mb-4 flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening time</label>
                <input
                  type="time"
                  value={openTime}
                  onChange={e => setOpenTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
                <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Closing time</label>
                <input
                    type="time"
                    value={closeTime}
                    onChange={e => setCloseTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                </div>
            </div>

            <button
              onClick={handleCreateOrg}
              disabled={loading || !orgName}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2 text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create shop'}
            </button>
          </>
        )}

        {step === 'join' && (
          <>
            <button onClick={() => setStep('choose')} className="text-sm text-gray-400 hover:text-gray-600 mb-4">← Back</button>
            <h1 className="text-2xl font-semibold text-gray-800 mb-1">Join a shop</h1>
            <p className="text-gray-500 text-sm mb-6">Enter the invite code from your manager.</p>

            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Invite code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                placeholder="e.g. HEY505"
                maxLength={6}
              />
            </div>

            <button
              onClick={handleJoinOrg}
              disabled={loading || inviteCode.length < 4}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2 text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join shop'}
            </button>
          </>
        )}

      </div>
    </div>
  )
}