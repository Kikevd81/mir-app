import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkProvinces() {
    const { data } = await supabase.from('hospitals').select('province, name').limit(20);
    console.log(data);
}

checkProvinces();
