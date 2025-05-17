const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

// Your Azure Storage connection string and container name
const AZURE_STORAGE_CONNECTION_STRING = ``;
if(AZURE_STORAGE_CONNECTION_STRING.length === 0) {
  console.error('missing azure storage connection string')
  return;
}
const CONTAINER_NAME = 'test-results';

let DIR;
const machineType = process.argv[3];

if(machineType === 'VM') { DIR = 'results-vm'}
if(machineType === 'LM') { DIR = 'results-local'}
if(machineType === 'CVM') { DIR = 'results-cvm'}

function blobFilterCondition(blobName) {
  return blobName.includes(machineType);
}

async function downloadBlobsByCondition() {
  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  console.log(`Listing blobs in container "${CONTAINER_NAME}"...`);

  let count = 0;

  // List and iterate blobs
  for await (const blob of containerClient.listBlobsFlat()) {
    console.log(blob)
    const blobName = blob.name;

    if (blobFilterCondition(blobName)) {
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const downloadFilePath = path.join(DIR, blobName);

      // Ensure subdirectories exist
      fs.mkdirSync(path.dirname(downloadFilePath), { recursive: true });

      console.log(`Downloading blob: ${blobName} -> ${downloadFilePath}`);

      await blockBlobClient.downloadToFile(downloadFilePath);
      
      count++;
    }
  }

  console.log(`✅ Downloaded ${count} blobs to "${DIR}"`);
}

downloadBlobsByCondition().catch(console.error);
