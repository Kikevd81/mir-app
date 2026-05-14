import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function search() {
    const { data } = await supabase.from('hospitals').select('*').ilike('name', '%SAN CARLOS%');
    console.log('SAN CARLOS matches:', data);

    const { data: valencia } = await supabase.from('hospitals').select('*').ilike('name', '%CLINICO%').ilike('province', '%VALENCIA%');
    console.log('VALENCIA CLINICO matches:', valencia);
}

search();
