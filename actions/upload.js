const fetch = require('node-fetch')
const fs = require('fs')
const FormData = require('form-data')

const filePath = process.argv[2];
const uploadUrl = process.argv[3];

console.log({filePath, uploadUrl})

async function uploadFile() {
  try {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return; // Early return
    }

    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    formData.append('file', fileStream);

    const uploadStart = performance.now();
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      // node-fetch doesn't automatically set the 'Content-Type'
      //  when using FormData.  It's crucial to *not* set it manually.
      //  FormData will set the correct boundary.
      // headers: { 'Content-Type': 'multipart/form-data' }, // Remove this line
      //  We need to disable SSL verification because we are using localhost with a self-signed certificate
      agent: new (require('https')).Agent({ rejectUnauthorized: false }),
    });
    const uploadEnd = performance.now();
    console.log(`Upload endpoint took ${uploadEnd - uploadStart}ms`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text(); // Or response.json(), depending on server response
    console.log('Upload successful. Response:', data);
  } catch (error) {
    console.error('Error during upload:', error);
  }
}

uploadFile();