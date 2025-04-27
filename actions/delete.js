const fetch = require('node-fetch');

const deleteUrl = process.argv[2];

console.log({deleteUrl})

async function deleteFile() {
  try {
    const uploadStart = performance.now();
    const response = await fetch(deleteUrl, {
      method: 'DELETE', // Changed to POST, as requested, though DELETE is more typical.
      //  We need to disable SSL verification because we are using localhost with a self-signed certificate
      agent: new (require('https')).Agent({ rejectUnauthorized: false }),
    });
    const uploadFinish = performance.now();
    console.table(`Delete endpoint took: ${uploadFinish - uploadStart}ms`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text(); // Or response.json(), depending on server response
    console.log('Delete successful. Response:', data);
  } catch (error) {
    console.error('Error during deletion:', error);
  }
}

deleteFile();