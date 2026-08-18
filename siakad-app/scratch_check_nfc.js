const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uodzgtprafjxyvvqfqam.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHpndHByYWZqeHl2dnFmcWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzMjI1MiwiZXhwIjoyMTAxNDA4MjUyfQ.qL9fkuBcBYGJrVqgt_oTTVRSWcG03TpmZv2-E8LbqDk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user, error: errUser } = await supabase.from('master_user').select('id_user, nama, rfid').eq('rfid', '2654141620').single();
  console.log('User with RFID 2654141620:', user);
}
main();
