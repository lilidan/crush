#!/bin/bash

# Browser Crush CORS Proxy Startup Script
# This script starts the CORS proxy server required for Claude API access

echo "🚀 Starting Browser Crush CORS Proxy..."
echo ""
echo "📋 This proxy server is needed to:"
echo "   • Allow browser access to Claude API (bypasses CORS restrictions)"
echo "   • Secure proxy for Anthropic and OpenAI APIs"
echo "   • Local server - your API keys stay private"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if cors-proxy.js exists
if [ ! -f "cors-proxy.js" ]; then
    echo "❌ cors-proxy.js not found!"
    echo "   Make sure you're running this script from the /web directory"
    exit 1
fi

echo "🔧 Starting CORS proxy server..."
echo "   Press Ctrl+C to stop the server"
echo ""

# Start the proxy server
node cors-proxy.js