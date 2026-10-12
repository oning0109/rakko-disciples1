import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tdatedpggtutuqrywguk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkYXRlZHBnZ3R1dHVxcnl3Z3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NzY3NjUsImV4cCI6MjEwNzM1Mjc2NX0.QuXGuebYHDGc-2x7rZG-NZSw8Xz7Y-qU4D18HJQH2gg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)