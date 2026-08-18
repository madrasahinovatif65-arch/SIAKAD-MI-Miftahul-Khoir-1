const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uodzgtprafjxyvvqfqam.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZHpndHByYWZqeHl2dnFmcWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzMjI1MiwiZXhwIjoyMTAxNDA4MjUyfQ.qL9fkuBcBYGJrVqgt_oTTVRSWcG03TpmZv2-E8LbqDk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: guruData, error: errGuru } = await supabase.from('verifikasi_guru').select('waktu, metode').limit(5);
  console.log('verifikasi_guru:', guruData);

  const { data: gpsData, error: errGps } = await supabase.from('log_gps_guru').select('waktu, waktu_pulang').limit(5);
  console.log('log_gps_guru:', gpsData);
  
  const { data: muridData, error: errMurid } = await supabase.from('data_absensi').select('waktu, metode').limit(5);
  console.log('data_absensi:', muridData);
}
main();
