import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAdjudications() {
    const { data, count } = await supabase.from('adjudications')
        .select('*', { count: 'exact' })
        .ilike('hospital_name', '%VALENCIA%')
        .limit(10);
    
    console.log('Total adjudications for Valencia:', count);
    console.log('Sample:', data);
}

checkAdjudications();
