import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';
import bs58 from 'bs58';
import { exit } from 'process';
import { validateHIPHeader } from './hip-validation';
// @ts-ignore
import Hash from 'ipfs-only-hash';

dotenv.config();

const { PINATA_KEY, PINATA_SECRET } = process.env as {
  PINATA_KEY: string;
  PINATA_SECRET: string;
};

// https://ethereum.stackexchange.com/questions/44506/ipfs-hash-algorithm
async function getHash(data: string) {
  return Hash.of(data);
}

async function uploadToPinata(source: string) {
  if (!PINATA_KEY) throw new Error('PINATA_KEY env must be set');
  if (!PINATA_SECRET) throw new Error('PINATA_SECRET env must be set');
  const data = new FormData();
  data.append('file', new Blob([source]));
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    body: data,
    headers: {
      pinata_api_key: PINATA_KEY,
      pinata_secret_api_key: PINATA_SECRET,
    },
  });

  if (!res.ok) {
    throw Error(await res.text());
  }

  const result = await res.json();

  if (result.error) throw { message: result.error };
  return result;
}

async function uploadToTheGraph(source: string) {
  const data = new FormData();
  data.append('file', new Blob([source]));
  const res = await fetch('https://api.thegraph.com/ipfs/api/v0/add', {
    method: 'POST',
    body: data,
  });
  return await res.json();
}

async function main(argv: any) {
  const filePath = path.join(process.cwd(), argv.source);
  const hipName = path.parse(filePath).name;
  const ipfsFilename = `./content/ipfs-hips/${hipName}-ipfs-hashes.json`;
  const content = readFileSync(filePath, 'utf8');
  validateHIPHeader(content);

  const hash = await getHash(content);
  const bs58Hash = `0x${Buffer.from(bs58.decode(hash)).slice(2).toString('hex')}`;

  const fileExists = existsSync(ipfsFilename);
  if (fileExists) {
    const data = JSON.parse(readFileSync(ipfsFilename, 'utf8'));
    if (data.hash === hash) {
      console.log(`skipping as uploaded with same hash already: ${hipName}`);
      return;
    }
  }

  if (argv.upload.toLowerCase() === 'true') {
    const [pinata, thegraph] = await Promise.all([uploadToPinata(content), uploadToTheGraph(content)]);
    if (argv.verbose.toLowerCase() === 'true') {
      console.log('pinata response', pinata);
      console.log('thegraph response', thegraph);
    }
  }

  writeFileSync(ipfsFilename, JSON.stringify({ name: hipName, hash, encodedHash: bs58Hash }));

  // log as hex to console so foundry can read the content
  console.log('ipfsHash:', bs58Hash);
}

(async () => {
  try {
    const args = require('minimist')(process.argv.slice(2));
    console.log('args', args);

    await main(args);
  } catch (e) {
    console.error(`Exiting [aip-uploader] process due next error: \n ${e}`);
    exit(1);
  }
})();
