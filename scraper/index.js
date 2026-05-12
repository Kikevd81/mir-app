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
  console.log('🚀 Starting "Blind Hunter" MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let interceptedData = null;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api/datos') && response.status() === 200) {
      try {
        const text = await response.text();
        // ANY large file with 'numOrden' is our target
        if (text && text.includes('numOrden') && text.length > 30000) {
          const json = JSON.parse(text);
          const data = json.data || json;
          if (Array.isArray(data) && data.length > 100) {
            console.log(`🎯 TARGET ACQUIRED: Captured ${data.length} records from ${url.substring(0, 50)}...`);
            interceptedData = data;
          }
        }
      } catch (e) {}
    }
  });

  try {
    console.log('📡 Navigating to Portal...');
    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
      waitUntil: 'networkidle2',
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
        }
      }
    });

    await new Promise(r => setTimeout(r, 5000));

    console.log('🔄 Brute-forcing all buttons...');
    await page.evaluate(() => {
      // Click everything that looks like a button or a search link
      const clickable = document.querySelectorAll('button, a, .btn, [role="button"]');
      clickable.forEach(el => {
        if (el.innerText?.includes('Consultar') || el.textContent?.includes('Consultar') || el.innerHTML.includes('search')) {
          el.click();
        }
      });
    });

    console.log('⏳ Waiting for data flow...');
    for (let i = 0; i < 30; i++) {
      if (interceptedData) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (interceptedData) {
      await processAndSaveData(interceptedData);
      console.log('🏁 Scraper finished successfully!');
    } else {
      console.log('❌ No data captured. Taking debug screenshot...');
      await page.screenshot({ path: 'debug_portal.png' });
      console.log('📸 Screenshot saved as debug_portal.png. Check artifacts if possible.');
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
  console.log(`📊 Saving ${data.length} records...`);
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
      specialty_id: specialtyMap.get(sName.toLowerCase()) || generateId(sName),
      hospital_id: findBestHospitalId(hName, item.descProvincia || '', item.descLocalidad || '')
    };
  }).filter(Boolean);

  const BATCH_SIZE = 200;
  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    await supabase.from('adjudications').upsert(upserts.slice(i, i + BATCH_SIZE), { onConflict: 'order_number' });
  }
  await supabase.rpc('update_available_slots');
}

runScraper();
