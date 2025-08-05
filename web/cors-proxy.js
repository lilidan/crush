/**
 * Simple CORS Proxy Server for Browser Crush
 * Allows the browser application to call LLM APIs that don't support CORS
 * 
 * Usage: node cors-proxy.js
 * Then use http://localhost:3001 as the proxy URL
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// Allowed target hosts for security
const ALLOWED_HOSTS = [
    'api.openai.com',
    'api.anthropic.com',
    'localhost'
];

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse the target URL from the request
    const targetUrl = req.url.slice(1); // Remove leading slash
    
    if (!targetUrl || !targetUrl.startsWith('http')) {
        res.writeHead(400);
        res.end('Invalid target URL');
        return;
    }

    try {
        const parsedUrl = url.parse(targetUrl);
        
        // Security check - only allow specific hosts
        if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
            res.writeHead(403);
            res.end('Host not allowed');
            return;
        }

        // Choose the appropriate module (http or https)
        const httpModule = parsedUrl.protocol === 'https:' ? https : http;

        // Forward headers (excluding some problematic ones)
        const forwardHeaders = { ...req.headers };
        delete forwardHeaders.host;
        delete forwardHeaders.origin;
        delete forwardHeaders.referer;

        // Create the proxy request
        const proxyReq = httpModule.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
            method: req.method,
            headers: forwardHeaders
        }, (proxyRes) => {
            // Forward response headers
            Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
            });

            // Forward status code
            res.writeHead(proxyRes.statusCode);

            // Pipe the response
            proxyRes.pipe(res);
        });

        // Handle errors
        proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err);
            res.writeHead(500);
            res.end('Proxy error: ' + err.message);
        });

        // Forward the request body for POST requests
        if (req.method === 'POST' || req.method === 'PUT') {
            req.pipe(proxyReq);
        } else {
            proxyReq.end();
        }

    } catch (error) {
        console.error('URL parsing error:', error);
        res.writeHead(400);
        res.end('Invalid URL');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 CORS Proxy Server running on http://localhost:${PORT}`);
    console.log(`📖 Usage: Access APIs through http://localhost:${PORT}/[TARGET_URL]`);
    console.log(`📖 Example: http://localhost:${PORT}/https://api.anthropic.com/v1/messages`);
    console.log(`🔒 Allowed hosts: ${ALLOWED_HOSTS.join(', ')}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down CORS proxy server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});