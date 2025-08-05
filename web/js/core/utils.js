/**
 * Utility functions for Browser Crush
 */

class Utils {
    /**
     * Generate a unique ID
     */
    static generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substr(2, 9);
        return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
    }

    /**
     * Debounce function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function calls
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Deep clone an object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = Utils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    /**
     * Format file size in human readable format
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get file extension from path
     */
    static getFileExtension(filePath) {
        return filePath.split('.').pop()?.toLowerCase() || '';
    }

    /**
     * Get file name from path
     */
    static getFileName(filePath) {
        return filePath.split('/').pop() || filePath;
    }

    /**
     * Get directory path from file path
     */
    static getDirectoryPath(filePath) {
        const parts = filePath.split('/');
        parts.pop();
        return parts.join('/');
    }

    /**
     * Check if path is a directory
     */
    static isDirectory(path) {
        return path.endsWith('/') || !path.includes('.');
    }

    /**
     * Normalize file path
     */
    static normalizePath(path) {
        return path.replace(/\\/g, '/').replace(/\/+/g, '/');
    }

    /**
     * Parse GitHub URL
     */
    static parseGitHubUrl(url) {
        const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
        const match = url.match(regex);
        if (match) {
            return {
                owner: match[1],
                repo: match[2].replace(/\.git$/, '')
            };
        }
        return null;
    }

    /**
     * Tokenize text for search indexing
     */
    static tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2);
    }

    /**
     * Calculate string similarity (simple Levenshtein distance)
     */
    static calculateSimilarity(str1, str2) {
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
    }

    /**
     * Escape HTML entities
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format date for display
     */
    static formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    /**
     * Get programming language from file extension
     */
    static getLanguageFromExtension(extension) {
        const languageMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'cs': 'csharp',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'kt': 'kotlin',
            'swift': 'swift',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'less': 'less',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            'ini': 'ini',
            'md': 'markdown',
            'tex': 'latex',
            'sql': 'sql',
            'sh': 'shell',
            'bash': 'shell',
            'zsh': 'shell',
            'ps1': 'powershell',
            'dockerfile': 'dockerfile',
            'r': 'r',
            'matlab': 'matlab',
            'scala': 'scala',
            'clj': 'clojure',
            'hs': 'haskell',
            'elm': 'elm',
            'dart': 'dart',
            'vue': 'vue',
            'svelte': 'svelte'
        };
        
        return languageMap[extension] || 'plaintext';
    }

    /**
     * Get file icon class based on file type
     */
    static getFileIcon(filePath) {
        if (Utils.isDirectory(filePath)) {
            return 'fas fa-folder';
        }

        const extension = Utils.getFileExtension(filePath);
        const iconMap = {
            // Documents
            'md': 'fab fa-markdown',
            'txt': 'fas fa-file-alt',
            'pdf': 'fas fa-file-pdf',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'rtf': 'fas fa-file-alt',

            // Code files
            'js': 'fab fa-js-square',
            'ts': 'fas fa-code',
            'jsx': 'fab fa-react',
            'tsx': 'fab fa-react',
            'html': 'fab fa-html5',
            'css': 'fab fa-css3-alt',
            'scss': 'fab fa-sass',
            'less': 'fab fa-less',
            'py': 'fab fa-python',
            'java': 'fab fa-java',
            'cpp': 'fas fa-code',
            'c': 'fas fa-code',
            'cs': 'fas fa-code',
            'php': 'fab fa-php',
            'rb': 'fas fa-gem',
            'go': 'fas fa-code',
            'rs': 'fas fa-code',
            'swift': 'fab fa-swift',
            'kt': 'fas fa-code',
            'dart': 'fas fa-code',
            'vue': 'fab fa-vuejs',
            'svelte': 'fas fa-code',
            'r': 'fas fa-chart-line',

            // Config files
            'json': 'fas fa-code',
            'xml': 'fas fa-code',
            'yaml': 'fas fa-code',
            'yml': 'fas fa-code',
            'toml': 'fas fa-code',
            'ini': 'fas fa-cog',
            'env': 'fas fa-cog',
            'config': 'fas fa-cog',

            // Images
            'jpg': 'fas fa-image',
            'jpeg': 'fas fa-image',
            'png': 'fas fa-image',
            'gif': 'fas fa-image',
            'svg': 'fas fa-image',
            'webp': 'fas fa-image',
            'ico': 'fas fa-image',

            // Archives
            'zip': 'fas fa-file-archive',
            'rar': 'fas fa-file-archive',
            'tar': 'fas fa-file-archive',
            'gz': 'fas fa-file-archive',
            '7z': 'fas fa-file-archive',

            // Database
            'sql': 'fas fa-database',
            'db': 'fas fa-database',
            'sqlite': 'fas fa-database',

            // Shell scripts
            'sh': 'fas fa-terminal',
            'bash': 'fas fa-terminal',
            'zsh': 'fas fa-terminal',
            'fish': 'fas fa-terminal',
            'ps1': 'fas fa-terminal',
            'bat': 'fas fa-terminal',
            'cmd': 'fas fa-terminal',

            // Special files
            'dockerfile': 'fab fa-docker',
            'lock': 'fas fa-lock',
            'log': 'fas fa-file-alt',
            'gitignore': 'fab fa-git-alt',
            'gitattributes': 'fab fa-git-alt',
            'license': 'fas fa-certificate',
            'readme': 'fas fa-info-circle'
        };

        return iconMap[extension] || 'fas fa-file';
    }

    /**
     * Validate API key format
     */
    static validateApiKey(provider, key) {
        if (!key || typeof key !== 'string') return false;

        switch (provider) {
            case 'openai':
                return key.startsWith('sk-') && key.length > 20;
            case 'anthropic':
                return key.startsWith('sk-ant-') && key.length > 20;
            case 'ollama':
                return true; // Ollama doesn't require API key
            default:
                return key.length > 10;
        }
    }

    /**
     * Create a delayed promise (for testing and demos)
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Chunk array into smaller arrays
     */
    static chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Create a simple hash of a string
     */
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Check if running in development mode
     */
    static isDevelopment() {
        return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    }

    /**
     * Log with timestamp (for debugging)
     */
    static log(message, ...args) {
        if (Utils.isDevelopment()) {
            console.log(`[${new Date().toISOString()}] ${message}`, ...args);
        }
    }

    /**
     * Error logging
     */
    static error(message, error) {
        console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error);
    }

    /**
     * Warning logging
     */
    static warn(message, ...args) {
        console.warn(`[${new Date().toISOString()}] WARN: ${message}`, ...args);
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}