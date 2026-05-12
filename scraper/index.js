require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

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

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const generateId = (text) => normalizeText(text);

async function runScraper() {
  console.log('🚀 Starting Robust MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  let capturedRecords = new Map();
  let finished = false;

  page.on('response', async (response) => {
    const url = response.url();
    // Log ANY response from the sanidad.gob.es domain
    if (url.includes('sanidad.gob.es')) {
       const size = response.headers()['content-length'] || 'unknown';
       console.log(`📡 Intercepted: ${url.substring(0, 100)}... (Status: ${response.status()}, Type: ${response.headers()['content-type']}, Size: ${size})`);
    }
    
    // Broaden the filter for the data
    if (url.includes('getPlazasAdjudicadas') || url.includes('plazasAdjudicadas') || url.includes('adjudicacion')) {
      if (response.status() === 200) {
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const json = await response.json();
            console.log(`📦 JSON Intercepted from ${url.substring(0, 50)}... Keys: ${Object.keys(json).join(', ')}`);
            let newData = Array.isArray(json) ? json : (json.data || json.content || json.plazas || json.listado || []);
            if (newData.length > 0) {
              console.log(`📊 Found ${newData.length} items in JSON. Sample: ${JSON.stringify(newData[0]).substring(0, 100)}`);
              if (newData[0].numOrden || newData[0].numorden || newData[0].num_orden) {
                newData.forEach(item => {
                  const order = item.numOrden || item.numorden || item.num_orden;
                  if (order) capturedRecords.set(order, item);
                });
                console.log(`✅ Captured ${newData.length} records. Total: ${capturedRecords.size}`);
                finished = true;
              }
            }
          }
        } catch (e) {}
      }
    }
  });

  const targetUrl = 'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas';
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`📡 Attempt ${attempt}: Navigating to ${targetUrl}...`);
    try {
      await page.goto(targetUrl, { timeout: 60000, waitUntil: 'domcontentloaded' }).catch(() => {});
      
      // Wait for the page to at least start loading Angular
      await new Promise(r => setTimeout(r, 10000));
      
      // Try to interact if needed (sometimes selecting the titulacion triggers the API)
      const dropdowns = await page.$$('ng-select');
      if (dropdowns.length > 0) {
        console.log('🖱️ Found dropdowns, selecting MEDICINA...');
        await dropdowns[0].click();
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.type('MEDICINA');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));
        
        // Find and click the search button
        console.log('🖱️ Clicking Consultar button...');
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => b.textContent.includes('Consultar') || b.textContent.includes('BUSCAR'));
          if (target) {
            target.scrollIntoView();
            target.click();
          }
        });
      }

      // Wait and check if we got data
      for (let i = 0; i < 30; i++) {
        if (finished) break;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (finished) break;
    } catch (err) {
      console.log(`⚠️ Attempt ${attempt} failed: ${err.message}`);
    }
  }

  await browser.close();

  const data = Array.from(capturedRecords.values());
  if (data.length > 0) {
    console.log(`💾 Processing ${data.length} adjudications...`);
    await processAndSaveData(data);
  } else {
    console.error('❌ Scraper failed to capture any data after multiple attempts.');
    process.exit(1);
  }
}

async function processAndSaveData(data) {
  console.log('📊 Fetching reference data for matching...');
  const { data: specialties } = await supabase.from('specialties').select('*');
  const specialtyMap = new Map(specialties.map(s => [s.name.toLowerCase(), s.id]));

  // Fetch unique hospital IDs from slots to build a matching map
  const { data: existingSlots } = await supabase.from('slots').select('hospital_id');
  const existingHospitalIds = [...new Set(existingSlots.map(s => s.hospital_id))];

  console.log(`🔎 Found ${existingHospitalIds.length} unique hospital IDs in database.`);

  const findBestHospitalId = (hospName, province, locality) => {
    const normName = normalizeText(hospName);
    const normProv = normalizeText(province);
    const normLoc = normalizeText(locality);
    
    // Pattern 1: province-locality-hospital (Valencia case)
    const p1 = `${normProv}-${normLoc}-${normName}`;
    if (existingHospitalIds.includes(p1)) return p1;
    
    // Pattern 2: province-hospital
    const p2 = `${normProv}-${normName}`;
    if (existingHospitalIds.includes(p2)) return p2;
    
    // Pattern 3: Just the name (if unique)
    if (existingHospitalIds.includes(normName)) return normName;
    
    // Pattern 4: Fuzzy match - find ID that contains the hospital name
    const match = existingHospitalIds.find(id => id.includes(normName));
    if (match) return match;

    return p2; // Fallback
  };

  const findBestSpecialtyId = (specName) => {
    const norm = specName.toLowerCase();
    if (specialtyMap.has(norm)) return specialtyMap.get(norm);
    
    // Try fuzzy match on specialties
    for (const [name, id] of specialtyMap.entries()) {
      if (norm.includes(name) || name.includes(norm)) return id;
    }
    
    return generateId(specName);
  };

  const BATCH_SIZE = 50;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const upserts = batch.map(item => {
      const specialtyName = item.descEspecialidad || item.descespecialidad;
      const hospitalName = item.descCentro || item.desccentro;
      const province = item.descProvincia || item.descprovincia;
      const locality = item.descLocalidad || item.desclocalidad || province;

      return {
        order_number: item.numOrden || item.numorden,
        specialty_name: specialtyName,
        hospital_name: hospitalName,
        province: province,
        locality: locality,
        region: item.descComunidad || item.desccomunidad,
        specialty_id: findBestSpecialtyId(specialtyName),
        hospital_id: findBestHospitalId(hospitalName, province, locality)
      };
    });

    const { error } = await supabase.from('adjudications').upsert(upserts, { onConflict: 'order_number' });
    if (error) console.error('❌ Error in batch upsert:', error.message);
    
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= data.length) {
      console.log(`⏳ Progress: ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} records processed.`);
    }
  }

  console.log('🔄 Triggering SQL sync...');
  await supabase.rpc('update_available_slots');
  
  await supabase.from('scraper_config').update({
    last_scrape_at: new Date().toISOString(),
    last_scrape_status: 'success',
    total_adjudications_processed: data.length,
    updated_at: new Date().toISOString()
  }).limit(1);

  console.log('✅ Done!');
}

runScraper();
