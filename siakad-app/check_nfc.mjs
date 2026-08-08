import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Query to get view definition in PostgreSQL
  const { data, error } = await supabase.rpc('run_sql', {
    sql_query: "SELECT definition FROM pg_views WHERE viewname = 'view_rekap_absensi_nfc'"
  });
  
  if (error) {
    // If rpc fails, we can just query pg_views if possible, but PostgREST usually blocks system catalogs.
    // Let's try direct query
    const { data: v, error: e2 } = await supabase.from('pg_views').select('*').eq('viewname', 'view_rekap_absensi_nfc');
    console.log("pg_views:", v, e2);
  } else {
    console.log("RPC result:", data);
  }
}

check();
