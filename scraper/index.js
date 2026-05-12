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
  console.log('🚀 Starting "X-Ray Hunter" MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage', 
      '--window-size=1920,1080',
      '--disable-web-security' // Help with some intercept issues
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  let interceptedData = null;

  // X-Ray Logging: Print ALL data-related URLs to debug in GitHub Actions
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api/datos')) {
      console.log(`🌐 Request detected: ${url}`);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api/datos') && response.status() === 200) {
      try {
        const text = await response.text();
        if (text && text.includes('numOrden')) {
          const json = JSON.parse(text);
          const data = json.data || json;
          if (Array.isArray(data) && data.length > 100) {
            console.log(`🎯 TARGET ACQUIRED! Captured ${data.length} records.`);
            interceptedData = data;
          }
        }
      } catch (e) {}
    }
  });

  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      console.log(`📡 Attempt ${attempt}/2: Navigating...`);
      await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
        waitUntil: 'networkidle0', // Wait for all requests to finish
        timeout: 60000
      });

      await new Promise(r => setTimeout(r, 5000));
      
      console.log('🖱️ Selecting MEDICINA...');
      await page.evaluate(() => {
        const selects = document.querySelectorAll('select');
        for (const s of selects) {
          if (s.innerHTML.includes('MEDICINA')) {
            s.value = 'M';
            s.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      });

      console.log('⏳ Waiting for UI to update (10s)...');
      await new Promise(r => setTimeout(r, 10000));

      console.log('🖱️ Clicking Consultar (Physical Click Simulation)...');
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a.btn, span, div.btn'));
        const target = btns.find(b => b.innerText?.includes('Consultar') || b.textContent?.includes('Consultar'));
        if (target) {
          target.scrollIntoView();
          const rect = target.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return null;
      });

      if (clicked) {
        await page.mouse.click(clicked.x, clicked.y);
        console.log(`✅ Mouse clicked at ${clicked.x}, ${clicked.y}`);
      } else {
        console.log('⚠️ Could not find Consultar button with current selectors.');
      }

      console.log('⏳ Watching network for the data packet...');
      for (let i = 0; i < 40; i++) {
        if (interceptedData) break;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (interceptedData) break;
      console.log('⚠️ Attempt failed. The data did not flow.');
    }

    if (interceptedData) {
      await processAndSaveData(interceptedData);
      console.log('🏁 Scraper finished successfully!');
    } else {
      console.error('❌ Data capture failed. Check the logs for "🌐 Request detected" to see which URLs were called.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function processAndSaveData(data) {
  console.log(`📊 Saving ${data.length} records to Supabase...`);
  // Mapping logic is already tested and working, reusing it...
  const { data: specialties } = await supabase.from('specialties').select('*');
  const specialtyMap = new Map(specialties.map(s => [s.name.toLowerCase(), s.id]));
  const { data: existingSlots } = await supabase.from('slots').select('hospital_id');
  const existingHospitalIds = [...new Set(existingSlots.map(s => s.hospital_id))];

  const findBestHospitalId = (hospName, province, locality) => {
    const normName = normalizeText(hospName);
    const p1 = `${normalizeText(province)}-${normalizeText(locality)}-${normName}`;
    const p2 = `${normalizeText(province)}-${normName}`;
    return existingHospitalIds.includes(p1) ? p1 : (existingHospitalIds.includes(p2) ? p2 : p2);
  };

  const findBestSpecialtyId = (specName) => {
    const norm = specName.toLowerCase();
    return specialtyMap.get(norm) || generateId(specName);
  };

  const upserts = data.map(item => {
    const sName = item.descEspecialidad || item.descespecialidad;
    const hName = item.descCentro || item.desccentro;
    if (!sName || !hName) return null;
    return {
      order_number: item.numOrden || item.numorden,
      specialty_name: sName,
      hospital_name: hName,
      province: item.descProvincia || item.descprovincia,
      locality: item.descLocalidad || item.desclocalidad || item.descProvincia,
      region: item.descComunidad || item.desccomunidad,
      specialty_id: findBestSpecialtyId(sName),
      hospital_id: findBestHospitalId(hName, item.descProvincia || '', item.descLocalidad || '')
    };
  }).filter(Boolean);

  const BATCH_SIZE = 200;
  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    const { error } = await supabase.from('adjudications').upsert(upserts.slice(i, i + BATCH_SIZE), { onConflict: 'order_number' });
    if (error) console.error('❌ Upsert error:', error.message);
  }

  console.log('🔄 Triggering availability update...');
  await supabase.rpc('update_available_slots');
}

runScraper();
