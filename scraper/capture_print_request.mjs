import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function triggerPrintAndCapture() {
  console.log('🚀 Triggering "Print" button for MEDICINA...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('hera/api') || url.includes('report') || url.includes('pdf')) {
        requests.push({
          url: url,
          method: request.method(),
          postData: request.postData(),
          headers: request.headers()
        });
      }
    });

    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );

    await new Promise(r => setTimeout(r, 15000));

    console.log('🔘 Selecting MEDICINA...');
    await page.click('ng-select');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 200));
    }
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 2000));
    console.log('🔍 Clicking Search...');
    await page.click('button.btn-primary');

    console.log('⏳ Waiting for results to load...');
    await new Promise(r => setTimeout(r, 20000));

    console.log('🖨️ Clicking "Print" button...');
    const printClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const printBtn = buttons.find(b => b.innerText.includes('Print'));
        if (printBtn) {
            printBtn.click();
            return true;
        }
        return false;
    });

    if (printClicked) {
        console.log('✅ Clicked Print button. Waiting for network requests...');
        await new Promise(r => setTimeout(r, 15000));
    } else {
        console.log('❌ Could not find Print button.');
    }

    console.log('\n=== Captured Requests after Print Click ===');
    requests.forEach((req, i) => {
       console.log(`[${i}] ${req.method} ${req.url}`);
       if (req.postData) console.log(`    Body: ${req.postData}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

triggerPrintAndCapture();
