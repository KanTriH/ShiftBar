import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../data'
import type { AppUser } from '../lib/types'

interface AuthState { user: AppUser | null; loading: boolean }
const Ctx = createContext<AuthState>({ user: null, loading: true })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })
  useEffect(() => {
    let alive = true
    api.getUser().then((user) => alive && setState({ user, loading: false })).catch(() => alive && setState({ user: null, loading: false }))
    const off = api.onAuth((user) => setState({ user, loading: false }))
    return () => { alive = false; off() }
  }, [])
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
