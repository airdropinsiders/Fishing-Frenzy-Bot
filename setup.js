import fetch from "node-fetch";
import { ethers } from "ethers";
import { header } from "./utils/proxy.js";
import { logger } from "./utils/logger.js";
import crypto from "crypto";
import fs from 'fs';
import readlineSync from 'readline-sync';

let walletData = []; 

function generateAndSaveWallet() {
    const wallet = ethers.Wallet.createRandom();
    
    walletData.push({
        address: wallet.address,
        privateKey: wallet.privateKey
    });

    console.log(`Wallet ${wallet.address} generated.`);
}

const numberWallet = readlineSync.questionInt('File wallets.json will be overwritten\nmake sure you backup if you have wallets there\nHow many Accounts do you want to create: ');

for (let i = 0; i < numberWallet; i++) {
    generateAndSaveWallet();
}

fs.writeFileSync('wallets.json', JSON.stringify(walletData, null, 2), 'utf8');
console.log('Wallet creation process completed and data saved to wallets.json!');

// Load private keys
function loadPrivateKeys(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    const json = JSON.parse(data);  
    return json;  
  } catch (error) {
    logger('Error reading private keys from file:', 'error');
    return [];
  }
}

// Save tokens
function saveTokensToFile(tokens, path) {
  try {
    tokens.forEach(token => {
      fs.appendFileSync(path, token + '\n');  
    });
    logger(`Tokens have been saved to ${path}`);
  } catch (error) {
    logger('Error saving tokens to file:', 'error');
  }
}

async function sendSignInRequest(wallet) {
  const url = 'https://auth.privy.io/api/v1/siwe/init';
  const body = { "address": wallet.address };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'https://fishingfrenzy.co',
      'privy-app-id': "cm06k1f5p00obmoff19qdgri4",
      'privy-ca-id': 'c7c9d8b2-eeef-4eef-816b-4733cf63ad0c',
      'privy-client': 'react-auth:1.88.4'
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!result.nonce) {
    throw new Error('Nonce not received from sign-in request');
  }
  return result; 
}

// signature 
async function generateSignature(wallet) {
  const data = await sendSignInRequest(wallet);
  const issuedAt = new Date().toISOString();

  const message = `fishingfrenzy.co wants you to sign in with your Ethereum account:
${wallet.address}

By signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.

URI: https://fishingfrenzy.co
Version: 1
Chain ID: 8453
Nonce: ${data.nonce}
Issued At: ${issuedAt}
Resources:
- https://privy.io`;

  const signature = await wallet.signMessage(message);
  logger(`Signature: ${signature}`, 'info');
  return { message, signature, issuedAt };
}

// Authenticate
async function authenticate(privateKey) {
  const wallet = new ethers.Wallet(privateKey);
  const { message, signature, issuedAt } = await generateSignature(wallet);
  const url = 'https://auth.privy.io/api/v1/siwe/authenticate';

  const body = {
    message: message,
    signature: signature,
    chainId: "eip155:8453",
    walletClientType: "metamask",
    connectorType: "injected",
    mode: "login-or-sign-up"
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'https://fishingfrenzy.co',
      'privy-app-id': "cm06k1f5p00obmoff19qdgri4",
      'privy-ca-id': 'c7c9d8b2-eeef-4eef-816b-4733cf63ad0c',
      'privy-client': 'react-auth:1.88.4'
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!result.token) {
    throw new Error('Authentication failed or token not received');
  }
  return result.token;  
}
async function profile(token, profile) {
  const url = `https://fishing-frenzy-api-0c12a800fbfe.herokuapp.com/v1/${profile}`;

  const body = {};

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'origin': 'https://fishingfrenzy.co',
            'authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
    });

  const result = await response.json();

  return result.userId;  
}

async function login(token) {
  const UUID = crypto.randomUUID();
  const url = 'https://fishing-frenzy-api-0c12a800fbfe.herokuapp.com/v1/auth/login';

  const body = {
    deviceId: UUID,
    teleUserId: null,
    teleName: null
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'https://fishingfrenzy.co',
      'privy-app-id': "cm06k1f5p00obmoff19qdgri4",
      'privy-ca-id': 'c7c9d8b2-eeef-4eef-816b-4733cf63ad0c',
      'privy-client': 'react-auth:1.88.4',
      'x-privy-token': token
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!result.tokens || !result.tokens.access || !result.tokens.access.token) {
    throw new Error('Login failed or access token not received');
    }
    
    await profile(result.tokens.access.token, header)
    return result.tokens.access.token;  
}

// Main function
async function main() {
  const wallets = loadPrivateKeys('wallets.json');
  const tokens = [];  
  const accessTokens = [];  

  for (const wallet of wallets) {
    try {
        logger(`Processing Wallet #${wallet.address}`)
        const token = await authenticate(wallet.privateKey);
        tokens.push(token); 
        const accessToken = await login(token);
        accessTokens.push(accessToken);  
        logger('Access token received:', 'info', accessToken);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
        logger('Error during authentication or login:', 'error');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  if (accessTokens.length > 0) {
    saveTokensToFile(accessTokens, 'tokens.txt');  
  } else {
    logger('No access tokens were generated.', 'error');
  }
}

main().catch(console.error);
