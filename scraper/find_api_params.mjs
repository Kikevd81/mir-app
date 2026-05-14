async function findApiParams() {
  const url = 'https://fse.sanidad.gob.es/fseweb/main.ec170405c96a5c3e.js';
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // Find context around getPlazasAdjudicadas
    const index = text.indexOf('getPlazasAdjudicadas');
    if (index !== -1) {
        console.log('🔍 Found getPlazasAdjudicadas in JS. Extracting context...');
        console.log(text.substring(index - 500, index + 1000));
    } else {
        console.log('❌ Could not find getPlazasAdjudicadas in JS.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findApiParams();
