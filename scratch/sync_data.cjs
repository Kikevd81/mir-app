const { createClient } = require('../scraper/node_modules/@supabase/supabase-js');

// These will be passed via process.env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllRows(table, select = '*') {
  let allData = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  return allData;
}

async function sync() {
  console.log('🚀 Starting Data Sync Recovery...');
  
  try {
    // 1. Fetch all adjudications
    console.log('📥 Fetching all adjudications...');
    const adjudications = await fetchAllRows('adjudications');
    console.log(`✅ Fetched ${adjudications.length} adjudications.`);

    // 2. Run the SQL sync function
    console.log('🔄 Calling update_available_slots RPC...');
    const { error: rpcError } = await supabase.rpc('update_available_slots');
    
    if (rpcError) {
      console.error('⚠️ RPC Error:', rpcError.message);
      console.log('Attempting manual sync instead...');
      
      const slots = await fetchAllRows('slots');
      let updatedCount = 0;

      for (const slot of slots) {
        const count = adjudications.filter(a => 
          a.hospital_id === slot.hospital_id && 
          a.specialty_id === slot.specialty_id
        ).length;

        if (slot.available !== (slot.total - count)) {
          const { error: updateError } = await supabase
            .from('slots')
            .update({ available: slot.total - count })
            .eq('id', slot.id);
          
          if (!updateError) updatedCount++;
        }
      }
      console.log(`✅ Manual sync completed. Updated ${updatedCount} slots.`);
    } else {
      console.log('✅ RPC sync completed successfully.');
    }

    // 3. Update status
    await supabase.from('scraper_config').update({
      last_scrape_at: new Date().toISOString(),
      last_scrape_status: 'success',
      updated_at: new Date().toISOString()
    }).limit(1);

    console.log('🎉 Recovery completed!');
  } catch (error) {
    console.error('❌ Error during recovery:', error);
  }
}

sync();
