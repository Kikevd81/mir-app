
const puppeteer = require('puppeteer');

async function inspectResponses() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('📡 Navigating and capturing responses...');
  
  const responses = {};

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('getPlazasAdjudicadas')) {
      try {
        const text = await response.text();
        responses[url] = text;
        console.log(`✅ Captured: ${url} (${text.length} bytes)`);
      } catch (e) {
        console.log(`❌ Failed to capture ${url}: ${e.message}`);
      }
    }
  });

  await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', { 
    waitUntil: 'networkidle2',
    timeout: 60000 
  });
  
  await new Promise(r => setTimeout(r, 10000));

  for (const [url, body] of Object.entries(responses)) {
    console.log(`\n--- ${url} ---\n`);
    console.log(body.substring(0, 1000));
  }

  await browser.close();
}

inspectResponses();
