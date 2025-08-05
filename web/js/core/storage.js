/**
 * Storage management for Browser Crush
 * Handles local storage, session storage, and encryption
 */

class StorageManager {
    constructor() {
        this.storageKey = 'browser_crush';
        this.encryptionKey = 'crush_encrypt_key_2024';
    }

    /**
     * Simple encryption for sensitive data
     */
    encrypt(text) {
        try {
            // Simple XOR encryption - not secure for production, but fine for demo
            let encrypted = '';
            for (let i = 0; i < text.length; i++) {
                encrypted += String.fromCharCode(
                    text.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
                );
            }
            return btoa(encrypted);
        } catch (error) {
            Utils.error('Encryption failed', error);
            return text;
        }
    }

    /**
     * Simple decryption for sensitive data
     */
    decrypt(encryptedText) {
        try {
            const decoded = atob(encryptedText);
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                decrypted += String.fromCharCode(
                    decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
                );
            }
            return decrypted;
        } catch (error) {
            Utils.error('Decryption failed', error);
            return encryptedText;
        }
    }

    /**
     * Get stored configuration
     */
    getConfig() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : this.getDefaultConfig();
        } catch (error) {
            Utils.error('Failed to load config', error);
            return this.getDefaultConfig();
        }
    }

    /**
     * Save configuration
     */
    saveConfig(config) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(config));
            return true;
        } catch (error) {
            Utils.error('Failed to save config', error);
            return false;
        }
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            llm: {
                provider: 'openai',
                model: 'gpt-4-turbo-preview',
                temperature: 0.1,
                maxTokens: 4000
            },
            apiKeys: {},
            editor: {
                theme: 'vs-dark',
                fontSize: 14,
                wordWrap: 'on',
                minimap: true,
                autoSave: true
            },
            ui: {
                sidebarWidth: 300,
                chatPanelHeight: 300,
                showLineNumbers: true,
                showWhitespace: false
            },
            repositories: [],
            recentFiles: [],
            sessions: []
        };
    }

    /**
     * Store API key securely
     */
    setApiKey(provider, key, save = false) {
        const config = this.getConfig();
        
        if (save) {
            config.apiKeys[provider] = this.encrypt(key);
            this.saveConfig(config);
        } else {
            // Store in session storage only
            sessionStorage.setItem(`${this.storageKey}_${provider}_key`, this.encrypt(key));
        }
    }

    /**
     * Get API key
     */
    getApiKey(provider) {
        // First check session storage
        const sessionKey = sessionStorage.getItem(`${this.storageKey}_${provider}_key`);
        if (sessionKey) {
            const decryptedKey = this.decrypt(sessionKey);
            console.log('decryptedKey', decryptedKey);
            return decryptedKey;
        }
        

        // Then check persistent storage
        const config = this.getConfig();
        if (config.apiKeys[provider]) {
            return this.decrypt(config.apiKeys[provider]);
        }

        return null;
    }

    /**
     * Remove API key
     */
    removeApiKey(provider) {
        sessionStorage.removeItem(`${this.storageKey}_${provider}_key`);
        
        const config = this.getConfig();
        delete config.apiKeys[provider];
        this.saveConfig(config);
    }

    /**
     * Store repository information
     */
    addRepository(repoInfo) {
        const config = this.getConfig();
        const existing = config.repositories.find(r => 
            r.owner === repoInfo.owner && r.repo === repoInfo.repo
        );

        if (existing) {
            existing.lastAccessed = new Date().toISOString();
            existing.branch = repoInfo.branch;
        } else {
            config.repositories.unshift({
                ...repoInfo,
                id: Utils.generateId('repo'),
                addedAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString()
            });
        }

        // Keep only last 10 repositories
        config.repositories = config.repositories.slice(0, 10);
        this.saveConfig(config);
    }

    /**
     * Get repository list
     */
    getRepositories() {
        const config = this.getConfig();
        return config.repositories.sort((a, b) => 
            new Date(b.lastAccessed) - new Date(a.lastAccessed)
        );
    }

    /**
     * Add recent file
     */
    addRecentFile(filePath, repoId = null) {
        const config = this.getConfig();
        const existing = config.recentFiles.find(f => f.path === filePath && f.repoId === repoId);

        if (existing) {
            existing.lastAccessed = new Date().toISOString();
        } else {
            config.recentFiles.unshift({
                path: filePath,
                repoId: repoId,
                addedAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString()
            });
        }

        // Keep only last 20 files
        config.recentFiles = config.recentFiles.slice(0, 20);
        this.saveConfig(config);
    }

    /**
     * Get recent files
     */
    getRecentFiles(repoId = null) {
        const config = this.getConfig();
        let files = config.recentFiles;
        
        if (repoId) {
            files = files.filter(f => f.repoId === repoId);
        }

        return files.sort((a, b) => 
            new Date(b.lastAccessed) - new Date(a.lastAccessed)
        );
    }

    /**
     * Store session data temporarily
     */
    storeSession(sessionId, data) {
        try {
            sessionStorage.setItem(`${this.storageKey}_session_${sessionId}`, JSON.stringify(data));
            return true;
        } catch (error) {
            Utils.error('Failed to store session data', error);
            return false;
        }
    }

    /**
     * Get session data
     */
    getSession(sessionId) {
        try {
            const stored = sessionStorage.getItem(`${this.storageKey}_session_${sessionId}`);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            Utils.error('Failed to load session data', error);
            return null;
        }
    }

    /**
     * Clear session data
     */
    clearSession(sessionId) {
        sessionStorage.removeItem(`${this.storageKey}_session_${sessionId}`);
    }

    /**
     * Store file content temporarily (for large files)
     */
    storeFileContent(filePath, content, ttl = 3600000) { // 1 hour default TTL
        try {
            const key = `${this.storageKey}_file_${Utils.simpleHash(filePath)}`;
            const data = {
                content: content,
                timestamp: Date.now(),
                ttl: ttl
            };
            
            // Use session storage for file content
            sessionStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            Utils.error('Failed to store file content', error);
            return false;
        }
    }

    /**
     * Get file content from cache
     */
    getFileContent(filePath) {
        try {
            const key = `${this.storageKey}_file_${Utils.simpleHash(filePath)}`;
            const stored = sessionStorage.getItem(key);
            
            if (!stored) return null;
            
            const data = JSON.parse(stored);
            const now = Date.now();
            
            // Check if expired
            if (now - data.timestamp > data.ttl) {
                sessionStorage.removeItem(key);
                return null;
            }
            
            return data.content;
        } catch (error) {
            Utils.error('Failed to get file content from cache', error);
            return null;
        }
    }

    /**
     * Clear expired cache entries
     */
    clearExpiredCache() {
        try {
            const keysToRemove = [];
            const now = Date.now();
            
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith(`${this.storageKey}_file_`)) {
                    try {
                        const data = JSON.parse(sessionStorage.getItem(key));
                        if (now - data.timestamp > data.ttl) {
                            keysToRemove.push(key);
                        }
                    } catch (error) {
                        keysToRemove.push(key);
                    }
                }
            }
            
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
            Utils.log(`Cleared ${keysToRemove.length} expired cache entries`);
        } catch (error) {
            Utils.error('Failed to clear expired cache', error);
        }
    }

    /**
     * Update editor settings
     */
    updateEditorSettings(settings) {
        const config = this.getConfig();
        config.editor = { ...config.editor, ...settings };
        this.saveConfig(config);
    }

    /**
     * Update UI settings
     */
    updateUISettings(settings) {
        const config = this.getConfig();
        config.ui = { ...config.ui, ...settings };
        this.saveConfig(config);
    }

    /**
     * Update LLM settings
     */
    updateLLMSettings(settings) {
        const config = this.getConfig();
        config.llm = { ...config.llm, ...settings };
        this.saveConfig(config);
    }

    /**
     * Export all data (for backup)
     */
    exportData() {
        const config = this.getConfig();
        const exportData = {
            ...config,
            exportedAt: new Date().toISOString(),
            version: config.version
        };
        
        // Remove sensitive data
        delete exportData.apiKeys;
        
        return exportData;
    }

    /**
     * Import data (from backup)
     */
    importData(data) {
        try {
            if (!data.version) {
                throw new Error('Invalid backup data');
            }
            
            const config = this.getConfig();
            const mergedConfig = {
                ...config,
                ...data,
                version: config.version, // Keep current version
                lastUpdated: new Date().toISOString(),
                apiKeys: config.apiKeys // Preserve API keys
            };
            
            this.saveConfig(mergedConfig);
            return true;
        } catch (error) {
            Utils.error('Failed to import data', error);
            return false;
        }
    }

    /**
     * Clear all data
     */
    clearAllData() {
        try {
            localStorage.removeItem(this.storageKey);
            
            // Clear session storage entries
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith(this.storageKey)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
            
            return true;
        } catch (error) {
            Utils.error('Failed to clear all data', error);
            return false;
        }
    }

    /**
     * Get storage usage information
     */
    getStorageInfo() {
        const estimate = navigator.storage && navigator.storage.estimate ? 
            navigator.storage.estimate() : Promise.resolve({});
        
        return estimate.then(est => ({
            quota: est.quota || 0,
            usage: est.usage || 0,
            available: (est.quota || 0) - (est.usage || 0),
            percentage: est.quota ? ((est.usage || 0) / est.quota * 100).toFixed(2) : 0
        }));
    }

    /**
     * Get recent projects (alias for getRepositories)
     */
    getRecentProjects() {
        return this.getRepositories();
    }

    /**
     * Add recent project (alias for addRepository)
     */
    addRecentProject(projectInfo) {
        return this.addRepository(projectInfo);
    }

    /**
     * Save session data
     */
    saveSessionData(key, data) {
        return this.storeSession(key, data);
    }

    /**
     * Get session data
     */
    getSessionData(key) {
        return this.getSession(key);
    }

    /**
     * Update configuration (alias for saveConfig)
     */
    updateConfig(config) {
        const currentConfig = this.getConfig();
        const mergedConfig = { ...currentConfig, ...config };
        return this.saveConfig(mergedConfig);
    }
}

// Create global instance
const CrushStorage = new StorageManager();

// Export to global scope
if (typeof window !== 'undefined') {
    window.CrushStorage = CrushStorage;
    window.StorageManager = StorageManager;
}