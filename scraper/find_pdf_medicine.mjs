import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function findPdfForMedicine() {
  console.log('🚀 Searching for PDF export request for MEDICINA...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('api') || url.includes('report') || url.includes('download') || url.includes('pdf')) {
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
    // Press ArrowDown 5 times to reach MEDICINA
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 200));
    }
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 2000));
    console.log('🔍 Clicking Search...');
    await page.click('button.btn-primary');

    console.log('⏳ Waiting for data...');
    await new Promise(r => setTimeout(r, 25000));

    const rowCount = await page.evaluate(() => document.querySelectorAll('tr').length);
    console.log(`✅ Table has ${rowCount} rows.`);

    if (rowCount > 0) {
        console.log('🔍 Looking for PDF button...');
        const buttonResult = await page.evaluate(() => {
          const icons = Array.from(document.querySelectorAll('.fa-file-pdf, .fa-print, .fa-download'));
          if (icons.length > 0) {
              const target = icons[0].parentElement;
              target.click();
              return { found: true, html: target.outerHTML };
          }
          return { found: false };
        });

        if (buttonResult.found) {
            console.log(`✅ Clicked PDF button: ${buttonResult.html}`);
            await new Promise(r => setTimeout(r, 15000));
        } else {
            console.log('❌ No PDF icons found.');
        }
    }

    console.log('\n=== Captured Interesting Requests ===');
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

findPdfForMedicine();
