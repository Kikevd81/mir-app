async function searchInJS() {
  const url = 'https://fse.sanidad.gob.es/fseweb/main.ec170405c96a5c3e.js';
  console.log(`📡 Fetching ${url}...`);
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    const regex = /hera\/api\/[a-zA-Z0-9\/_-]+/g;
    const matches = Array.from(new Set(text.match(regex) || []));
    
    console.log('🔗 Found API endpoints in JS:');
    matches.sort().forEach(m => console.log(`- ${m}`));

    console.log('\n🔍 Searching for "PDF" or "Print" related logic...');
    const pdfRegex = /[a-zA-Z0-9_.-]+pdf[a-zA-Z0-9_.-]*/gi;
    const pdfMatches = Array.from(new Set(text.match(pdfRegex) || []));
    console.log('📄 PDF-related terms:');
    pdfMatches.slice(0, 50).forEach(m => console.log(`- ${m}`));

    // Specific search for report/export
    const exportRegex = /[a-zA-Z0-9\/_-]*(export|report|listado)[a-zA-Z0-9\/_-]*/gi;
    const exportMatches = Array.from(new Set(text.match(exportRegex) || []));
    console.log('\n📦 Export-related endpoints/terms:');
    exportMatches.slice(0, 50).forEach(m => console.log(`- ${m}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchInJS();
