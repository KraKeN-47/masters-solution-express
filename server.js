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
  const encryptedPath = path + `-${machineType}.enc`;

  const generateStart = performance.now();
  // Step 1: Generate local AES key
  const fileKey = generateDataKey();
  const generateEnd = performance.now();
  const generateResult = generateEnd - generateStart

  const wrapStart = performance.now();
  // Step 2: Wrap the file key using Azure Key Vault (Premium with HSM)
  const wrappedKey = await wrapKeyWithVault(originalname, fileKey, machineType);
  const wrapEnd = performance.now();
  const wrapResult = wrapEnd - wrapStart

  const encryptStart = performance.now();
  // Step 3: Encrypt file
  await encryptFile(path, encryptedPath, fileKey, wrappedKey);
  const encryptEnd = performance.now();
  const encryptResult = encryptEnd - encryptStart

  const uploadBlobsStart = performance.now();
  console.log('starting uploads')
  // Step 4: Upload to Azure Blob
  await Promise.all([
     uploadToBlob(encryptedPath, originalname,cvmBlobContainerClient, machineType),
     uploadToBlob(`${encryptedPath.split('.')[0]}-wrapped-key.${encryptedPath.split('.')[1]}`, `${originalname.split('.')[0]}-wrapped-key.${originalname.split('.')[1]}`,cvmBlobContainerClient, machineType)
  ])
  console.log('upload finished')
  const uploadBlobsEnd = performance.now();
  const uploadBlobsResult = uploadBlobsEnd - uploadBlobsStart
  
  // delete temp files
  fs.unlinkSync(path),
  fs.unlinkSync(encryptedPath)
  fs.unlinkSync(`${encryptedPath.split('.')[0]}-wrapped-key.${encryptedPath.split('.')[1]}`)
  
  const results = {
      'Operacija': 'Laikas', 
      'Šifravimo rakto užsandarinimas': wrapResult,
      'Rezultato užšifravimas': encryptResult,
      'Failų įkėlimas': uploadBlobsResult,
      'Bendras operacijų laikas': wrapResult + encryptResult + uploadBlobsResult,
  }
    const testResultsFilePath = `./test-results/${req.file.originalname.split('.')[0]}-upload-perf.json`
    fs.writeFileSync(`./test-results/${req.file.originalname.split('.')[0]}-upload-perf.json`,JSON.stringify(results));
    uploadToBlob(testResultsFilePath,`${req.file.originalname.split('.')[0]}-upload-perf.json`,testResultsBlobContainerClient, machineType)
    fs.unlinkSync(testResultsFilePath)


  res.send('File uploaded with HSM-backed key wrapping.');
});


app.get('/download/:filename/:machineType', async (req, res) => {
  console.log('Download start');
  const { machineType } = req.params;
  const { filename } = req.params;

  const startDownload = performance.now();
  // Step 1: Download encrypted blob
  const [encryptedBuffer,wrappedKey] = await Promise.all([
    downloadFromBlob(filename,cvmBlobContainerClient, machineType), 
    downloadFromBlob(`${filename.split('.')[0]}-wrapped-key.${filename.split('.')[1]}`,cvmBlobContainerClient, machineType)])
  const endDownload = performance.now();
  const downloadResult = endDownload - startDownload

  // Step 2: Unwrap file key from Vault (HSM prefered)
  const unwrapStart = performance.now();
  const fileKey = await unwrapKeyWithVault(filename, wrappedKey, machineType);
  const unwrapEnd = performance.now();
  const unwrapKeyWithVaultResult = unwrapEnd - unwrapStart

  if (!fileKey) return res.status(404).send('Key not found. File is irretrievable.');


  const decryptStart = performance.now();
  // Step 3: Decrypt and serve
  const decrypted = decryptBuffer(encryptedBuffer, fileKey);
  const decryptEnd = performance.now();
  const decryptResult = decryptEnd - decryptStart


  const downloadResults = {
    'Operacija': 'Laikas',
    'Failų atsisiuntimas': downloadResult,
    'Šifravimo rakto atsandarinimas': unwrapKeyWithVaultResult,
    'Failo atšifravimas': decryptResult,
    'Bendras operacijų laikas': downloadResult + unwrapKeyWithVaultResult + decryptResult,
  }
  const testResultsFilePath = `./test-results/${filename.split('.')[0]}-download-perf.json`
  fs.writeFileSync(testResultsFilePath,JSON.stringify(downloadResults));
  uploadToBlob(testResultsFilePath,`${filename.split('.')[0]}-download-perf.json`,testResultsBlobContainerClient, machineType)
  fs.unlinkSync(testResultsFilePath)

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(decrypted);
});

app.delete('/delete/:filename/:machineType', async (req, res) => {
  const { filename, machineType } = req.params;

  const deleteStart = performance.now();
  await Promise.all([
    deleteKeyFromVault(filename.split('.').join('-'),machineType),
    deleteBlob(filename, cvmBlobContainerClient, machineType),
    deleteBlob(`${filename.split('.')[0]}-wrapped-key.${filename.split('.')[1]}`, cvmBlobContainerClient, machineType),]
  );
  const deleteEnd = performance.now();
  
  const deletionResult = {
    'Operacija': 'Laikas',
    'Failo ištrinimas': deleteEnd - deleteStart,
  }
  const testResultsFilePath = `./test-results/${filename.split('.')[0]}-delete-perf.json`
  fs.writeFileSync(testResultsFilePath,JSON.stringify(deletionResult));
  uploadToBlob(testResultsFilePath,`${filename.split('.')[0]}-delete-perf.json`,testResultsBlobContainerClient, machineType)
  fs.unlinkSync(testResultsFilePath)

  res.send('Key deleted from HSM. File will be unrecoverable after 7 days.');
});


const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443, () => {
  console.log('App listening on port 443 (https)');
});
