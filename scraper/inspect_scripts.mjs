import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function inspectScripts() {
  console.log('🚀 Inspecting page scripts for hidden API endpoints...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );
    await new Promise(r => setTimeout(r, 15000));

    const scriptContents = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.map(s => s.src);
    });

    console.log('📜 External Scripts:');
    scriptContents.forEach(s => console.log(`- ${s}`));

    // Search for keywords in the inline scripts or just dump them
    const inlineScripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script:not([src])')).map(s => s.innerText);
    });
    console.log(`📜 Found ${inlineScripts.length} inline scripts.`);

    // Try to find the API base URL and some endpoints
    const matches = await page.evaluate(() => {
        const text = document.body.innerHTML;
        const regex = /hera\/api\/[a-zA-Z0-9\/_-]+/g;
        return Array.from(new Set(text.match(regex) || []));
    });
    console.log('🔗 Found API-like strings in HTML:');
    matches.forEach(m => console.log(`- ${m}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectScripts();
