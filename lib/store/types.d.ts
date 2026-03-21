// lib/types.ts

import { Database } from '@/lib/store/supabase'

export type AuthStatusType = 'idle' | 'loading' | 'authenticated' | 'signed_out' | 'error'

export type Profile = Database['public']['Tables']['user_profile']['Row']
export type DatabaseEnum = Database['public']['Enums']
