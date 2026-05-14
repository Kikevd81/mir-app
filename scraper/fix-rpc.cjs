require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = \
create or replace function update_available_slots()
returns void as \$\\\$
begin
  update slots s
  set available = s.total - coalesce(
    (select count(*) 
     from adjudications a 
     where a.hospital_id = s.hospital_id 
     and a.specialty_id = s.specialty_id),
    0
  )
  where id = s.id;
end;
\$\\\$ language plpgsql security definer;
\;
  // We cannot execute raw SQL with anon key. But we can see if it's already fixed.
  console.log('We cannot execute DDL with anon key.');
}
run();
