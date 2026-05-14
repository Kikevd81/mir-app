import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function verifyValencia() {
    const hId = 'valencia-valencia-h-clinico-universitario-de-valencia';
    const { data } = await supabase.from('slots')
        .select('specialty_id, available, total')
        .eq('hospital_id', hId);
    
    console.log('Final counts for Valencia Clínico:');
    data.forEach(s => {
        console.log(` - ${s.specialty_id}: ${s.available}/${s.total}`);
    });
}

verifyValencia();
