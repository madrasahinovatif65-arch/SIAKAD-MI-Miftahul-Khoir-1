const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uodzgtprafjxyvvqfqam.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHpndHByYWZqeHl2dnFmcWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzMjI1MiwiZXhwIjoyMTAxNDA4MjUyfQ.qL9fkuBcBYGJrVqgt_oTTVRSWcG03TpmZv2-E8LbqDk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Listening to log_absensi and log_gps_guru...");
  let received = false;
  
  const channel = supabase.channel('test-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'log_gps_guru' }, payload => {
      console.log('GPS Change received!', payload);
      received = true;
    })
    .subscribe((status) => {
      console.log("Subscription status:", status);
    });

  setTimeout(async () => {
    console.log("Upserting test GPS log...");
    const { error } = await supabase.from('log_gps_guru').upsert({
      id_guru: 'ID_TEST_REALTIME',
      tanggal: '2026-08-18',
      waktu: '15.00',
      latitude: -7.74,
      longitude: 112.70,
      jarak_meter: 0,
      status: 'Hadir'
    }, { onConflict: 'tanggal,id_guru' });
    if (error) console.error("Insert error:", error);
  }, 3000);

  setTimeout(async () => {
    console.log("Cleaning up test GPS log...");
    await supabase.from('log_gps_guru').delete().eq('id_guru', 'ID_TEST_REALTIME');
    console.log("Did we receive realtime event?", received ? "YES" : "NO");
    process.exit(0);
  }, 8000);
}
main();
