const response = await fetch('https://fse.sanidad.gob.es/hera/oauth/api/v1/oidc/token', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'client_id=herapublico&grant_type=client_no_identification&state=test-state-123'
});
console.log('Status:', response.status);
const text = await response.text();
console.log('Body:', text);
