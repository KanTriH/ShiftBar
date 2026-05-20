import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    supabase
      .from('organizations')
      .select('*')
      .then(({ error }) => {
        if (!error) setConnected(true)
      })
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Shift Scheduler</h1>
      <p>Supabase 连接状态：{connected ? '✅ 成功' : '⏳ 连接中...'}</p>
    </div>
  )
}

export default App