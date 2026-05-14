import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function takeSearchScreenshot() {
  console.log('📸 Taking screenshot after Medicine search...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
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

    await page.screenshot({ path: 'scraper/search_results_medicine.png', fullPage: true });
    console.log('✅ Screenshot saved: scraper/search_results_medicine.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

takeSearchScreenshot();
