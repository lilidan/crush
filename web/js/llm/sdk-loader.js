/**
 * SDK Loader for Browser Crush
 * Handles loading of OpenAI and Anthropic SDKs in browser environment
 */

class SDKLoader {
    constructor() {
        this.sdkCache = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Load OpenAI SDK
     */
    async loadOpenAI() {
        if (this.sdkCache.has('openai')) {
            return this.sdkCache.get('openai');
        }

        if (this.loadingPromises.has('openai')) {
            return this.loadingPromises.get('openai');
        }

        const loadPromise = this._loadOpenAISDK();
        this.loadingPromises.set('openai', loadPromise);
        
        try {
            const sdk = await loadPromise;
            this.sdkCache.set('openai', sdk);
            this.loadingPromises.delete('openai');
            return sdk;
        } catch (error) {
            this.loadingPromises.delete('openai');
            throw error;
        }
    }

    /**
     * Load Anthropic SDK
     */
    async loadAnthropic() {
        if (this.sdkCache.has('anthropic')) {
            return this.sdkCache.get('anthropic');
        }

        if (this.loadingPromises.has('anthropic')) {
            return this.loadingPromises.get('anthropic');
        }

        const loadPromise = this._loadAnthropicSDK();
        this.loadingPromises.set('anthropic', loadPromise);
        
        try {
            const sdk = await loadPromise;
            this.sdkCache.set('anthropic', sdk);
            this.loadingPromises.delete('anthropic');
            return sdk;
        } catch (error) {
            this.loadingPromises.delete('anthropic');
            throw error;
        }
    }

    /**
     * Internal method to load OpenAI SDK
     */
    async _loadOpenAISDK() {
        try {
            // Try to load from CDN first
            if (!window.OpenAI) {
                await this._loadScript('https://cdn.jsdelivr.net/npm/openai@4/dist/index.browser.js');
            }
            
            if (window.OpenAI) {
                return window.OpenAI;
            }

            // If CDN fails, try dynamic import (requires bundler)
            if (typeof importScripts === 'undefined' && typeof import !== 'undefined') {
                const module = await import('openai');
                return module.default || module.OpenAI;
            }

            throw new Error('OpenAI SDK not available');
        } catch (error) {
            console.warn('Failed to load OpenAI SDK:', error);
            throw new Error('OpenAI SDK could not be loaded. Please check your network connection.');
        }
    }

    /**
     * Internal method to load Anthropic SDK
     */
    async _loadAnthropicSDK() {
        try {
            // Try to load from CDN first
            if (!window.Anthropic) {
                await this._loadScript('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0/dist/index.browser.js');
            }
            
            if (window.Anthropic) {
                return window.Anthropic;
            }

            // If CDN fails, try dynamic import (requires bundler)
            if (typeof importScripts === 'undefined' && typeof import !== 'undefined') {
                const module = await import('@anthropic-ai/sdk');
                return module.default || module.Anthropic;
            }

            throw new Error('Anthropic SDK not available');
        } catch (error) {
            console.warn('Failed to load Anthropic SDK:', error);
            throw new Error('Anthropic SDK could not be loaded. Please check your network connection.');
        }
    }

    /**
     * Load script dynamically
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.crossOrigin = 'anonymous';
            
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize SDK-based LLM client
     */
    async createLLMClient(provider, apiKey, options = {}) {
        let SDK;
        
        switch (provider) {
            case 'openai':
                SDK = await this.loadOpenAI();
                break;
            case 'anthropic':
                SDK = await this.loadAnthropic();
                break;
            case 'ollama':
                // Ollama doesn't need SDK, use existing fetch implementation
                SDK = null;
                break;
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }

        // Make SDK available globally for the client
        if (provider === 'openai' && SDK) {
            window.OpenAI = SDK;
        } else if (provider === 'anthropic' && SDK) {
            window.Anthropic = SDK;
        }

        // Import and create the SDK client
        if (window.LLMClientSDK) {
            return new window.LLMClientSDK({
                provider,
                apiKey,
                ...options
            });
        } else {
            throw new Error('LLMClientSDK not available. Please ensure llm-client-sdk.js is loaded.');
        }
    }

    /**
     * Check if SDKs are available
     */
    getAvailableSDKs() {
        return {
            openai: this.sdkCache.has('openai') || window.OpenAI !== undefined,
            anthropic: this.sdkCache.has('anthropic') || window.Anthropic !== undefined,
            ollama: true // Always available as it uses fetch
        };
    }

    /**
     * Preload commonly used SDKs
     */
    async preloadSDKs(providers = ['openai', 'anthropic']) {
        const loadPromises = [];
        
        if (providers.includes('openai')) {
            loadPromises.push(
                this.loadOpenAI().catch(error => {
                    console.warn('Failed to preload OpenAI SDK:', error);
                    return null;
                })
            );
        }
        
        if (providers.includes('anthropic')) {
            loadPromises.push(
                this.loadAnthropic().catch(error => {
                    console.warn('Failed to preload Anthropic SDK:', error);
                    return null;
                })
            );
        }

        await Promise.all(loadPromises);
        return this.getAvailableSDKs();
    }
}

// Create global instance
const sdkLoader = new SDKLoader();

// Export to global scope
if (typeof window !== 'undefined') {
    window.SDKLoader = SDKLoader;
    window.sdkLoader = sdkLoader;
}

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SDKLoader, sdkLoader };
}