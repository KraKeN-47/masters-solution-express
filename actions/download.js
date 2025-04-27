const fetch = require('node-fetch')
const fs = require('fs')
const { pipeline } = require('stream/promises') // Use the promise-based version

const downloadUrl = process.argv[2]
const downloadPath = `./downloads/downloaded_${process.argv[3]}`; // Explicit output path

console.log({downloadUrl,downloadPath})

async function downloadFile() {
  try {
    const downloadEndpointStart = performance.now();
    const response = await fetch(downloadUrl, {
      method: 'GET',
      //  We need to disable SSL verification because we are using localhost with a self-signed certificate
      agent: new (require('https')).Agent({ rejectUnauthorized: false }),
    });
    const downloadEndpointEnd = performance.now();
    console.log(`Download endpoint took ${downloadEndpointEnd - downloadEndpointStart}ms`)

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
