require('dotenv').config({ path: '../.env' });
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ WARNING: Using ANON_KEY. Inserts might fail if RLS blocks anonymous users. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to normalize IDs (same as in your app)
const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const generateId = (text) => {
  return normalizeText(text)
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

async function runScraper() {
  console.log('🚀 Starting MIR Scraper...');

  // Check configuration first
  const { data: config, error: configError } = await supabase
    .from('scraper_config')
    .select('is_enabled')
    .single();

  if (configError) {
    console.error('⚠️ Could not check config, proceeding anyway:', configError.message);
  } else if (config && config.is_enabled === false) {
    console.log('🛑 Scraper is disabled in the database configuration. Exiting.');
    process.exit(0);
  }

  
  const browser = await puppeteer.launch({
    headless: true, // "new" is deprecated in v22+
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  
  const page = await browser.newPage();
  
  // Set a larger timeout
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  let adjudicacionesData = null;

  // Intercept network requests
  page.on('response', async (response) => {
    const request = response.request();
    const url = request.url();
    
    // We are looking for the getPlazasAdjudicadas API call with parameters
    if (url.includes('/getPlazasAdjudicadas?') && request.method() === 'GET') {
      console.log(`\n📥 Intercepted response from: ${url}`);
      try {
        const json = await response.json();
        if (json && json.data) {
          adjudicacionesData = json.data;
          console.log(`✅ Extracted ${adjudicacionesData.length} records from JSON! (using json.data)`);
        } else if (Array.isArray(json)) {
          adjudicacionesData = json;
          console.log(`✅ Extracted ${adjudicacionesData.length} records from JSON! (is array)`);
        } else {
          console.log('JSON structure:', Object.keys(json));
          // if it's paginated or something
          if (json.content) adjudicacionesData = json.content;
          if (json.plazas) adjudicacionesData = json.plazas;
        }
      } catch (e) {
        console.log("Failed to parse JSON:", e.message);
      }
    }
  });

  console.log('🌐 Navigating to the Ministry website...');
  await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
    waitUntil: 'networkidle2'
  });

  console.log('⏳ Waiting for Angular to load...');
  await new Promise(r => setTimeout(r, 3000));

  try {
    console.log('🖱️ Selecting "MEDICINA" in Titulación dropdown...');
    // Find the ng-select for Titulación and click it
    // The dropdowns are likely ng-select components
    const dropdowns = await page.$$('ng-select');
    if (dropdowns.length > 0) {
      await dropdowns[0].click();
      await new Promise(r => setTimeout(r, 1000));
      
      // Look for the "MEDICINA" option
      const options = await page.$$('.ng-option');
      for (const option of options) {
        const text = await option.evaluate(el => el.textContent);
        if (text && text.includes('MEDICINA')) {
          await option.click();
          break;
        }
      }
    }

    await new Promise(r => setTimeout(r, 1000));

    console.log('🔍 Clicking "Buscar"...');
    // Find the submit button
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text && text.toLowerCase().includes('buscar')) {
        await btn.click();
        break;
      }
    }

    // Wait for the data to be intercepted
    console.log('⏳ Waiting for API response...');
    for (let i = 0; i < 15; i++) {
      if (adjudicacionesData) break;
      await new Promise(r => setTimeout(r, 1000));
    }

  } catch (error) {
    console.error('❌ Error interacting with the page:', error);
  }

  await browser.close();

  if (adjudicacionesData && adjudicacionesData.length > 0) {
    await processAndSaveData(adjudicacionesData);
  } else {
    console.log('⚠️ No data was captured. The scraper might need to be adjusted or there are no adjudications yet.');
  }
}

async function processAndSaveData(data) {
  console.log(`💾 Processing ${data.length} records for Supabase...`);
  if (data.length > 0) {
    console.log('Sample record:', data[0]);
  }
  
  let successCount = 0;
  let errorCount = 0;

  for (const item of data) {
    try {
      // Map the API fields to our database fields
      // Expected API fields: numOrden (or numorden), desEspecialidad (or desespec), desCentro (or descentro), localidad, despro, fechaHoraAdju
      const orderNumber = item.numOrden || item.numorden;
      const specialtyName = item.desEspecialidad || item.desespec || '';
      const hospitalName = item.desCentro || item.descentro || '';
      const province = item.despro || item.provincia || '';
      const locality = item.localidad || item.deslocalidad || '';
      const dateAdjudicated = item.fechaHoraAdju || item.fechaHora || new Date().toISOString();

      if (!orderNumber || !specialtyName) continue;

      const specId = generateId(specialtyName);
      const hospId = generateId(`${province}-${hospitalName}`);

      const { error } = await supabase
        .from('adjudications')
        .upsert({
          order_number: orderNumber,
          specialty_name: specialtyName,
          hospital_name: hospitalName,
          region: item.desccaa || '', 
          province: province,
          specialty_id: specId,
          hospital_id: hospId,
          scraped_at: new Date().toISOString()
        }, { onConflict: 'order_number' });

      if (error) {
        console.error(`Error saving order ${orderNumber}:`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    } catch (e) {
      errorCount++;
    }
  }

  console.log(`✅ Saved ${successCount} new records.`);
  if (errorCount > 0) console.log(`❌ Failed to save ${errorCount} records.`);

  console.log('🔢 Updating available slots via API (with Fuzzy Matching)...');
  
  // 1. Fetch all slots and adjudications into memory
  let allSlots = [];
  let page = 0;
  while(true) {
    const { data, error } = await supabase.from('slots').select('*').range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      console.error('⚠️ Error fetching slots:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allSlots.push(...data);
    page++;
  }
  const slots = allSlots;
  
  const { data: adjudications, error: adjError } = await supabase.from('adjudications').select('hospital_id, specialty_id');
  
  if (adjError) {
    console.error('⚠️ Error fetching adjudications:', adjError);
    process.exit(1);
  }

  // 2. Helper to normalize for fuzzy matching
  const tokenize = (id) => id.split('-').filter(w => !['de', 'y', 'la', 'el', 'en', 'h', 'c', 'udm', 'area', 'especializada', 'hospital', 'universitario'].includes(w) && w.length > 2);

  // 3. Count adjudications for each slot using fuzzy matching
  let updatedCount = 0;
  
  for (const slot of slots) {
    let matchCount = 0;
    const slotTokens = tokenize(slot.hospital_id);
    
    for (const adj of adjudications) {
      if (adj.specialty_id === slot.specialty_id) {
        // Exact match
        if (adj.hospital_id === slot.hospital_id) {
          matchCount++;
        } else {
          // Fuzzy match: check if one contains the other, or high token overlap
          if (adj.hospital_id.includes(slot.hospital_id) || slot.hospital_id.includes(adj.hospital_id)) {
            matchCount++;
          } else {
            const adjTokens = tokenize(adj.hospital_id);
            // Check if all important tokens from slot exist in adj
            const matches = slotTokens.filter(t => adjTokens.includes(t));
            // If we match at least 80% of the significant words
            if (slotTokens.length > 0 && matches.length / slotTokens.length >= 0.8) {
               matchCount++;
            }
          }
        }
      }
    }
    
    const newAvailable = Math.max(0, slot.total - matchCount);
    if (newAvailable !== slot.available) {
      await supabase.from('slots').update({ available: newAvailable }).eq('id', slot.id);
      updatedCount++;
    }
  }

  console.log(`✅ Updated ${updatedCount} slots successfully using fuzzy matching!`);
  
  process.exit(0);
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  // If it's already ISO
  if (dateStr.includes('T')) return dateStr;
  
  // Try to parse format "DD/MM/YYYY HH:mm:ss"
  try {
    const parts = dateStr.split(' ');
    if (parts.length === 2) {
      const [day, month, year] = parts[0].split('/');
      return `${year}-${month}-${day}T${parts[1]}Z`;
    }
  } catch (e) {
    // Ignore and return current
  }
  return new Date().toISOString();
}

runScraper();
