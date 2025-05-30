const crypto = require('crypto');
const fs = require('fs');

function generateDataKey() {
  return crypto.randomBytes(32); // 256-bit AES key
}

function encryptFile(inputPath, outputPath, key,wrappedKey) {
  return new Promise((resolve, reject) => {
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    console.log({inputPath, outputPath})
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    output.write(iv); // prepend IV
  
    input.pipe(cipher).pipe(output).on('finish', () => {
      console.log('writing', `${outputPath.split('.')[0]}-wrapped-key.${outputPath.split('.')[1]}`)
      fs.writeFileSync(`${outputPath.split('.')[0]}-wrapped-key.${outputPath.split('.')[1]}`,wrappedKey)
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

