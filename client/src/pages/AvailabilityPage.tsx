import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getMonday(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(monday: Date, dayIndex: number) {
  const d = new Date(monday)
  d.setDate(d.getDate() + dayIndex)
  return d.toISOString().split('T')[0]
}

interface DaySlot {
  available: boolean
  isAllDay: boolean
  startTime: string
  endTime: string
  note: string
}

const defaultSlot: DaySlot = {
  available: false,
  isAllDay: false,
  startTime: '09:00',
  endTime: '17:00',
  note: '',
}

export default function AvailabilityPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const monday = getMonday(new Date())
  const [slots, setSlots] = useState<DaySlot[]>(DAYS.map(() => ({ ...defaultSlot })))
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!session) navigate('/login')
  }, [session, authLoading])

  function updateSlot(index: number, updates: Partial<DaySlot>) {
    setSlots(prev => prev.map((slot, i) => i === index ? { ...slot, ...updates } : slot))
  }

  async function handleSubmit() {
    setLoading(true)
    if (!session) return

    const weekStartDate = formatDate(monday, 0)

    await supabase
      .from('availability_slots')
      .delete()
      .eq('user_id', session.user.id)
      .eq('week_start_date', weekStartDate)

    const toInsert = slots
      .map((slot, i) => ({ slot, date: formatDate(monday, i) }))
      .filter(({ slot }) => slot.available)
      .map(({ slot, date }) => ({
        user_id: session.user.id,
        week_start_date: weekStartDate,
        date,
        is_all_day: slot.isAllDay,
        start_time: slot.isAllDay ? null : slot.startTime,
        end_time: slot.isAllDay ? null : slot.endTime,
        note: slot.note || null,
      }))

    if (toInsert.length > 0) {
      await supabase.from('availability_slots').insert(toInsert)
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Availability submitted!</h2>
          <p className="text-gray-500 text-sm mb-6">Your manager will use this to create the schedule.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 text-sm hover:underline"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600 mb-6">
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Submit availability</h1>
        <p className="text-gray-500 text-sm mb-6">
          Week of {monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="space-y-3">
          {DAYS.map((day, i) => (
            <div key={day} className={`bg-white rounded-xl border transition-colors ${slots[i].available ? 'border-blue-300' : 'border-gray-200'} p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={slots[i].available}
                    onChange={e => updateSlot(i, { available: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className={`font-medium text-sm ${slots[i].available ? 'text-gray-800' : 'text-gray-400'}`}>
                    {day}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(monday, i)}
                  </span>
                </div>
                {slots[i].available && (
                  <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slots[i].isAllDay}
                      onChange={e => updateSlot(i, { isAllDay: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    All day
                  </label>
                )}
              </div>

              {slots[i].available && !slots[i].isAllDay && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="time"
                    value={slots[i].startTime}
                    onChange={e => updateSlot(i, { startTime: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="time"
                    value={slots[i].endTime}
                    onChange={e => updateSlot(i, { endTime: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={slots[i].note}
                    onChange={e => updateSlot(i, { note: e.target.value })}
                    placeholder="Note (optional)"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !slots.some(s => s.available)}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit availability'}
        </button>
      </div>
    </div>
  )
}