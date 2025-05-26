const fetch = require('node-fetch')
const fs = require('fs')
const { pipeline } = require('stream/promises')
const path = require('path')

const downloadUrl = process.argv[2]
const downloadPath = `./downloads/downloaded_${process.argv[3]}`; // Explicit output path

console.log({downloadUrl,downloadPath})

async function downloadFile() {
  try {
    const downloadEndpointStart = performance.now();
    const response = await fetch(downloadUrl, {
      method: 'GET',
      // We need to disable SSL verification because we are using a self-signed certificate
      agent: new (require('https')).Agent({ rejectUnauthorized: false }),
    });
    const downloadEndpointEnd = performance.now();
    try {
      const filename = `${downloadUrl.split('/download/')[1].split('/')[1]}-${downloadUrl.split('/download/')[1].split('/')[0].split('.')[0]}-download-perf.json`
      const machineType = `${downloadUrl.split('/download/')[1].split('/')[1]}`;
      console.log('writing to', path.join(__dirname,`../display-tests/results-${machineType === 'VM' ? 'results-vm' : machineType === 'CVM' ? 'results-cvm' : 'results-local'}/api-response/${filename}`))
      fs.writeFileSync(path.join(__dirname,`../display-tests/${machineType === 'VM' ? 'results-vm' : machineType === 'CVM' ? 'results-cvm' : 'results-local'}/api-response/${filename}`),JSON.stringify({'Operacija': 'Laikas', 'Failo atsisiuntimo trukmė': downloadEndpointEnd-downloadEndpointStart}))
      console.log(`Download endpoint took ${downloadEndpointEnd - downloadEndpointStart}ms`)
    } catch (error) {
      console.log(error)
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Ensure the directory exists
    const fileStream = fs.createWriteStream(downloadPath);
    // Use pipeline to handle stream completion and errors
    await pipeline(response.body, fileStream);

    console.log('Download successful. File saved to:', downloadPath);
  } catch (error) {
    console.error('Error during download:', error);
  }
}

downloadFile();
