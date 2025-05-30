const fs = require('node:fs/promises');
const path = require('node:path');
const { exec } = require('node:child_process');

// const rootUrl = 'https://20.238.26.218' // CVM-2
const rootUrl = 'https://4.231.233.82' // VM-2
// const rootUrl = 'https://4.231.232.86' // VM
// const rootUrl = 'https://20.13.168.243' // CVM
// const rootUrl = 'https://localhost' // LM
const uploadUrl = `${rootUrl}/upload`

const myVmType = process.argv[3]

if(!process.argv[2]) {
  console.error("Missing 1st argument: upload, delete, download")
  return;
}

if(!myVmType) {
  console.error("Missing 2nd argument vm type");
  return;
}

const downloadUrl = (fileName) => `${rootUrl}/download/${fileName}/${myVmType}`
const deleteUrl = (fileName) => `${rootUrl}/delete/${fileName}/${myVmType}`

async function wait(seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function executeCommand(command, filePath) {
  return new Promise((resolve, reject) => {
    exec(`${command} "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing ${command} for ${filePath}: ${error}`);
        console.error(`Stderr: ${stderr}`);
        reject(error);
        return;
      }
      // console.log(`Successfully executed ${command} for ${filePath}`);
      console.log(`Stdout: ${stdout}`);
      resolve();
    });
  });
}

const isUpload = process.argv[2] === 'upload';
const isDelete = process.argv[2] === 'delete';
const isDownload = process.argv[2] === 'download';

async function processFiles() {
  try {
    const files = await fs.readdir('./demoFiles');
    files.sort((a, b) => {
      const getSize = (filename) => {
        const match = filename.match(/(\d+)mb/i);
        return match ? parseInt(match[1]) : 0;
      };
      return getSize(a) - getSize(b);
    });

    const uploadFilePath = path.join(`${__dirname}/upload.js`)
    const deleteFilePath = path.join(`${__dirname}/delete.js`)
    const downloadFilePath = path.join(`${__dirname}/download.js`)
    for (const file of files) {
      const filePath = path.join(`${__dirname}/../demoFiles`, file);

      console.log(`Processing file: ${filePath}`);

      if(isUpload) {
        await executeCommand(`node ${uploadFilePath} ${filePath} ${uploadUrl} ${myVmType}`,filePath);
      }
      if(isDelete) {
        await executeCommand(`node ${deleteFilePath} ${deleteUrl(file)}`,filePath);
      }
      if(isDownload) {
        await executeCommand(`node ${downloadFilePath} ${downloadUrl(file)} ${file}`, filePath);
      }
      await wait(20);
    }

    console.log('All files processed!');

  } catch (err) {
    console.error('Error reading directory:', err);
  }
}

processFiles();
