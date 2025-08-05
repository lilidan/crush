/**
 * Browser Crush Application Bootstrap
 * Main entry point for the application
 */

class CrushApp {
    constructor() {
        this.agent = null;
        this.isInitialized = false;
        this.loadingElement = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing Browser Crush...');
            
            // Show loading
            this.showLoading('Initializing Browser Crush...');
            
            // Wait for DOM to be ready
            if (document.readyState !== 'complete') {
                await new Promise(resolve => {
                    window.addEventListener('load', resolve);
                });
            }
            
            // Initialize Monaco Editor if available
            if (window.monaco) {
                this.updateLoading('Loading Monaco Editor...');
                await this.initializeMonaco();
            }
            
            // SDKs are now bundled with npm packages
            
            // Initialize the coding agent
            this.updateLoading('Starting AI Assistant...');
            this.agent = new CodingAgent();
            
            // Wait for agent to be ready
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Agent initialization timeout'));
                }, 30000);
                
                this.agent.addListener((event) => {
                    if (event === 'initialized') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });
            
            // Try to load saved state
            this.updateLoading('Restoring session...');
            await this.agent.loadState();
            
            // Setup global error handling
            this.setupErrorHandling();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Hide loading
            this.hideLoading();
            
            this.isInitialized = true;
            console.log('Browser Crush initialized successfully!');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Failed to initialize Browser Crush:', error);
            this.showError('Failed to initialize Browser Crush', error.message);
        }
    }

    /**
     * Initialize Monaco Editor
     */
    async initializeMonaco() {
        if (!window.monaco) return;

        // Set up Monaco paths if needed
        if (window.require) {
            window.require.config({
                paths: {
                    'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
                }
            });
        }

        // Configure Monaco for better performance
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            noSuggestionDiagnostics: false
        });

        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            noSuggestionDiagnostics: false
        });

        // Add custom themes
        monaco.editor.defineTheme('github-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6e7681' },
                { token: 'keyword', foreground: 'ff7b72' },
                { token: 'string', foreground: 'a5d6ff' },
                { token: 'number', foreground: '79c0ff' },
                { token: 'regexp', foreground: '7ee787' },
                { token: 'type', foreground: 'ffa657' },
                { token: 'class', foreground: 'ffa657' },
                { token: 'function', foreground: 'd2a8ff' },
                { token: 'variable', foreground: 'ffa657' }
            ],
            colors: {
                'editor.background': '#0d1117',
                'editor.foreground': '#c9d1d9',
                'editorLineNumber.foreground': '#484f58',
                'editorLineNumber.activeForeground': '#c9d1d9',
                'editor.selectionBackground': '#264f78',
                'editor.inactiveSelectionBackground': '#3a3d41',
                'editorCursor.foreground': '#c9d1d9',
                'editor.lineHighlightBackground': '#21262d'
            }
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showError('Unexpected Error', event.error?.message || 'An unexpected error occurred');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('Promise Error', event.reason?.message || 'An unhandled promise rejection occurred');
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + Z - Undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (this.agent) {
                    this.agent.undo();
                }
            }
            
            // Cmd/Ctrl + Shift + Z - Redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                if (this.agent) {
                    this.agent.redo();
                }
            }
            
            // Cmd/Ctrl + S - Save state
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (this.agent) {
                    this.agent.saveState();
                }
            }
            
            // Cmd/Ctrl + K - Focus chat input
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.focus();
                }
            }
            
            // Escape - Close modals
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal[style*="flex"]');
                modals.forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    /**
     * Show loading screen
     */
    showLoading(message = 'Loading...') {
        // Remove existing loading element
        if (this.loadingElement) {
            this.loadingElement.remove();
        }
        
        // Create loading element
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = 'loading-overlay';
        this.loadingElement.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            .loading-content {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                backdrop-filter: blur(10px);
            }
            
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top: 3px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }
            
            .loading-text {
                font-size: 16px;
                margin-top: 1rem;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(this.loadingElement);
    }

    /**
     * Update loading message
     */
    updateLoading(message) {
        if (this.loadingElement) {
            const textElement = this.loadingElement.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = message;
            }
        }
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.remove();
            this.loadingElement = null;
        }
    }

    /**
     * Show error message
     */
    showError(title, message) {
        // Create error modal
        const errorModal = document.createElement('div');
        errorModal.className = 'error-modal';
        errorModal.innerHTML = `
            <div class="error-content">
                <h3>${title}</h3>
                <p>${message}</p>
                <button onclick="this.closest('.error-modal').remove()">OK</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .error-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            .error-content {
                background: #dc3545;
                padding: 2rem;
                border-radius: 8px;
                max-width: 400px;
                text-align: center;
            }
            
            .error-content h3 {
                margin-top: 0;
                margin-bottom: 1rem;
            }
            
            .error-content p {
                margin-bottom: 1.5rem;
                line-height: 1.5;
            }
            
            .error-content button {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 0.5rem 1.5rem;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .error-content button:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(errorModal);
    }


    /**
     * Show welcome message
     */
    showWelcomeMessage() {
        console.log(`
╔══════════════════════════════════════════════╗
║            Browser Crush v1.0                ║
║         AI-Powered Coding Assistant          ║
╠══════════════════════════════════════════════╣
║                                              ║
║  🚀 Ready to help with your coding tasks     ║
║  📁 Load a repository to get started         ║
║  💬 Ask me anything about your code          ║
║  🔧 Use tools to read, write, and analyze    ║
║                                              ║
║  Keyboard shortcuts:                         ║
║  • Cmd/Ctrl + K: Focus chat                 ║
║  • Cmd/Ctrl + Z: Undo                       ║
║  • Cmd/Ctrl + Shift + Z: Redo               ║
║  • Cmd/Ctrl + S: Save state                 ║
║                                              ║
╚══════════════════════════════════════════════╝
        `);
        
        // Also show in status bar
        if (this.agent && this.agent.ui) {
            this.agent.ui.setStatus('Browser Crush ready! Load a repository or start chatting.', 'ready');
        }
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            agent: this.agent ? this.agent.getStatus() : null,
            version: '1.0.0',
            timestamp: new Date()
        };
    }

    /**
     * Export application data
     */
    exportData() {
        if (!this.agent) return null;
        
        return {
            ...this.agent.exportProject(),
            appVersion: '1.0.0',
            exportType: 'full'
        };
    }

    /**
     * Import application data
     */
    async importData(data) {
        if (!this.agent) throw new Error('Agent not initialized');
        
        return await this.agent.importProject(data);
    }

    /**
     * Destroy the application
     */
    destroy() {
        if (this.agent) {
            this.agent.destroy();
        }
        
        this.hideLoading();
        this.isInitialized = false;
    }
}

// Global application instance
let crushApp = null;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        crushApp = new CrushApp();
        await crushApp.init();
        
        // Make app available globally for debugging
        window.crushApp = crushApp;
        
    } catch (error) {
        console.error('Failed to start Browser Crush:', error);
    }
});

// Export to global scope
if (typeof window !== 'undefined') {
    window.CrushApp = CrushApp;
}