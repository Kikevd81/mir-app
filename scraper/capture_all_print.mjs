import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function captureAllAfterPrint() {
  console.log('🚀 Capturing ALL requests after Print click...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    });

    browser.on('targetcreated', async target => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            console.log(`🆕 New tab opened: ${newPage.url()}`);
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

    console.log(`\nCaptured ${requests.length} total requests.`);
    // Filter out some noise (static assets)
    const filtered = requests.filter(r => !r.url.includes('.js') && !r.url.includes('.css') && !r.url.includes('.png'));
    filtered.forEach((req, i) => {
       console.log(`[${i}] ${req.method} ${req.url}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

captureAllAfterPrint();
