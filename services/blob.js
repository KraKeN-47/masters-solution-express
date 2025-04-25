const { BlobServiceClient } = require('@azure/storage-blob');

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient('cvm-blob');

async function uploadToBlob(filePath, filename) {
  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  await blockBlobClient.uploadFile(filePath);
}

async function downloadFromBlob(filename) {
  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  const downloadResponse = await blockBlobClient.download();
  return await streamToBuffer(downloadResponse.readableStreamBody);
}

async function deleteBlob(filename) {
  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  console.log('deleting', filename)
  await blockBlobClient.deleteIfExists();
  console.log('deleted if exists')
}

async function streamToBuffer(readableStream) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = { uploadToBlob, downloadFromBlob, deleteBlob };
