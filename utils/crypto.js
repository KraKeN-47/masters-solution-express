const crypto = require('crypto');
const fs = require('fs');

function generateDataKey() {
  return crypto.randomBytes(32); // 256-bit AES key
}

function encryptFile(inputPath, outputPath, key,wrappedKey) {
  return new Promise((resolve, reject) => {
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    output.write(iv); // prepend IV
  
    input.pipe(cipher).pipe(output).on('finish', () => {
      const encryptedOutput = fs.readFileSync(outputPath)
      // Create a 4-byte buffer for the length of unencrypted data
      const metadataBuffer = Buffer.alloc(4);
      // insert metadata on wrapped keys buffer length
      metadataBuffer.writeUInt32BE(wrappedKey.length);
      metadataBuffer.writeUInt32BE(encryptedOutput.length);
      // Append metadata and unencrypted data
      fs.writeFileSync(`${outputPath}-wrapped-key`,wrappedKey)
      // fs.writeFileSync(outputPath,Buffer.concat([metadataBuffer,wrappedKey,encryptedOutput]),);
      resolve();
    }).on('error', reject);
  });
}

function decryptBuffer(buffer, key) {
  const iv = buffer.subarray(0, 16);
  const data = buffer.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = { generateDataKey, encryptFile, decryptBuffer };

