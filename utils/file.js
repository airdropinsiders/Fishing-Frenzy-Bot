import fs from 'fs';

export function loadTokensFromFile(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return data.split('\n').map(line => line.trim()).filter(line => line !== '');
  } catch (error) {
    console.error(`Error reading tokens from file: ${filename}`, error.message);
    return [];
  }
}

export function loadProxiesFromFile(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return data.split('\n').map(line => line.trim()).filter(line => line !== '');
  } catch (error) {
    console.error(`Error reading proxies from file: ${filename}`, error.message);
    return [];
  }
}
