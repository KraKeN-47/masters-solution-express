const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const deleteUrl = process.argv[2];

console.log({deleteUrl})

async function deleteFile() {
  try {
    const uploadStart = performance.now();
    const response = await fetch(deleteUrl, {
      method: 'DELETE', // Changed to POST
      //  We need to disable SSL verification because we are using a self-signed certificate
      agent: new (require('https')).Agent({ rejectUnauthorized: false }),
    });
    const uploadFinish = performance.now();
    const filename = `${deleteUrl.split('/delete/')[1].split('/')[1]}-${deleteUrl.split('/delete/')[1].split('/')[0].split('.')[0]}-delete-perf.json`
    const machineType = `${deleteUrl.split('/delete/')[1].split('/')[1]}`;
    fs.writeFileSync(path.join(__dirname,`../display-tests/${machineType === 'VM' ? 'results-vm' : machineType === 'CVM' ? 'results-cvm' : 'results-local'}/api-response/${filename}`),JSON.stringify({'Operacija': 'Laikas', 'Failo ištrynimo trukmė': uploadFinish-uploadStart}))
    console.table(`Delete endpoint took: ${uploadFinish - uploadStart}ms`)


    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text();
    console.log('Delete successful. Response:', data);
  } catch (error) {
    console.error('Error during deletion:', error);
  }
}

deleteFile();