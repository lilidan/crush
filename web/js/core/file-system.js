/**
 * Virtual File System for Browser Crush
 * Manages files, indexing, and search capabilities
 */

class FileIndex {
    constructor() {
        this.tokenIndex = new Map(); // token -> Set<filePath>
        this.lineIndex = new Map(); // filePath -> LineInfo[]
        this.symbolIndex = new Map(); // symbol -> SymbolInfo[]
        this.fileHashes = new Map(); // filePath -> hash
    }

    /**
     * Build index for all files
     */
    async buildIndex(files) {
        this.clear();
        
        const promises = [];
        for (const [path, file] of files) {
            if (file.type === 'file') {
                promises.push(this.indexFile(path, file.content));
            }
        }
        
        await Promise.all(promises);
        Utils.log(`Indexed ${files.size} files`);
    }

    /**
     * Index a single file
     */
    async indexFile(filePath, content) {
        const lines = content.split('\n');
        const lineInfos = [];
        
        // Index lines and tokens
        lines.forEach((line, index) => {
            const tokens = this.tokenize(line);
            const lineInfo = new LineInfo(
                index + 1,
                line,
                tokens,
                this.getIndentation(line)
            );
            
            lineInfos.push(lineInfo);
            
            // Build token index
            tokens.forEach(token => {
                if (!this.tokenIndex.has(token)) {
                    this.tokenIndex.set(token, new Set());
                }
                this.tokenIndex.get(token).add(filePath);
            });
        });
        
        this.lineIndex.set(filePath, lineInfos);
        
        // Extract and index symbols
        await this.extractSymbols(filePath, content);
        
        // Store file hash for change detection
        this.fileHashes.set(filePath, Utils.simpleHash(content));
    }

    /**
     * Tokenize text for indexing
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2 && !this.isStopWord(token));
    }

    /**
     * Check if word is a stop word
     */
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
            'above', 'below', 'between', 'among', 'through', 'during', 'before', 'after'
        ]);
        return stopWords.has(word);
    }

    /**
     * Get indentation level
     */
    getIndentation(line) {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }

    /**
     * Extract symbols from code
     */
    async extractSymbols(filePath, content) {
        const extension = Utils.getFileExtension(filePath);
        let symbols = [];
        
        switch (extension) {
            case 'js':
            case 'jsx':
            case 'ts':
            case 'tsx':
                symbols = this.extractJavaScriptSymbols(content, filePath);
                break;
            case 'py':
                symbols = this.extractPythonSymbols(content, filePath);
                break;
            case 'java':
                symbols = this.extractJavaSymbols(content, filePath);
                break;
            case 'cpp':
            case 'c':
                symbols = this.extractCSymbols(content, filePath);
                break;
            case 'go':
                symbols = this.extractGoSymbols(content, filePath);
                break;
            default:
                symbols = this.extractGenericSymbols(content, filePath);
        }
        
        // Index symbols
        symbols.forEach(symbol => {
            if (!this.symbolIndex.has(symbol.name)) {
                this.symbolIndex.set(symbol.name, []);
            }
            this.symbolIndex.get(symbol.name).push(symbol);
        });
    }

    /**
     * Extract JavaScript/TypeScript symbols
     */
    extractJavaScriptSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Functions
            let match = line.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*(?:=\s*(?:async\s+)?(?:function|\()|(?:\([^)]*\)\s*=>))/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'function', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Arrow functions
            match = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'function', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Classes
            match = line.match(/class\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'class', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Interfaces (TypeScript)
            match = line.match(/interface\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'interface', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Methods
            match = line.match(/(\w+)\s*\([^)]*\)\s*{/);
            if (match && !line.includes('function') && !line.includes('if') && !line.includes('for')) {
                symbols.push(new SymbolInfo(match[1], 'method', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Variables/Constants
            match = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
            if (match && !symbols.some(s => s.name === match[1] && s.lineNumber === lineNum)) {
                symbols.push(new SymbolInfo(match[1], 'variable', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
        });
        
        return symbols;
    }

    /**
     * Extract Python symbols
     */
    extractPythonSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Functions
            let match = line.match(/def\s+(\w+)\s*\(/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'function', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Classes
            match = line.match(/class\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'class', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Variables (simple assignment)
            match = line.match(/^(\w+)\s*=/);
            if (match && !line.includes('def') && !line.includes('class')) {
                symbols.push(new SymbolInfo(match[1], 'variable', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
        });
        
        return symbols;
    }

    /**
     * Extract Java symbols
     */
    extractJavaSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Classes
            let match = line.match(/(?:public|private|protected)?\s*class\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'class', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Interfaces
            match = line.match(/(?:public|private|protected)?\s*interface\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'interface', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Methods
            match = line.match(/(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*{?/);
            if (match && !line.includes('class') && !line.includes('interface')) {
                symbols.push(new SymbolInfo(match[1], 'method', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
        });
        
        return symbols;
    }

    /**
     * Extract C/C++ symbols
     */
    extractCSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Functions
            let match = line.match(/(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*{/);
            if (match && !line.includes('if') && !line.includes('for') && !line.includes('while')) {
                symbols.push(new SymbolInfo(match[1], 'function', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Structs
            match = line.match(/struct\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'class', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Classes (C++)
            match = line.match(/class\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'class', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
        });
        
        return symbols;
    }

    /**
     * Extract Go symbols
     */
    extractGoSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Functions
            let match = line.match(/func\s+(\w+)\s*\(/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'function', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Types
            match = line.match(/type\s+(\w+)\s+(?:struct|interface)/);
            if (match) {
                const type = line.includes('interface') ? 'interface' : 'class';
                symbols.push(new SymbolInfo(match[1], type, filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
            
            // Variables
            match = line.match(/var\s+(\w+)/);
            if (match) {
                symbols.push(new SymbolInfo(match[1], 'variable', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
        });
        
        return symbols;
    }

    /**
     * Extract generic symbols (for unknown file types)
     */
    extractGenericSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Look for function-like patterns
            let match = line.match(/(\w+)\s*\([^)]*\)/);
            if (match && line.includes('{')) {
                symbols.push(new SymbolInfo(match[1], 'function', filePath, lineNum, line.indexOf(match[1]), line.trim()));
            }
        });
        
        return symbols;
    }

    /**
     * Search for symbols
     */
    searchSymbols(query, limit = 50) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        for (const [name, symbolList] of this.symbolIndex) {
            if (name.toLowerCase().includes(queryLower)) {
                results.push(...symbolList);
            }
        }
        
        return results.slice(0, limit);
    }

    /**
     * Get symbols for a specific file
     */
    getSymbols(filePath) {
        const symbols = [];
        for (const symbolList of this.symbolIndex.values()) {
            symbols.push(...symbolList.filter(s => s.filePath === filePath));
        }
        return symbols.sort((a, b) => a.lineNumber - b.lineNumber);
    }

    /**
     * Search content
     */
    searchContent(query, options = {}) {
        const results = [];
        const queryTokens = this.tokenize(query);
        const caseSensitive = options.caseSensitive || false;
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        // Find files containing the tokens
        const candidateFiles = new Set();
        queryTokens.forEach(token => {
            const files = this.tokenIndex.get(token);
            if (files) {
                files.forEach(file => candidateFiles.add(file));
            }
        });
        
        // Search in candidate files
        for (const filePath of candidateFiles) {
            const lines = this.lineIndex.get(filePath) || [];
            const matchedLines = [];
            
            lines.forEach(lineInfo => {
                const searchText = caseSensitive ? lineInfo.content : lineInfo.content.toLowerCase();
                const matchIndex = searchText.indexOf(searchQuery);
                
                if (matchIndex !== -1) {
                    matchedLines.push(new MatchedLine(
                        lineInfo.lineNumber,
                        lineInfo.content,
                        matchIndex,
                        matchIndex + query.length
                    ));
                }
            });
            
            if (matchedLines.length > 0) {
                results.push(new FileSearchResult(
                    filePath,
                    null, // Content will be loaded if needed
                    this.calculateRelevanceScore(query, matchedLines),
                    matchedLines
                ));
            }
        }
        
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, options.maxResults || 50);
    }

    /**
     * Calculate relevance score for search results
     */
    calculateRelevanceScore(query, matchedLines) {
        let score = 0;
        const queryLower = query.toLowerCase();
        
        matchedLines.forEach(line => {
            const content = line.content.toLowerCase();
            const matches = (content.match(new RegExp(queryLower, 'g')) || []).length;
            
            // More matches = higher score
            score += matches;
            
            // Shorter lines with matches = higher score
            score += Math.max(0, 100 - line.content.length) / 100;
            
            // Exact word matches = higher score
            if (content.includes(` ${queryLower} `)) {
                score += 2;
            }
        });
        
        return score / matchedLines.length;
    }

    /**
     * Clear index
     */
    clear() {
        this.tokenIndex.clear();
        this.lineIndex.clear();
        this.symbolIndex.clear();
        this.fileHashes.clear();
    }

    /**
     * Check if file needs reindexing
     */
    needsReindexing(filePath, content) {
        const currentHash = Utils.simpleHash(content);
        const storedHash = this.fileHashes.get(filePath);
        return currentHash !== storedHash;
    }
}

class VirtualFileSystem {
    constructor() {
        this.files = new Map(); // path -> FileEntry
        this.index = new FileIndex();
        this.gitIgnorePatterns = [];
        this.crushIgnorePatterns = [];
        this.currentRepo = null;
        this.listeners = new Set();
    }

    /**
     * Add event listener
     */
    addListener(callback) {
        this.listeners.add(callback);
    }

    /**
     * Remove event listener
     */
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of an event
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('FileSystem listener error:', error);
            }
        });
    }

    /**
     * Load repository from GitHub or other sources
     */
    async loadRepository(repoUrl, branch = 'main') {
        Utils.log(`Loading repository: ${repoUrl} (${branch})`);
        
        try {
            const repoData = await this.fetchRepositoryData(repoUrl, branch);
            
            // Clear existing files
            this.clear();
            
            // Add files to filesystem
            for (const fileData of repoData.files) {
                await this.addFile(fileData.path, fileData.content, fileData.type);
            }
            
            // Build search index
            await this.index.buildIndex(this.files);
            
            // Store repository info
            const repoInfo = Utils.parseGitHubUrl(repoUrl);
            if (repoInfo) {
                this.currentRepo = { ...repoInfo, branch, url: repoUrl };
                Storage.addRepository(this.currentRepo);
            }
            
            Utils.log(`Loaded ${this.files.size} files from repository`);
            return true;
            
        } catch (error) {
            Utils.error('Failed to load repository', error);
            throw error;
        }
    }

    /**
     * Fetch repository data from GitHub API
     */
    async fetchRepositoryData(repoUrl, branch) {
        const repoInfo = Utils.parseGitHubUrl(repoUrl);
        if (!repoInfo) {
            throw new Error('Invalid GitHub URL');
        }
        
        const { owner, repo } = repoInfo;
        
        // First, get the tree structure
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        
        const treeResponse = await fetch(treeUrl);
        if (!treeResponse.ok) {
            throw new Error(`Failed to fetch repository tree: ${treeResponse.statusText}`);
        }
        
        const treeData = await treeResponse.json();
        const files = [];
        
        // Filter and limit files
        const fileNodes = treeData.tree
            .filter(item => item.type === 'blob')
            .filter(item => !this.shouldIgnoreFile(item.path))
            .slice(0, 200); // Limit to prevent overwhelming the browser
        
        // Load file contents in chunks to avoid rate limiting
        const chunks = Utils.chunkArray(fileNodes, 10);
        
        for (const chunk of chunks) {
            const promises = chunk.map(async (item) => {
                try {
                    const contentResponse = await fetch(item.url);
                    if (!contentResponse.ok) {
                        Utils.warn(`Failed to load file ${item.path}: ${contentResponse.statusText}`);
                        return null;
                    }
                    
                    const contentData = await contentResponse.json();
                    
                    // Decode base64 content
                    let content;
                    try {
                        content = atob(contentData.content.replace(/\n/g, ''));
                        
                        // Check if content is binary
                        if (this.isBinaryContent(content)) {
                            Utils.log(`Skipping binary file: ${item.path}`);
                            return null;
                        }
                        
                    } catch (decodeError) {
                        Utils.warn(`Failed to decode file ${item.path}:`, decodeError);
                        return null;
                    }
                    
                    return new FileData(item.path, content, 'file', item.sha);
                    
                } catch (error) {
                    Utils.warn(`Error loading file ${item.path}:`, error);
                    return null;
                }
            });
            
            const chunkResults = await Promise.all(promises);
            files.push(...chunkResults.filter(Boolean));
            
            // Add delay between chunks to be nice to GitHub API
            if (chunks.indexOf(chunk) < chunks.length - 1) {
                await Utils.delay(100);
            }
        }
        
        return new RepositoryData(files);
    }

    /**
     * Check if content is binary
     */
    isBinaryContent(content) {
        // Simple heuristic: if content contains null bytes or too many non-printable chars
        const nullBytes = (content.match(/\0/g) || []).length;
        if (nullBytes > 0) return true;
        
        const nonPrintable = content.replace(/[\x20-\x7E\n\r\t]/g, '').length;
        const ratio = nonPrintable / content.length;
        
        return ratio > 0.3; // If more than 30% non-printable, consider binary
    }

    /**
     * Check if file should be ignored
     */
    shouldIgnoreFile(filePath) {
        // Common patterns to ignore
        const ignorePatterns = [
            /node_modules/,
            /\.git/,
            /\.vscode/,
            /\.idea/,
            /dist/,
            /build/,
            /target/,
            /bin/,
            /obj/,
            /coverage/,
            /\.nyc_output/,
            /\.cache/,
            /\.tmp/,
            /\.temp/,
            /\.log$/,
            /\.pid$/,
            /\.seed$/,
            /\.pid\.lock$/,
            /\.(jpg|jpeg|png|gif|ico|svg|pdf|zip|tar|gz|rar|7z|exe|dll|so|dylib)$/i
        ];
        
        return ignorePatterns.some(pattern => pattern.test(filePath));
    }

    /**
     * Add file to filesystem
     */
    async addFile(path, content, type, size = null, lastModified = null) {
        const normalizedPath = Utils.normalizePath(path);
        const fileSize = size || (content ? content.length : 0);
        const modTime = lastModified || new Date();
        
        const fileEntry = new FileEntry(
            normalizedPath,
            content,
            type,
            fileSize,
            modTime
        );
        
        this.files.set(normalizedPath, fileEntry);
        
        // Update index if it's a file
        if (type === 'file' && content) {
            await this.index.indexFile(normalizedPath, content);
        }
        
        // Notify listeners
        this.notifyListeners('file_added', { 
            path: normalizedPath, 
            type: type, 
            size: fileSize,
            file: fileEntry
        });
        
        return fileEntry;
    }

    /**
     * Get file
     */
    async getFile(filePath) {
        const normalizedPath = Utils.normalizePath(filePath);
        const file = this.files.get(normalizedPath);
        
        if (file) {
            // Check cache first for large files
            const cachedContent = Storage.getFileContent(normalizedPath);
            if (cachedContent && file.content !== cachedContent) {
                file.content = cachedContent;
            }
        }
        
        return file;
    }

    /**
     * Update file content
     */
    async updateFile(filePath, newContent) {
        const normalizedPath = Utils.normalizePath(filePath);
        const existingFile = this.files.get(normalizedPath);
        
        if (existingFile) {
            const oldContent = existingFile.content;
            existingFile.content = newContent;
            existingFile.size = newContent.length;
            existingFile.lastModified = new Date();
            
            // Update index
            await this.index.indexFile(normalizedPath, newContent);
            
            // Cache content
            Storage.storeFileContent(normalizedPath, newContent);
            
            // Notify listeners
            this.notifyListeners('file_updated', { 
                path: normalizedPath, 
                oldContent: oldContent,
                newContent: newContent,
                size: newContent.length,
                file: existingFile
            });
            
            return existingFile;
        } else {
            // Create new file
            return await this.addFile(normalizedPath, newContent, 'file');
        }
    }

    /**
     * Delete file
     */
    deleteFile(filePath) {
        const normalizedPath = Utils.normalizePath(filePath);
        const existingFile = this.files.get(normalizedPath);
        
        if (existingFile) {
            const success = this.files.delete(normalizedPath);
            
            if (success) {
                // Notify listeners
                this.notifyListeners('file_deleted', { 
                    path: normalizedPath, 
                    file: existingFile
                });
            }
            
            return success;
        }
        
        return false;
    }

    /**
     * List files in directory
     */
    listFiles(directoryPath = '') {
        const normalizedDir = Utils.normalizePath(directoryPath);
        const files = [];
        
        for (const [path, file] of this.files) {
            if (normalizedDir === '' || path.startsWith(normalizedDir + '/')) {
                files.push(file);
            }
        }
        
        return files.sort((a, b) => {
            // Directories first, then files
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.path.localeCompare(b.path);
        });
    }

    /**
     * Search files
     */
    async searchFiles(query, options = new SearchOptions()) {
        const results = [];
        
        // Search by filename if enabled
        if (options.includeFilenames) {
            const queryLower = query.toLowerCase();
            for (const [path, file] of this.files) {
                const fileName = Utils.getFileName(path).toLowerCase();
                if (fileName.includes(queryLower)) {
                    results.push(new FileSearchResult(
                        path,
                        file.content,
                        Utils.calculateSimilarity(fileName, queryLower) * 2, // Boost filename matches
                        [],
                        'filename_match'
                    ));
                }
            }
        }
        
        // Search by content if enabled
        if (options.includeContent) {
            const contentResults = this.index.searchContent(query, options);
            
            // Add content to results
            for (const result of contentResults) {
                const file = await this.getFile(result.filePath);
                if (file) {
                    result.content = file.content;
                }
                results.push(result);
            }
        }
        
        // Remove duplicates and sort by score
        const uniqueResults = new Map();
        results.forEach(result => {
            const existing = uniqueResults.get(result.filePath);
            if (!existing || result.score > existing.score) {
                uniqueResults.set(result.filePath, result);
            }
        });
        
        return Array.from(uniqueResults.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, options.maxResults || 50);
    }

    /**
     * Get project structure
     */
    getProjectStructure() {
        const structure = {};
        
        for (const [path, file] of this.files) {
            const parts = path.split('/');
            let current = structure;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = i === parts.length - 1 ? file : {};
                }
                current = current[part];
            }
        }
        
        return structure;
    }

    /**
     * Get file tree for UI
     */
    getFileTree() {
        const tree = [];
        const processedPaths = new Set();
        
        for (const [path, file] of this.files) {
            const parts = path.split('/');
            let currentPath = '';
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = i === parts.length - 1;
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                
                if (!processedPaths.has(currentPath)) {
                    processedPaths.add(currentPath);
                    
                    const treeNode = {
                        name: part,
                        path: currentPath,
                        type: isLast && file.type === 'file' ? 'file' : 'directory',
                        depth: i,
                        size: isLast ? file.size : 0,
                        lastModified: isLast ? file.lastModified : null,
                        extension: isLast ? Utils.getFileExtension(part) : null
                    };
                    
                    tree.push(treeNode);
                }
            }
        }
        
        return tree.sort((a, b) => {
            // Sort by depth first, then by type (directories first), then by name
            if (a.depth !== b.depth) return a.depth - b.depth;
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * Clear all files
     */
    clear() {
        this.files.clear();
        this.index.clear();
        this.currentRepo = null;
    }

    /**
     * Get repository info
     */
    getRepositoryInfo() {
        return this.currentRepo;
    }

    /**
     * Get file count
     */
    getFileCount() {
        return this.files.size;
    }

    /**
     * Get total size
     */
    getTotalSize() {
        let totalSize = 0;
        for (const file of this.files.values()) {
            totalSize += file.size;
        }
        return totalSize;
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.FileIndex = FileIndex;
    window.VirtualFileSystem = VirtualFileSystem;
}