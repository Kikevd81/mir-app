const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');

dotenv.config();
puppeteer.use(StealthPlugin());

async function testApi() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  console.log('📡 Capturing tokens...');
  await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', { waitUntil: 'networkidle2' });
  
  const tokens = await page.evaluate(async () => {
    // Wait for tokens to appear
    let attempts = 0;
    while (attempts < 10) {
      const auth = localStorage.getItem('token');
      const xsrf = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1];
      if (auth && xsrf) return { auth, xsrf };
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }
    return {
      auth: localStorage.getItem('token'),
      xsrf: document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1]
    };
  });

  if (!tokens.auth) {
    console.error('❌ Failed to capture tokens');
    await browser.close();
    return;
  }

  const variations = [
    { name: 'pageNumber=0,1', params: (p) => `pageNumber=${p}&pageSize=5` },
    { name: 'page=0,1', params: (p) => `page=${p}&size=5` },
    { name: 'offset=0,5', params: (p) => `offset=${p === 0 ? 0 : 5}&limit=5` },
    { name: 'inicio=1,6', params: (p) => `inicio=${p === 0 ? 1 : 6}&fin=${p === 0 ? 5 : 10}` }
  ];

  for (const v of variations) {
    console.log(`\n🧪 Testing: ${v.name}`);
    for (let p = 0; p < 2; p++) {
      const url = `https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&${v.params(p)}`;
      try {
        const res = await page.evaluate(async (url, auth, xsrf) => {
          const r = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${auth}`,
              'X-XSRF-TOKEN': xsrf,
              'Process-Type': 'MENU'
            }
          });
          return await r.json();
        }, url, tokens.auth, tokens.xsrf);

        if (Array.isArray(res)) {
          const ids = res.slice(0, 3).map(r => r.numorden || r.n_ORDEN);
          console.log(`   ${url} -> First 3 IDs: ${ids.join(', ')}`);
        } else {
          console.log(`   ${url} -> Not an array`);
        }
      } catch (e) {
        console.log(`   ${url} -> Error: ${e.message}`);
      }
    }
  }

  await browser.close();
}

testApi();
