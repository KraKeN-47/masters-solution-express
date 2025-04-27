const { exec } = require('child_process');
const util = require('util');
const { jwtDecode } = require('jwt-decode')
const execPromise = util.promisify(exec);
const crypto = require('crypto');
const { exit } = require('process');
const nonce = crypto.randomBytes(16).toString('base64');

async function runCommand() {
  try {
    console.log("Generated nonce: ",nonce)
    console.log("Getting attestation JWT")
    const { stdout, stderr } = await execPromise(`sudo ../confidential-computing-cvm-guest-attestation/cvm-attestation-sample-app/AttestationClient -n ${nonce} -o token`);
    
    if (stderr) {console.error('Error:', stderr); return;}
    
    console.log("JWT Retrieved.")
    console.log('JWT Output:', JSON.stringify(jwtDecode(stdout),null,4));
    const jwt = jwtDecode(stdout);
    // await execPromise(`echo ${JSON.stringify(jwt)} > ./decoded.txt`)

    if(jwt['secureboot'] === true && 
        jwt['x-ms-attestation-type'] === 'azurevm' && 
        jwt['x-ms-isolation-tee']['x-ms-attestation-type'] === 'sevsnpvm' &&
        jwt['x-ms-isolation-tee']['x-ms-compliance-status'] === 'azure-compliant-cvm' &&
        jwt['x-ms-isolation-tee']['vm-configuration']['secure-boot'] === true &&
        jwt['x-ms-isolation-tee']['vm-configuration']['tpm-enabled'] === true &&
        jwt['x-ms-runtime']['keys'][0]['kid'] === 'TpmEphemeralEncryptionKey' &&
        // nonce in the jwt is base64 encoded
        jwt['x-ms-runtime']['client-payload']['nonce'] === Buffer.from(nonce).toString('base64') &&
        jwt['iss'].includes('attest.azure.net')
    ) {
        console.log("JWT Attestation passed");
        exit(0)
    }
  } catch (error) {
    console.error('Failed to execute command:', error);
    exit(1)
  }
}

runCommand();