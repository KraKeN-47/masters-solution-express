const { KeyClient, CryptographyClient } = require('@azure/keyvault-keys');
const { DefaultAzureCredential } = require('@azure/identity');

const credential = new DefaultAzureCredential();
const keyClient = new KeyClient(process.env.AZURE_KEYVAULT_URI, credential);

async function wrapKeyWithVault(fileId, fileKey, machineType) {
  const keyName = `${machineType}-file-${fileId}`.split('.').join('-');
  console.log('creating key')
  // const key = await keyClient.createKey(keyName, 'RSA-HSM', {
  //   keyOps: ['wrapKey', 'unwrapKey']
  // });
  const key = await keyClient.createKey(keyName, 'RSA', {
    keyOps: ['wrapKey', 'unwrapKey'],
  });
  console.log('key created')
  const cryptoClient = new CryptographyClient(key.id, credential);
  const result = await cryptoClient.wrapKey('RSA-OAEP', fileKey);
  console.log('key wrapped')
  return result.result;
}

async function unwrapKeyWithVault(fileId,wrappedKeyBuffer,machineType) {
  const keyName = `${machineType}-file-${fileId}`.split('.').join('-');
  try {
    console.log(keyName)
    const key = await keyClient.getKey(keyName.split('.').join('-'));
    const cryptoClient = new CryptographyClient(key.id, credential);
    const result = await cryptoClient.unwrapKey('RSA-OAEP', wrappedKeyBuffer);
    return result.result;
  } catch (err) {
    console.log("Error")
    console.log(err)
    return null;
  }
}

async function deleteKeyFromVault(fileId, machineType) {
  const keyName = `${machineType}-file-${fileId}`;
  await keyClient.beginDeleteKey(keyName);
}

module.exports = { wrapKeyWithVault, unwrapKeyWithVault, deleteKeyFromVault };
