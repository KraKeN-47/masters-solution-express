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

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = 3000;

app.post('/upload', upload.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const encryptedPath = path + '.enc';

  // Step 1: Generate local AES key
  const fileKey = generateDataKey();

  // Step 2: Wrap the file key using Azure Key Vault (Premium with HSM)
  const wrappedKey = await wrapKeyWithVault(originalname, fileKey);

  // Step 3: Encrypt file
  await encryptFile(path, encryptedPath, fileKey, wrappedKey);

  // Step 4: Upload to Azure Blob
  await uploadToBlob(encryptedPath, originalname);
  await uploadToBlob(`${encryptedPath}-wrapped-key`, `${originalname}-wrapped-key`);

  // delete temp files
  fs.unlinkSync(path);
  fs.unlinkSync(encryptedPath);
  res.send('File uploaded with HSM-backed key wrapping.');
});


app.get('/download/:filename', async (req, res) => {
  const { filename } = req.params;

  // Step 1: Download encrypted blob
  const encryptedBuffer = await downloadFromBlob(filename);
  const wrappedKey = await downloadFromBlob(`${filename}-wrapped-key`)
  // Step 2: Unwrap file key from HSM
  const fileKey = await unwrapKeyWithVault(filename, wrappedKey);
  console.log('FileKey', fileKey)
  if (!fileKey) return res.status(404).send('Key not found. File is irretrievable.');


  // Step 3: Decrypt and serve
  const decrypted = await decryptBuffer(encryptedBuffer, fileKey);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(decrypted);
});

app.delete('/delete/:filename', async (req, res) => {
  const { filename } = req.params;

  // Step 1: Delete wrapped key from HSM
  // await deleteKeyFromVault(filename.split('.').join('-'));

  // Step 2: Optionally delete file from Blob
  await deleteBlob(filename);
  await deleteBlob(`${filename}-wrapped-key`);

  res.send('Key deleted from HSM. File is now unrecoverable.');
});


const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443, () => {
  console.log('Express app listening on port 443 (HTTPS)');
});
