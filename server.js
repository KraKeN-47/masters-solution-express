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
const table = require('table');

const upload = multer({ dest: 'uploads/' });
const app = express();

app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('Upload start')
  const { originalname, path } = req.file;
  const encryptedPath = path + '.enc';

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
     uploadToBlob(encryptedPath, originalname),
     uploadToBlob(`${encryptedPath}-wrapped-key`, `${originalname}-wrapped-key`)
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

  
  const results = [
      ['Operation', 'Time'], // Table header
      ['Encryption generation', `${generateResult}ms`],
      ['Wrapping of encryption key', `${wrapResult}ms`],
      ['Encrypt result', `${encryptResult}ms`],
      ['Upload blobs', `${uploadBlobsResult}ms`],
      ['Delete temp files', `${deleteTempFilesResult}ms`],
      ['Total time', `${generateResult + wrapResult + encryptResult + uploadBlobsResult + deleteTempFilesResult}ms`]
    ];
    const tableOutput = table.table(results)
    fs.writeFileSync(`./test-results/${req.file.originalname.split('.')[0]}-upload-perf.txt`,tableOutput);
  

  res.send('File uploaded with HSM-backed key wrapping.');
});


app.get('/download/:filename', async (req, res) => {
  console.log('Download start');
  const { filename } = req.params;

  const startDownload = performance.now();
  // Step 1: Download encrypted blob
  const [encryptedBuffer,wrappedKey] = await Promise.all([
    downloadFromBlob(filename), 
    downloadFromBlob(`${filename}-wrapped-key`)])
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


  const downloadResults = [
    ['Operation', 'Time'],
    ['Blob download', `${downloadResult}ms`],
    ['Unwrap encryption key with Key Vault', `${unwrapKeyWithVaultResult}ms`],
    ['File decryption', `${decryptResult}ms`],
    ['Total time', `${downloadResult + unwrapKeyWithVaultResult + decryptResult}ms`]
  ];

  const tableOutput = table.table(downloadResults);
  fs.writeFileSync(`./test-results/${filename.split('.')[0]}-download-perf.txt`,tableOutput);
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(decrypted);
});

app.delete('/delete/:filename', async (req, res) => {
  const { filename } = req.params;

  const deleteStart = performance.now();
  await Promise.all([
    deleteKeyFromVault(filename.split('.').join('-')),
    deleteBlob(filename),
    deleteBlob(`${filename}-wrapped-key`),]
  );
  const deleteEnd = performance.now();
  
  const deletionResult = [
    ['Operation', 'Time'],
    ['Deleted all resources', `${deleteEnd - deleteStart}ms`],
  ];
  const tableOutput = table.table(deletionResult);
  fs.writeFileSync(`./test-results/${filename.split('.')[0]}-delete-perf.txt`,tableOutput);
  
  res.send('Key deleted from HSM. File will be unrecoverable after 7 days.');
});


const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443, () => {
  console.log('App listening on port 443 (https)');
});
