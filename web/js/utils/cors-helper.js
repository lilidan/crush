/**
 * CORS Helper utilities for Browser Crush
 * Helps handle CORS issues when calling LLM APIs from browser
 */

class CORSHelper {
    static checkCORSSupport() {
        return new Promise((resolve) => {
            // Test if we can make a simple request to detect CORS issues
            fetch('https://api.anthropic.com/v1/messages', {
                method: 'OPTIONS',
                mode: 'cors'
            })
            .then(() => resolve(true))
            .catch(() => resolve(false));
        });
    }

    static async detectProxyNeeded() {
        try {
            const response = await fetch('http://localhost:3001/test', {
                method: 'GET',
                timeout: 1000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    static showCORSError(provider) {
        const errorMsg = `
🚫 CORS Error: Cannot access ${provider} API directly from browser

📋 Solutions:

1. 🔧 Use Local CORS Proxy (Recommended):
   • Run: node cors-proxy.js
   • This starts a local proxy server on port 3001
   • Automatically handles CORS headers

2. 🌐 Use Public CORS Proxy (Less secure):
   • Uses cors-anywhere.herokuapp.com
   • May have rate limits and reliability issues

3. 🖥️ Use Browser Extension:
   • Install "CORS Unblock" or similar extension
   • Only for development, not recommended for production

4. 🔀 Switch to Ollama (Local):
   • Run Ollama locally (no CORS issues)
   • Download models like codellama or llama2

Would you like to:
• Try the local CORS proxy?
• Switch to a different provider?
• Use browser in dev mode (--disable-web-security)?
        `;

        return errorMsg;
    }

    static getProxyInstructions() {
        return `
🚀 Setting up Local CORS Proxy:

1. Open terminal in the /web directory
2. Run: node cors-proxy.js
3. Keep the terminal open (proxy runs on port 3001)
4. Refresh Browser Crush and try again

The proxy server will show logs of all requests.
        `;
    }

    static async tryWithFallback(primaryFetch, fallbackOptions = {}) {
        try {
            // Try primary request first
            return await primaryFetch();
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                // Likely a CORS error
                if (fallbackOptions.showError) {
                    console.error(this.showCORSError(fallbackOptions.provider || 'API'));
                }
                
                if (fallbackOptions.useProxy) {
                    // Try with proxy
                    return await fallbackOptions.proxyFetch();
                }
            }
            throw error;
        }
    }

    static createProxyURL(originalUrl, proxyBase = 'http://localhost:3001/') {
        return proxyBase + originalUrl;
    }

    static isLikelyCORSError(error) {
        return error.name === 'TypeError' && 
               (error.message.includes('fetch') || 
                error.message.includes('CORS') ||
                error.message.includes('Network'));
    }

    static async testConnection(url, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                mode: 'no-cors' // Just test connectivity
            });
            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            clearTimeout(timeoutId);
            return false;
        }
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.CORSHelper = CORSHelper;
}