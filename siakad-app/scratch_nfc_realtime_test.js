const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yfsemhbuzxdhysglocgh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmc2VtaGJ1enhkaHlzZ2xvY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTE3ODIsImV4cCI6MjEwMTU2Nzc4Mn0.GLqDofMptgxB_eeKtwBONcQle1r-F0pjvPg0pqyyP4Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Listening to log_absensi on NFC Database...");
  let received = false;
  
  const channel = supabase.channel('test-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'log_absensi' }, payload => {
      console.log('NFC Change received!', payload);
      received = true;
    })
    .subscribe((status) => {
      console.log("Subscription status:", status);
    });

  setTimeout(async () => {
    console.log("Inserting test NFC log...");
    const { error } = await supabase.from('log_absensi').insert({
      rfid_uid: 'TEST_REALTIME_NFC',
      user_type: 'guru',
      jenis_absen: 'Datang'
    });
    if (error) console.error("Insert error:", error);
  }, 3000);

  setTimeout(async () => {
    console.log("Cleaning up test NFC log...");
    await supabase.from('log_absensi').delete().eq('rfid_uid', 'TEST_REALTIME_NFC');
    console.log("Did we receive realtime event from NFC DB?", received ? "YES" : "NO");
    process.exit(0);
  }, 8000);
}
main();
