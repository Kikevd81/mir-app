require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

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
  console.log('🕵️ Starting "Stealth Infiltrator" MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let interceptedData = null;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api/datos') && response.status() === 200) {
      try {
        const text = await response.text();
        if (text && text.includes('numOrden') && text.length > 50000) {
          const json = JSON.parse(text);
          const data = json.data || json;
          if (Array.isArray(data)) {
            console.log(`🎯 SUCCESS: Captured ${data.length} records!`);
            interceptedData = data;
          }
        }
      } catch (e) {}
    }
  });

  try {
    console.log('📡 Navigating to Portal (Stealth Mode)...');
    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });

    await new Promise(r => setTimeout(r, 4000));

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

    await new Promise(r => setTimeout(r, 6000));

    console.log('🖱️ Searching and clicking "Consultar"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, span, div'));
      const target = btns.find(b => b.innerText?.includes('Consultar') || b.textContent?.includes('Consultar'));
      if (target) {
        target.scrollIntoView();
        target.click();
      }
    });

    console.log('⏳ Waiting for data flow (up to 60s)...');
    for (let i = 0; i < 60; i++) {
      if (interceptedData) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (interceptedData) {
      await processAndSaveData(interceptedData);
      console.log('🏁 Scraper finished successfully!');
    } else {
      console.error('❌ Data capture failed even in Stealth Mode.');
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
  // Reusing the robust mapping logic
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
