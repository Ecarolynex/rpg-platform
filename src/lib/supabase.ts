import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('As variáveis do Supabase não foram configuradas no arquivo .env')
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)