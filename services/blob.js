async function uploadToBlob(filePath, filename, client, machineType) {
  const blockBlobClient = client.getBlockBlobClient(`${machineType}-${filename}`, filename.includes('perf') ? {tags: [`${machineType}-perf`]} : undefined);
  console.log('starting blob upload', filePath, filename)
  await blockBlobClient.uploadFile(filePath);
}

async function downloadFromBlob(filename, client, machineType) {
  console.log('trying to download', `${machineType}-${filename}`)
  const blockBlobClient = client.getBlockBlobClient(`${machineType}-${filename}`);
  const downloadResponse = await blockBlobClient.download();
  return await streamToBuffer(downloadResponse.readableStreamBody);
}

async function deleteBlob(filename, client, machineType) {
  const blockBlobClient = client.getBlockBlobClient(`${machineType}-${filename}`);
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
