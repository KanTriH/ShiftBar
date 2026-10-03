import { hasSupabase } from '../lib/supabase'
import type { Api } from './api'
import { createSupabaseApi } from './supabaseApi'
import { createDemoApi } from './demoApi'

export const api: Api = hasSupabase ? createSupabaseApi() : createDemoApi()
