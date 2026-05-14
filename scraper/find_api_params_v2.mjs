async function findApiParams() {
  const url = 'https://fse.sanidad.gob.es/fseweb/main.ec170405c96a5c3e.js';
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // Find context around getPlazasAdjudicadas
    const index = text.indexOf('getPlazasAdjudicadasTotal');
    if (index !== -1) {
        console.log('🔍 Found getPlazasAdjudicadasTotal in JS. Extracting context...');
        console.log(text.substring(index - 100, index + 500));
    } else {
        console.log('❌ Could not find getPlazasAdjudicadasTotal in JS.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findApiParams();
