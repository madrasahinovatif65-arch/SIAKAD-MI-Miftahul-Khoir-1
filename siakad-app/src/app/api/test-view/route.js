import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data } = await supabase.from('view_rekap_absensi_nfc').select('*').limit(5);
  return NextResponse.json(data);
}
