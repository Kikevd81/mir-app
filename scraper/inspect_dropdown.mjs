import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function inspectDropdown() {
  console.log('🚀 Inspecting all degree options...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );
    await new Promise(r => setTimeout(r, 15000));

    await page.click('ng-select');
    await new Promise(r => setTimeout(r, 2000));

    const options = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.ng-option'));
      return items.map(i => ({
        text: i.innerText,
        html: i.outerHTML
      }));
    });

    console.log(`✅ Found ${options.length} options:`);
    options.forEach((o, i) => console.log(`[${i}] ${o.text}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectDropdown();
