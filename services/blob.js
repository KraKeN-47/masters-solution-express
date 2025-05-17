async function uploadToBlob(filePath, filename, client) {
  const blockBlobClient = client.getBlockBlobClient(filename);
  console.log('starting blob upload', filePath, filename)
  await blockBlobClient.uploadFile(filePath);
}

async function downloadFromBlob(filename, client) {
  const blockBlobClient = client.getBlockBlobClient(filename);
  const downloadResponse = await blockBlobClient.download();
  return await streamToBuffer(downloadResponse.readableStreamBody);
}

async function deleteBlob(filename, client) {
  const blockBlobClient = client.getBlockBlobClient(filename);
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
