// app.js
require('dotenv').config()
const express = require('express');
const multer = require('multer');
const https = require('https');
const fs = require('fs');
const {
  encryptFile,
  decryptBuffer,
  generateDataKey
} = require('./utils/crypto');
const {
  uploadToBlob,
  downloadFromBlob,
  deleteBlob
} = require('./services/blob');
const {
  wrapKeyWithVault, 
  unwrapKeyWithVault, 
  deleteKeyFromVault
} = require('./services/keyvault');
const { BlobServiceClient } = require('@azure/storage-blob');

const upload = multer({ dest: 'uploads/' });
const app = express();

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const cvmBlobContainerClient = blobServiceClient.getContainerClient('cvm-blob');
const testResultsBlobContainerClient = blobServiceClient.getContainerClient('test-results')

app.post('/upload/:machineType', upload.single('file'), async (req, res) => {
  console.log('Upload start')
  const { machineType } = req.params;
  const { originalname, path } = req.file;
  const encryptedPath = path + `${machineType}.enc`;

  const generateStart = performance.now();
  // Step 1: Generate local AES key
  const fileKey = generateDataKey();
  const generateEnd = performance.now();
  const generateResult = generateEnd - generateStart

  const wrapStart = performance.now();
  // Step 2: Wrap the file key using Azure Key Vault (Premium with HSM)
  const wrappedKey = await wrapKeyWithVault(originalname, fileKey);
  const wrapEnd = performance.now();
  const wrapResult = wrapEnd - wrapStart

  const encryptStart = performance.now();
  // Step 3: Encrypt file
  await encryptFile(path, encryptedPath, fileKey, wrappedKey);
  const encryptEnd = performance.now();
  const encryptResult = encryptEnd - encryptStart

  const uploadBlobsStart = performance.now();
  // Step 4: Upload to Azure Blob
  await Promise.all([
     uploadToBlob(encryptedPath, originalname,cvmBlobContainerClient),
     uploadToBlob(`${encryptedPath}-wrapped-key`, `${originalname}-wrapped-key`,cvmBlobContainerClient)
  ])
  const uploadBlobsEnd = performance.now();
  const uploadBlobsResult = uploadBlobsEnd - uploadBlobsStart
  
  const deleteTempFilesStart = performance.now();
  // delete temp files
  fs.unlinkSync(path),
  fs.unlinkSync(encryptedPath)
  fs.unlinkSync(`${encryptedPath}-wrapped-key`)
  const deleteTempFilesEnd = performance.now();
  const deleteTempFilesResult = deleteTempFilesEnd - deleteTempFilesStart

  
  const results = {
      'Operation': 'Time', 
      'Wrapping of encryption key': wrapResult,
      'Encrypt result': encryptResult,
      'Upload blobs': uploadBlobsResult,
      'Total operation times': wrapResult + encryptResult + uploadBlobsResult,
      'Total api exec time': generateResult + wrapResult + encryptResult + uploadBlobsResult + deleteTempFilesResult
  }
    const testResultsFilePath = `./test-results/${req.file.originalname.split('.')[0]}-upload-perf.json`
    fs.writeFileSync(`./test-results/${req.file.originalname.split('.')[0]}-upload-perf.json`,JSON.stringify(results));
    uploadToBlob(testResultsFilePath,`${req.file.originalname.split('.')[0]}-upload-perf.json`,testResultsBlobContainerClient)


  res.send('File uploaded with HSM-backed key wrapping.');
});


app.get('/download/:filename', async (req, res) => {
  console.log('Download start');
  const { filename } = req.params;

  const startDownload = performance.now();
  // Step 1: Download encrypted blob
  const [encryptedBuffer,wrappedKey] = await Promise.all([
    downloadFromBlob(filename,cvmBlobContainerClient), 
    downloadFromBlob(`${filename}-wrapped-key`,cvmBlobContainerClient)])
  const endDownload = performance.now();
  const downloadResult = endDownload - startDownload

  // Step 2: Unwrap file key from Vault (HSM prefered)
  const unwrapStart = performance.now();
  const fileKey = await unwrapKeyWithVault(filename, wrappedKey);
  const unwrapEnd = performance.now();
  const unwrapKeyWithVaultResult = unwrapEnd - unwrapStart

  if (!fileKey) return res.status(404).send('Key not found. File is irretrievable.');


  const decryptStart = performance.now();
  // Step 3: Decrypt and serve
  const decrypted = decryptBuffer(encryptedBuffer, fileKey);
  const decryptEnd = performance.now();
  const decryptResult = decryptEnd - decryptStart


  const downloadResults = {
    'Operation': 'Time',
    'Blob download': downloadResult,
    'Unwrap encryption key with Key Vault': unwrapKeyWithVaultResult,
    'File decryption': decryptResult,
    'Total operation times': downloadResult + unwrapKeyWithVaultResult + decryptResult,
    'Total time': downloadResult + unwrapKeyWithVaultResult + decryptResult
  }
  const testResultsFilePath = `./test-results/${filename.split('.')[0]}-download-perf.json`
  fs.writeFileSync(testResultsFilePath,JSON.stringify(downloadResults));
  uploadToBlob(testResultsFilePath,`${filename.split('.')[0]}-download-perf.json`,testResultsBlobContainerClient)

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(decrypted);
});

app.delete('/delete/:filename', async (req, res) => {
  const { filename } = req.params;

  const deleteStart = performance.now();
  await Promise.all([
    deleteKeyFromVault(filename.split('.').join('-')),
    deleteBlob(filename, cvmBlobContainerClient),
    deleteBlob(`${filename}-wrapped-key`, cvmBlobContainerClient),]
  );
  const deleteEnd = performance.now();
  
  const deletionResult = {
    'Operation': 'Time',
    'Total operation times': deleteEnd - deleteStart,
  }
  const testResultsFilePath = `./test-results/${filename.split('.')[0]}-delete-perf.json`
  fs.writeFileSync(testResultsFilePath,JSON.stringify(deletionResult));
  uploadToBlob(testResultsFilePath,`${filename.split('.')[0]}-delete-perf.json`,testResultsBlobContainerClient)

  res.send('Key deleted from HSM. File will be unrecoverable after 7 days.');
});


const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443, () => {
  console.log('App listening on port 443 (https)');
});
