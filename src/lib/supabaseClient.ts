import { createClient } from '@supabase/supabase-js'

// This is the publishable/anon key — by design it's meant to ship inside the
// client bundle. It is not a secret; row-level security policies are what
// actually gate access, and this family app deliberately leaves them open
// (no per-user login beyond the existing card-based one).
const SUPABASE_URL = 'https://zalvstnzvxdcibnbdbwm.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DR7KL1dgiv-y1wTXnA1X8Q_aeLSQ50H'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
