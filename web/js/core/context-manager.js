/**
 * Context Manager for Browser Crush
 * Intelligently gathers code context for LLM prompts
 */

class ContextManager {
    constructor(fileSystem) {
        this.fileSystem = fileSystem;
        this.maxContextTokens = 8000; // Approximate max tokens for context
        this.avgCharsPerToken = 4; // Rough approximation
        this.maxContextChars = this.maxContextTokens * this.avgCharsPerToken;
    }

    /**
     * Gather relevant context for a user prompt
     */
    async gatherContext(userPrompt, options = {}) {
        const intent = this.analyzeIntent(userPrompt);
        
        const context = new CodeContext();
        context.projectStructure = this.getProjectOverview();
        context.relevantFiles = await this.findRelevantFiles(intent, options.maxFiles || 5);
        context.symbols = await this.findRelevantSymbols(intent);
        context.dependencies = await this.analyzeDependencies(context.relevantFiles);
        
        // Trim context to fit within token limits
        context.relevantFiles = this.trimContextToLimit(context.relevantFiles);
        
        return context;
    }

    /**
     * Analyze user intent from the prompt
     */
    analyzeIntent(prompt) {
        const intent = new UserIntent();
        const promptLower = prompt.toLowerCase();

        // Extract file paths
        const filePathRegex = /(?:^|\s)([.\w/-]+\.[a-zA-Z0-9]+)(?:\s|$|[.,!?])/g;
        let match;
        while ((match = filePathRegex.exec(prompt)) !== null) {
            intent.targetFiles.push(match[1]);
        }

        // Determine operation type
        if (/create|add|new|generate|make/i.test(prompt)) {
            intent.operation = 'create';
            intent.type = 'create';
        } else if (/edit|modify|change|update|fix|improve|refactor/i.test(prompt)) {
            intent.operation = 'edit';
            intent.type = 'edit';
        } else if (/delete|remove|drop/i.test(prompt)) {
            intent.operation = 'delete';
            intent.type = 'delete';
        } else if (/find|search|locate|show|display|list/i.test(prompt)) {
            intent.operation = 'read';
            intent.type = 'search';
        } else if (/bug|error|issue|problem|broken|not working/i.test(prompt)) {
            intent.operation = 'fix';
            intent.type = 'debug';
        } else if (/test|testing|spec|unit test/i.test(prompt)) {
            intent.operation = 'test';
            intent.type = 'test';
        } else {
            intent.operation = 'read';
            intent.type = 'general';
        }

        // Extract keywords
        intent.keywords = this.extractKeywords(prompt);

        // Detect programming concepts
        intent.concepts = this.extractConcepts(prompt);

        return intent;
    }

    /**
     * Extract relevant keywords from prompt
     */
    extractKeywords(prompt) {
        // Remove common stop words and extract meaningful terms
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
            'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
            'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'make', 'let', 'put'
        ]);

        const words = prompt.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));

        return [...new Set(words)]; // Remove duplicates
    }

    /**
     * Extract programming concepts from prompt
     */
    extractConcepts(prompt) {
        const concepts = [];
        const conceptPatterns = {
            'authentication': /auth|login|password|session|token|jwt|oauth/i,
            'database': /database|db|sql|query|table|schema|migration/i,
            'api': /api|endpoint|rest|graphql|http|request|response/i,
            'frontend': /frontend|ui|component|react|vue|angular|html|css/i,
            'backend': /backend|server|express|node|django|flask|spring/i,
            'testing': /test|testing|spec|unit|integration|e2e|jest|mocha/i,
            'deployment': /deploy|deployment|docker|kubernetes|aws|heroku/i,
            'performance': /performance|optimize|speed|cache|lazy|async/i,
            'security': /security|secure|vulnerability|xss|csrf|injection/i,
            'error_handling': /error|exception|try|catch|throw|handle/i
        };

        for (const [concept, pattern] of Object.entries(conceptPatterns)) {
            if (pattern.test(prompt)) {
                concepts.push(concept);
            }
        }

        return concepts;
    }

    /**
     * Find files relevant to the user intent
     */
    async findRelevantFiles(intent, maxFiles = 5) {
        const relevantFiles = [];
        const seenPaths = new Set();

        // 1. Add directly mentioned files
        for (const filePath of intent.targetFiles) {
            if (seenPaths.has(filePath)) continue;
            
            const file = await this.fileSystem.getFile(filePath);
            if (file) {
                relevantFiles.push(new RelevantFile(
                    filePath,
                    file.content,
                    1.0,
                    'directly_mentioned'
                ));
                seenPaths.add(filePath);
            }
        }

        // 2. Search by keywords
        if (intent.keywords.length > 0 && relevantFiles.length < maxFiles) {
            const searchOptions = new SearchOptions();
            searchOptions.includeContent = true;
            searchOptions.includeFilenames = true;
            searchOptions.maxResults = maxFiles * 2;

            for (const keyword of intent.keywords.slice(0, 3)) { // Limit to top 3 keywords
                try {
                    const searchResults = await this.fileSystem.searchFiles(keyword, searchOptions);
                    
                    for (const result of searchResults) {
                        if (seenPaths.has(result.filePath) || relevantFiles.length >= maxFiles) break;
                        
                        const file = await this.fileSystem.getFile(result.filePath);
                        if (file) {
                            relevantFiles.push(new RelevantFile(
                                result.filePath,
                                file.content,
                                result.score * 0.8, // Slightly lower score than direct mentions
                                'keyword_match',
                                result.matchedLines
                            ));
                            seenPaths.add(result.filePath);
                        }
                    }
                } catch (error) {
                    Utils.warn(`Search failed for keyword "${keyword}":`, error);
                }
            }
        }

        // 3. Add related files based on imports/dependencies
        if (relevantFiles.length > 0 && relevantFiles.length < maxFiles) {
            const relatedFiles = await this.findRelatedFiles(relevantFiles);
            for (const relatedFile of relatedFiles) {
                if (seenPaths.has(relatedFile.path) || relevantFiles.length >= maxFiles) break;
                
                relevantFiles.push(relatedFile);
                seenPaths.add(relatedFile.path);
            }
        }

        // Sort by relevance score
        return relevantFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Find files related to the current relevant files (imports, etc.)
     */
    async findRelatedFiles(relevantFiles) {
        const relatedFiles = [];
        const imports = new Set();

        // Extract imports from relevant files
        for (const relevantFile of relevantFiles) {
            const fileImports = this.extractImports(relevantFile.content);
            fileImports.forEach(imp => imports.add(imp));
        }

        // Find files that match the imports
        for (const importPath of imports) {
            if (relatedFiles.length >= 3) break; // Limit related files
            
            // Try to resolve the import to an actual file
            const resolvedPath = this.resolveImportPath(importPath, relevantFiles[0]?.path);
            if (resolvedPath) {
                const file = await this.fileSystem.getFile(resolvedPath);
                if (file) {
                    relatedFiles.push(new RelevantFile(
                        resolvedPath,
                        file.content,
                        0.6,
                        'dependency'
                    ));
                }
            }
        }

        return relatedFiles;
    }

    /**
     * Extract import statements from code
     */
    extractImports(content) {
        const imports = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            
            // JavaScript/TypeScript imports
            let match = trimmed.match(/^import\s+.*?from\s+['"]([^'"]+)['"]/);
            if (match) {
                imports.push(match[1]);
                continue;
            }

            // Node.js requires
            match = trimmed.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (match) {
                imports.push(match[1]);
                continue;
            }

            // Python imports
            match = trimmed.match(/^from\s+([^\s]+)\s+import/);
            if (match) {
                imports.push(match[1]);
                continue;
            }

            match = trimmed.match(/^import\s+([^\s]+)/);
            if (match) {
                imports.push(match[1]);
                continue;
            }

            // C/C++ includes
            match = trimmed.match(/^#include\s*["<]([^">]+)[">]/);
            if (match) {
                imports.push(match[1]);
                continue;
            }
        }

        return imports;
    }

    /**
     * Resolve import path to actual file path
     */
    resolveImportPath(importPath, fromFile) {
        // Handle relative imports
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            if (!fromFile) return null;
            
            const fromDir = Utils.getDirectoryPath(fromFile);
            const resolved = this.resolvePath(fromDir, importPath);
            
            // Try common extensions
            const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];
            for (const ext of extensions) {
                const testPath = resolved + ext;
                if (this.fileSystem.files.has(testPath)) {
                    return testPath;
                }
            }
        }

        // Handle absolute imports (might be in node_modules or src/)
        const possiblePaths = [
            importPath,
            `src/${importPath}`,
            `lib/${importPath}`,
            `${importPath}.js`,
            `${importPath}.ts`,
            `src/${importPath}.js`,
            `src/${importPath}.ts`
        ];

        for (const path of possiblePaths) {
            if (this.fileSystem.files.has(path)) {
                return path;
            }
        }

        return null;
    }

    /**
     * Simple path resolution
     */
    resolvePath(base, relative) {
        const parts = base.split('/').concat(relative.split('/'));
        const resolved = [];

        for (const part of parts) {
            if (part === '..') {
                resolved.pop();
            } else if (part !== '.' && part !== '') {
                resolved.push(part);
            }
        }

        return resolved.join('/');
    }

    /**
     * Find relevant symbols
     */
    async findRelevantSymbols(intent) {
        const symbols = [];

        // Search for symbols mentioned in keywords
        for (const keyword of intent.keywords) {
            const foundSymbols = this.fileSystem.index.searchSymbols(keyword);
            symbols.push(...foundSymbols.slice(0, 5)); // Limit per keyword
        }

        return symbols.slice(0, 20); // Overall limit
    }

    /**
     * Analyze dependencies in relevant files
     */
    async analyzeDependencies(relevantFiles) {
        const dependencies = {
            internal: new Set(),
            external: new Set(),
            total: 0
        };

        for (const file of relevantFiles) {
            const imports = this.extractImports(file.content);
            
            for (const imp of imports) {
                dependencies.total++;
                
                if (imp.startsWith('.')) {
                    dependencies.internal.add(imp);
                } else {
                    dependencies.external.add(imp);
                }
            }
        }

        return {
            internal: Array.from(dependencies.internal),
            external: Array.from(dependencies.external),
            total: dependencies.total
        };
    }

    /**
     * Get project overview
     */
    getProjectOverview() {
        const repoInfo = this.fileSystem.getRepositoryInfo();
        const fileCount = this.fileSystem.getFileCount();
        const totalSize = this.fileSystem.getTotalSize();

        return {
            repository: repoInfo,
            fileCount,
            totalSize: Utils.formatFileSize(totalSize),
            structure: this.getSimpleProjectStructure()
        };
    }

    /**
     * Get simplified project structure
     */
    getSimpleProjectStructure() {
        const structure = {};
        const files = this.fileSystem.listFiles();
        const directories = new Set();

        // Collect top-level directories
        files.forEach(file => {
            const parts = file.path.split('/');
            if (parts.length > 1) {
                directories.add(parts[0]);
            }
        });

        // Count files in each directory
        directories.forEach(dir => {
            const dirFiles = files.filter(f => f.path.startsWith(dir + '/'));
            structure[dir] = dirFiles.length;
        });

        return structure;
    }

    /**
     * Trim context to fit within token limits
     */
    trimContextToLimit(relevantFiles) {
        let totalChars = 0;
        const trimmedFiles = [];

        for (const file of relevantFiles) {
            const fileChars = file.content.length;
            
            if (totalChars + fileChars <= this.maxContextChars) {
                trimmedFiles.push(file);
                totalChars += fileChars;
            } else {
                // Try to include a partial version of the file
                const remainingChars = this.maxContextChars - totalChars;
                if (remainingChars > 500) { // Only if we have reasonable space left
                    const partialContent = file.content.substring(0, remainingChars - 100) + '\n\n... [truncated]';
                    trimmedFiles.push(new RelevantFile(
                        file.path,
                        partialContent,
                        file.relevanceScore * 0.7, // Lower score for partial content
                        file.reason + '_partial',
                        file.matchedLines
                    ));
                }
                break;
            }
        }

        return trimmedFiles;
    }

    /**
     * Build context prompt for LLM
     */
    buildContextPrompt(context, userPrompt, provider = 'anthropic') {
        // Use the new prompt system if available
        if (window.CrushPrompts) {
            return window.CrushPrompts.buildContextPrompt(context, userPrompt, provider);
        }
        
        // Fallback to basic prompt construction
        return this.buildBasicPrompt(context, userPrompt);
    }
    
    /**
     * Build basic context prompt (fallback)
     */
    buildBasicPrompt(context, userPrompt) {
        let prompt = `You are Crush, a web-based coding assistant. Help users with software engineering tasks using the available tools.

## Project Context
`;

        // Add project overview
        if (context.projectStructure) {
            prompt += `**Repository:** ${context.projectStructure.repository?.owner}/${context.projectStructure.repository?.repo}\n`;
            prompt += `**Files:** ${context.projectStructure.fileCount}\n`;
            prompt += `**Size:** ${context.projectStructure.totalSize}\n\n`;
        }

        // Add relevant files
        if (context.relevantFiles.length > 0) {
            prompt += `## Relevant Files\n\n`;
            
            context.relevantFiles.forEach((file, index) => {
                prompt += `### ${index + 1}. ${file.path}\n`;
                prompt += `*Relevance: ${(file.relevanceScore * 100).toFixed(1)}% (${file.reason})*\n\n`;
                prompt += '```\n';
                prompt += file.content;
                prompt += '\n```\n\n';
            });
        }

        // Add environment info
        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'numeric', 
            day: 'numeric'
        });
        
        prompt += `\n<env>\nWorking directory: Browser Environment\nIs directory a git repo: ${context.projectStructure?.repository ? 'Yes' : 'No'}\nPlatform: web\nToday's date: ${today}\n</env>\n\n`;
        
        prompt += `## User Request\n\n${userPrompt}\n\n`;
        
        prompt += `## Instructions\n\nPlease help with the user's request using the available tools efficiently.`;

        return prompt;
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        if (config.maxContextTokens) {
            this.maxContextTokens = config.maxContextTokens;
            this.maxContextChars = this.maxContextTokens * this.avgCharsPerToken;
        }
        if (config.avgCharsPerToken) {
            this.avgCharsPerToken = config.avgCharsPerToken;
            this.maxContextChars = this.maxContextTokens * this.avgCharsPerToken;
        }
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.ContextManager = ContextManager;
}