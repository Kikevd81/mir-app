import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkIds() {
    const { data } = await supabase.from('slots').select('specialty_id').limit(1);
    console.log('Specialty ID Sample:', data[0].specialty_id);
}

checkIds();
