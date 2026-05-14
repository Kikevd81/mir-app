import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function checkResponseTypes() {
  console.log('🚀 Checking response types for all requests...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'];
      if (url.includes('hera/api') || contentType?.includes('pdf') || contentType?.includes('octet-stream')) {
          console.log(`📡 [${status}] ${contentType} -> ${url}`);
      }
    });

    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );

    await new Promise(r => setTimeout(r, 15000));
    await page.click('ng-select');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 200));
    }
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    await page.click('button.btn-primary');
    await new Promise(r => setTimeout(r, 20000));

    console.log('🖨️ Clicking "Print"...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Print'));
        if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 15000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkResponseTypes();
