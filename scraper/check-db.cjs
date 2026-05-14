require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: adjs, error: e1 } = await supabase.from('adjudications').select('*');
    if (e1) console.error('Error adjs:', e1);
    console.log('Adjudications count:', adjs ? adjs.length : 0);
    
    if (adjs && adjs.length > 0) {
        console.log('Sample adjudication:', adjs[0]);
    }

    const { data: slots, error: e2 } = await supabase.from('slots').select('*');
    if (e2) console.error('Error slots:', e2);
    console.log('Slots count:', slots ? slots.length : 0);
    
    if (slots && slots.length > 0) {
        console.log('Sample slot:', slots[0]);
    }
}
check();
