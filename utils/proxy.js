import { HttpsProxyAgent } from 'https-proxy-agent';
export const header = "reference-code/verify?code=AG8AKX"
import { logger } from './logger.js';
export function createProxyAgent(proxyUrl) {
    if (!proxyUrl) {
        logger('No proxy provided, using direct connection.', 'warn');
        return null;
    }
    try {
        return new HttpsProxyAgent(proxyUrl);
    } catch (error) {
        logger('Error creating proxy agent:', 'error', error);
        return null;
    }
}
export function getNextProxy(proxies, currentIndex) {
    if (proxies.length === 0) return null;
    return {
        proxy: proxies[currentIndex % proxies.length],
        nextIndex: (currentIndex + 1) % proxies.length
    };    
}
