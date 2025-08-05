#!/bin/bash

# Browser Crush Development Server
# Starts a local development server with proper CORS handling

echo "🚀 Starting Browser Crush Development Server..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if we have Vite available
if command -v npx vite &> /dev/null; then
    echo "🔧 Using Vite development server..."
    npx vite --host 0.0.0.0 --port 3000
elif command -v python3 &> /dev/null; then
    echo "🐍 Using Python development server..."
    python3 -m http.server 3000
elif command -v python &> /dev/null; then
    echo "🐍 Using Python development server..."
    python -m http.server 3000
else
    echo "❌ No suitable development server found."
    echo "Please install Node.js or Python to run the development server."
    exit 1
fi