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
  console.log('🚀 Starting "Hunter" MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let interceptedData = null;

  // Passive hunter: listen for any large JSON response
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api/datos') && response.status() === 200) {
      try {
        const text = await response.text();
        if (text && text.length > 5000) { // Large enough to be the real list
          const json = JSON.parse(text);
          const data = json.data || json;
          if (Array.isArray(data) && data.length > 500) {
            console.log(`🎯 TARGET ACQUIRED: Captured ${data.length} records from ${url}`);
            interceptedData = data;
          }
        }
      } catch (e) {
        // Silent fail for non-JSON or small responses
      }
    }
  });

  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`📡 Attempt ${attempt}/5: Navigating to Ministry Portal...`);
      await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      console.log('🖱️ Selecting MEDICINA...');
      await page.evaluate(async () => {
        const selects = document.querySelectorAll('select');
        for (const s of selects) {
          if (s.innerText.includes('MEDICINA') || s.innerHTML.includes('MEDICINA')) {
            s.value = s.options[1].value;
            s.dispatchEvent(new Event('change'));
            return true;
          }
        }
        return false;
      });

      await new Promise(r => setTimeout(r, 3000));

      console.log('🖱️ Clicking Consultar...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.innerText.includes('Consultar') || b.textContent.includes('Consultar'));
        if (target) {
          target.click();
          return true;
        }
        return false;
      });

      // Wait up to 20 seconds for the hunter to catch the data
      console.log('⏳ Waiting for data to flow...');
      for (let i = 0; i < 20; i++) {
        if (interceptedData) break;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (interceptedData) break;
      console.log('⚠️ No data captured in this attempt. Retrying...');
    }

    if (interceptedData) {
      await processAndSaveData(interceptedData);
      console.log('🏁 Scraper finished successfully!');
    } else {
      console.error('❌ Failed to capture data after 5 attempts. The Ministry portal might be under heavy load.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Scraper error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function processAndSaveData(data) {
  console.log(`📊 Processing ${data.length} records...`);
  
  const { data: specialties } = await supabase.from('specialties').select('*');
  const specialtyMap = new Map(specialties.map(s => [s.name.toLowerCase(), s.id]));

  const { data: existingSlots } = await supabase.from('slots').select('hospital_id');
  const existingHospitalIds = [...new Set(existingSlots.map(s => s.hospital_id))];

  const findBestHospitalId = (hospName, province, locality) => {
    const normName = normalizeText(hospName);
    const normProv = normalizeText(province);
    const normLoc = normalizeText(locality);
    
    // Exact match patterns
    const p1 = `${normProv}-${normLoc}-${normName}`;
    const p2 = `${normProv}-${normName}`;
    
    if (existingHospitalIds.includes(p1)) return p1;
    if (existingHospitalIds.includes(p2)) return p2;
    
    // Fuzzy search
    const match = existingHospitalIds.find(id => id.includes(normName));
    return match || p2;
  };

  const findBestSpecialtyId = (specName) => {
    const norm = specName.toLowerCase();
    if (specialtyMap.has(norm)) return specialtyMap.get(norm);
    for (const [name, id] of specialtyMap.entries()) {
      if (norm.includes(name) || name.includes(norm)) return id;
    }
    return generateId(specName);
  };

  const BATCH_SIZE = 100;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const upserts = batch.map(item => {
      const sName = item.descEspecialidad || item.descespecialidad;
      const hName = item.descCentro || item.desccentro;
      const prov = item.descProvincia || item.descprovincia;
      const loc = item.descLocalidad || item.desclocalidad || prov;

      return {
        order_number: item.numOrden || item.numorden,
        specialty_name: sName,
        hospital_name: hName,
        province: prov,
        locality: loc,
        region: item.descComunidad || item.desccomunidad,
        specialty_id: findBestSpecialtyId(sName),
        hospital_id: findBestHospitalId(hName, prov, loc)
      };
    });

    const { error } = await supabase.from('adjudications').upsert(upserts, { onConflict: 'order_number' });
    if (error) console.error('❌ Upsert error:', error.message);
  }

  console.log('🔄 Sincronizando disponibilidad...');
  const { error: rpcError } = await supabase.rpc('update_available_slots');
  if (rpcError) console.error('❌ RPC Error:', rpcError.message);
}

runScraper();
