import { createClient } from '@supabase/supabase-js';

const supabaseUrlNfc = process.env.NEXT_PUBLIC_SUPABASE_URL_NFC;
const supabaseAnonKeyNfc = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_NFC;

// Hanya inisialisasi jika URL dan Key tersedia di .env.local
export const supabaseNfc = supabaseUrlNfc && supabaseAnonKeyNfc 
  ? createClient(supabaseUrlNfc, supabaseAnonKeyNfc) 
  : null;
