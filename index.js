const { exec } = require('child_process');
const util = require('util');
const { jwtDecode } = require('jwt-decode')
const execPromise = util.promisify(exec);
const crypto = require('crypto');
const nonce = crypto.randomBytes(16).toString('base64');

async function runCommand() {
  try {
    console.log("Generated nonce: ",nonce)
    console.log("Getting attestation JWT")
    const { stdout, stderr } = await execPromise(`sudo ./AttestationClient -n ${nonce} -o token`);
    console.log("JWT Retrieved.")
    console.log('JWT Output:', jwtDecode(stdout));
    const jwt = jwtDecode(stdout);
    // await execPromise(`echo ${JSON.stringify(jwt)} > ./decoded.txt`)

    if(jwt['secureboot'] === true && 
        jwt['x-ms-attestation-type'] === 'azurevm' && 
        jwt['x-ms-isolation-tee']['x-ms-attestation-type'] === 'sevsnpvm' &&
        jwt['x-ms-isolation-tee']['x-ms-compliance-status'] === 'azure-compliant-cvm' &&
        jwt['x-ms-runtime']['keys'][0]['kid'] === 'TpmEphemeralEncryptionKey' &&
        // nonce in the jwt is base64 encoded
        jwt['x-ms-runtime']['client-payload']['nonce'] === Buffer.from(nonce).toString('base64')
    ) {
        console.log("JWT Attestation passed");
        await execPromise('node ./server.js')
    }
    if (stderr) console.error('Error:', stderr);
  } catch (error) {
    console.error('Failed to execute command:', error);
  }
}

runCommand();