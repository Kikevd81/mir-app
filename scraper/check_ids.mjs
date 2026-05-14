import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkIds() {
    const targetHospId = 'valencia-valencia-h-clinico-universitario-de-valencia';
    
    const { data: hosp } = await supabase.from('hospitals').select('*').eq('id', targetHospId);
    console.log('Hospital exists:', hosp.length > 0);

    const { data: slot } = await supabase.from('slots').select('*').eq('hospital_id', targetHospId);
    console.log('Slots for this hospital:', slot.length);
}

checkIds();
