import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Auto-correct dashboard URLs to direct API endpoints (Ralph Loop resilience)
if (rawUrl.includes('supabase.com/dashboard/project/')) {
  const match = rawUrl.match(/project\/([a-zA-Z0-9_-]+)/)
  if (match) {
    rawUrl = `https://${match[1]}.supabase.co`
  }
}

const supabaseUrl = rawUrl || 'https://placeholder.supabase.co'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    '[SymbioServe] Missing Supabase env vars in .env.local. Initializing fallback client.'
  )
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey || 'placeholder-anon-key'
)
