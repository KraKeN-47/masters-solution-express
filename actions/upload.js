const fetch = require('node-fetch')
const fs = require('fs')
const FormData = require('form-data')
const path = require('path');

const filePath = process.argv[2];
const uploadUrl = process.argv[3];
const machineType = process.argv[4];
const fetchUrl = `${uploadUrl}/${machineType}`
console.log({filePath, uploadUrl, machineType, fetchUrl})

async function uploadFile() {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return; 
    }

    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    formData.append('file', fileStream);

    const uploadStart = performance.now();
    console.log('fetching', fetchUrl)
    const response = await fetch(fetchUrl, {
      method: 'POST',
      body: formData,
      //  We need to disable SSL verification because we are using a self-signed certificate
      agent: new (require('https')).Agent({ rejectUnauthorized: false }),
    });
    const uploadEnd = performance.now();
    try {
      const filename = `${machineType}-${filePath.split(`demoFiles\\`)[1].split('.')[0]}-upload-perf.json`
      console.log('writing to', path.join(__dirname,`../display-tests/results-${machineType === 'VM' ? 'results-vm' : machineType === 'CVM' ? 'results-cvm' : 'results-local'}/api-response/${filename}`))
      fs.writeFileSync(path.join(__dirname,`../display-tests/${machineType === 'VM' ? 'results-vm' : machineType === 'CVM' ? 'results-cvm' : 'results-local'}/api-response/${filename}`),JSON.stringify({'Operacija': 'Laikas', 'Failo įkėlimo trukmė': uploadEnd-uploadStart}))
      console.log(`Upload endpoint took ${uploadEnd - uploadStart}ms`)
    } catch (error) {
      console.log(error)
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text();
    console.log('Upload successful. Response:', data);
  } catch (error) {
    console.error('Error during upload:', error);
  }
}

uploadFile();