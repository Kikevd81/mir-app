import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkValenciaHosp() {
    const id = 'valencia-valencia-h-clinico-universitario-de-valencia';
    const { data } = await supabase.from('hospitals').select('*').eq('id', id);
    console.log('Valencia Hospital:', data);
}

checkValenciaHosp();
