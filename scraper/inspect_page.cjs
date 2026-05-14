
const puppeteer = require('puppeteer');

async function inspect() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('📡 Navigating to Ministry page (same as main scraper)...');
  
  let authToken, xsrfToken;
  page.on('request', request => {
    const url = request.url();
    const headers = request.headers();
    if (url.includes('getPlazasAdjudicadas')) {
      console.log(`🎯 Found API Request: ${url}`);
      if (headers['authorization']) authToken = headers['authorization'];
      if (headers['x-xsrf-token']) xsrfToken = headers['x-xsrf-token'];
    }
  });

  try {
    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('Waiting for potential async loads...');
    await new Promise(r => setTimeout(r, 10000));

    console.log(`🔑 Tokens found: Auth=${authToken ? 'Yes' : 'No'}, XSRF=${xsrfToken ? 'Yes' : 'No'}`);
    
    const content = await page.evaluate(() => document.body.innerText);
    console.log('📄 Page text snippet:', content.substring(0, 500));

  } catch (e) {
    console.error(`❌ Error during navigation: ${e.message}`);
  }

  await browser.close();
}

inspect();
