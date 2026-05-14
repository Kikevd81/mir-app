import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function tryDownloadPdf() {
  console.log('🚀 Attempting to download PDF...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const downloadPath = path.resolve('scraper/downloads');
    
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
    }

    // Set download behavior
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
    });

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

    console.log('🖨️ Clicking "Print"...');
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Print'));
        if (btn) btn.click();
    });

    console.log('⏳ Waiting 45 seconds for download to start/finish...');
    await new Promise(r => setTimeout(r, 45000));

    const files = fs.readdirSync(downloadPath);
    console.log(`✅ Files in download dir: ${files.join(', ')}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

tryDownloadPdf();
