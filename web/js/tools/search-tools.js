/**
 * Search and analysis tools for Browser Crush
 */

/**
 * Search Files Tool
 */
class SearchFilesTool extends BaseTool {
    constructor(fileSystem) {
        super();
        this.name = 'search_files';
        this.description = 'Search for files by name pattern or content';
        this.parameters = [
            new ToolParameter('query', 'string', 'Search query or pattern', true),
            new ToolParameter('search_type', 'string', 'Type of search to perform', false, ['content', 'filename', 'both']),
            new ToolParameter('case_sensitive', 'boolean', 'Case sensitive search (default: false)', false),
            new ToolParameter('file_extensions', 'array', 'Filter by file extensions (optional)', false),
            new ToolParameter('max_results', 'number', 'Maximum number of results (default: 20)', false)
        ];
        this.fileSystem = fileSystem;
    }

    async execute(args) {
        const { 
            query, 
            search_type = 'both', 
            case_sensitive = false, 
            file_extensions = [], 
            max_results = 20 
        } = args;
        
        try {
            const searchOptions = new SearchOptions();
            searchOptions.includeFilenames = search_type === 'filename' || search_type === 'both';
            searchOptions.includeContent = search_type === 'content' || search_type === 'both';
            searchOptions.caseSensitive = case_sensitive;
            searchOptions.maxResults = max_results;

            const results = await this.fileSystem.searchFiles(query, searchOptions);
            
            // Filter by file extensions if specified
            let filteredResults = results;
            if (file_extensions.length > 0) {
                filteredResults = results.filter(result => {
                    const extension = Utils.getFileExtension(result.filePath);
                    return file_extensions.includes(extension);
                });
            }

            if (filteredResults.length === 0) {
                return `No results found for query: "${query}"`;
            }

            let output = `## Search Results for "${query}"\n\n`;
            output += `Found ${filteredResults.length} result${filteredResults.length === 1 ? '' : 's'}:\n\n`;

            filteredResults.slice(0, max_results).forEach((result, index) => {
                output += `### ${index + 1}. ${result.filePath}\n`;
                output += `**Relevance:** ${(result.score * 100).toFixed(1)}%\n`;
                output += `**Match reason:** ${result.reason}\n`;

                if (result.matchedLines && result.matchedLines.length > 0) {
                    output += `**Matched lines:**\n`;
                    result.matchedLines.slice(0, 3).forEach(line => {
                        const highlightedContent = this.highlightMatch(line.content, query, case_sensitive);
                        output += `  Line ${line.lineNumber}: ${highlightedContent}\n`;
                    });

                    if (result.matchedLines.length > 3) {
                        output += `  ... and ${result.matchedLines.length - 3} more lines\n`;
                    }
                }

                output += '\n';
            });

            if (filteredResults.length > max_results) {
                output += `\n*Showing first ${max_results} results. ${filteredResults.length - max_results} more results available.*\n`;
            }

            return output;

        } catch (error) {
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    highlightMatch(text, query, caseSensitive) {
        const searchText = caseSensitive ? text : text.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const index = searchText.indexOf(searchQuery);
        
        if (index === -1) return text;
        
        return text.substring(0, index) + 
               `**${text.substring(index, index + query.length)}**` + 
               text.substring(index + query.length);
    }
}

/**
 * Find Symbol Tool
 */
class FindSymbolTool extends BaseTool {
    constructor(fileSystem) {
        super();
        this.name = 'find_symbol';
        this.description = 'Find functions, classes, variables and other code symbols';
        this.parameters = [
            new ToolParameter('symbol_name', 'string', 'Name of the symbol to find', true),
            new ToolParameter('symbol_type', 'string', 'Type of symbol to find', false, ['function', 'class', 'interface', 'variable', 'method']),
            new ToolParameter('file_path', 'string', 'Limit search to specific file (optional)', false)
        ];
        this.fileSystem = fileSystem;
    }

    async execute(args) {
        const { symbol_name, symbol_type, file_path } = args;
        
        try {
            let symbols;
            
            if (file_path) {
                // Search in specific file
                symbols = this.fileSystem.index.getSymbols(file_path)
                    .filter(symbol => symbol.name.toLowerCase().includes(symbol_name.toLowerCase()));
            } else {
                // Search across all files
                symbols = this.fileSystem.index.searchSymbols(symbol_name);
            }

            // Filter by symbol type if specified
            if (symbol_type) {
                symbols = symbols.filter(symbol => symbol.type === symbol_type);
            }

            if (symbols.length === 0) {
                return `No symbols found matching "${symbol_name}"${symbol_type ? ` of type ${symbol_type}` : ''}`;
            }

            let output = `## Symbol Search Results for "${symbol_name}"\n\n`;
            output += `Found ${symbols.length} symbol${symbols.length === 1 ? '' : 's'}:\n\n`;

            symbols.forEach((symbol, index) => {
                output += `### ${index + 1}. ${symbol.name} (${symbol.type})\n`;
                output += `**File:** ${symbol.filePath}\n`;
                output += `**Line:** ${symbol.lineNumber}\n`;
                output += `**Context:** \`${symbol.context}\`\n\n`;
            });

            return output;

        } catch (error) {
            throw new Error(`Symbol search failed: ${error.message}`);
        }
    }
}

/**
 * Analyze Code Tool
 */
class AnalyzeCodeTool extends BaseTool {
    constructor(fileSystem) {
        super();
        this.name = 'analyze_code';
        this.description = 'Analyze code structure, complexity, and patterns in a file or project';
        this.parameters = [
            new ToolParameter('file_path', 'string', 'Path to file to analyze (optional, analyzes entire project if not specified)', false),
            new ToolParameter('analysis_type', 'string', 'Type of analysis to perform', false, ['structure', 'complexity', 'dependencies', 'all'])
        ];
        this.fileSystem = fileSystem;
    }

    async execute(args) {
        const { file_path, analysis_type = 'all' } = args;
        
        try {
            if (file_path) {
                return await this.analyzeFile(file_path, analysis_type);
            } else {
                return await this.analyzeProject(analysis_type);
            }

        } catch (error) {
            throw new Error(`Code analysis failed: ${error.message}`);
        }
    }

    async analyzeFile(filePath, analysisType) {
        const file = await this.fileSystem.getFile(filePath);
        if (!file) {
            throw new Error(`File not found: ${filePath}`);
        }

        if (file.type === 'directory') {
            throw new Error(`Path is a directory, not a file: ${filePath}`);
        }

        const symbols = this.fileSystem.index.getSymbols(filePath);
        const lines = file.content.split('\n');
        
        let output = `## Code Analysis: ${filePath}\n\n`;

        if (analysisType === 'structure' || analysisType === 'all') {
            output += await this.analyzeStructure(file, symbols, lines);
        }

        if (analysisType === 'complexity' || analysisType === 'all') {
            output += await this.analyzeComplexity(file, lines);
        }

        if (analysisType === 'dependencies' || analysisType === 'all') {
            output += await this.analyzeDependencies(file, lines);
        }

        return output;
    }

    async analyzeProject(analysisType) {
        const files = this.fileSystem.listFiles();
        const codeFiles = files.filter(f => f.type === 'file' && this.isCodeFile(f.path));

        let output = `## Project Analysis\n\n`;
        output += `**Total files:** ${files.length}\n`;
        output += `**Code files:** ${codeFiles.length}\n`;
        output += `**Total size:** ${Utils.formatFileSize(this.fileSystem.getTotalSize())}\n\n`;

        // Language distribution
        const langStats = this.getLanguageStatistics(codeFiles);
        output += `### Language Distribution\n`;
        Object.entries(langStats).forEach(([lang, count]) => {
            output += `- ${lang}: ${count} files\n`;
        });
        output += '\n';

        // Symbol statistics
        const symbolStats = this.getSymbolStatistics();
        output += `### Code Symbols\n`;
        Object.entries(symbolStats).forEach(([type, count]) => {
            output += `- ${type}: ${count}\n`;
        });
        output += '\n';

        return output;
    }

    async analyzeStructure(file, symbols, lines) {
        let output = `### Structure Analysis\n\n`;
        
        output += `**File size:** ${Utils.formatFileSize(file.size)}\n`;
        output += `**Lines of code:** ${lines.length}\n`;
        output += `**Non-empty lines:** ${lines.filter(line => line.trim().length > 0).length}\n\n`;

        if (symbols.length > 0) {
            const symbolsByType = symbols.reduce((acc, symbol) => {
                acc[symbol.type] = (acc[symbol.type] || 0) + 1;
                return acc;
            }, {});

            output += `**Symbols found:**\n`;
            Object.entries(symbolsByType).forEach(([type, count]) => {
                output += `- ${type}: ${count}\n`;
            });
            output += '\n';

            // List major symbols
            const majorSymbols = symbols.filter(s => ['class', 'function', 'interface'].includes(s.type));
            if (majorSymbols.length > 0) {
                output += `**Major symbols:**\n`;
                majorSymbols.slice(0, 10).forEach(symbol => {
                    output += `- ${symbol.type} \`${symbol.name}\` (line ${symbol.lineNumber})\n`;
                });
                if (majorSymbols.length > 10) {
                    output += `- ... and ${majorSymbols.length - 10} more\n`;
                }
                output += '\n';
            }
        }

        return output;
    }

    async analyzeComplexity(file, lines) {
        let output = `### Complexity Analysis\n\n`;
        
        const complexityKeywords = [
            'if', 'else', 'elif', 'switch', 'case',
            'for', 'while', 'do',
            'try', 'catch', 'except', 'finally',
            'function', 'def', 'class', 'method'
        ];

        let complexityScore = 0;
        const longLines = [];
        const deeplyNestedLines = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Count complexity keywords
            complexityKeywords.forEach(keyword => {
                if (new RegExp(`\\b${keyword}\\b`).test(trimmedLine)) {
                    complexityScore++;
                }
            });

            // Check for long lines
            if (line.length > 120) {
                longLines.push(index + 1);
            }

            // Check for deep nesting (rough heuristic)
            const indentation = line.length - line.trimLeft().length;
            if (indentation > 20) {
                deeplyNestedLines.push(index + 1);
            }
        });

        output += `**Complexity score:** ${complexityScore}\n`;
        output += `**Average line length:** ${(file.content.length / lines.length).toFixed(1)} characters\n`;

        if (longLines.length > 0) {
            output += `**Long lines (>120 chars):** ${longLines.length} (lines: ${longLines.slice(0, 5).join(', ')}${longLines.length > 5 ? '...' : ''})\n`;
        }

        if (deeplyNestedLines.length > 0) {
            output += `**Deeply nested lines:** ${deeplyNestedLines.length} (lines: ${deeplyNestedLines.slice(0, 5).join(', ')}${deeplyNestedLines.length > 5 ? '...' : ''})\n`;
        }

        output += '\n';
        return output;
    }

    async analyzeDependencies(file, lines) {
        let output = `### Dependencies Analysis\n\n`;
        
        const imports = [];
        const requires = [];
        const includes = [];

        lines.forEach(line => {
            const trimmedLine = line.trim();
            
            // JavaScript/TypeScript imports
            const importMatch = trimmedLine.match(/^import\s+.*?from\s+['"]([^'"]+)['"]/);
            if (importMatch) {
                imports.push(importMatch[1]);
            }

            // Node.js requires
            const requireMatch = trimmedLine.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (requireMatch) {
                requires.push(requireMatch[1]);
            }

            // C/C++ includes
            const includeMatch = trimmedLine.match(/^#include\s*[<"]([^>"]+)[>"]/);
            if (includeMatch) {
                includes.push(includeMatch[1]);
            }

            // Python imports
            const pythonImportMatch = trimmedLine.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
            if (pythonImportMatch) {
                const module = pythonImportMatch[1] || pythonImportMatch[2].split(',')[0].trim();
                imports.push(module);
            }
        });

        const allDeps = [...imports, ...requires, ...includes];
        const uniqueDeps = [...new Set(allDeps)];

        if (uniqueDeps.length > 0) {
            output += `**Dependencies found:** ${uniqueDeps.length}\n`;
            
            const external = uniqueDeps.filter(dep => !dep.startsWith('.'));
            const internal = uniqueDeps.filter(dep => dep.startsWith('.'));

            if (external.length > 0) {
                output += `**External dependencies:** ${external.length}\n`;
                external.slice(0, 10).forEach(dep => {
                    output += `- ${dep}\n`;
                });
                if (external.length > 10) {
                    output += `- ... and ${external.length - 10} more\n`;
                }
            }

            if (internal.length > 0) {
                output += `**Internal imports:** ${internal.length}\n`;
                internal.slice(0, 10).forEach(dep => {
                    output += `- ${dep}\n`;
                });
                if (internal.length > 10) {
                    output += `- ... and ${internal.length - 10} more\n`;
                }
            }
        } else {
            output += `**Dependencies:** None found\n`;
        }

        output += '\n';
        return output;
    }

    isCodeFile(filePath) {
        const codeExtensions = [
            'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs',
            'php', 'rb', 'go', 'rs', 'kt', 'swift', 'scala', 'clj',
            'hs', 'elm', 'dart', 'vue', 'svelte'
        ];
        const extension = Utils.getFileExtension(filePath);
        return codeExtensions.includes(extension);
    }

    getLanguageStatistics(codeFiles) {
        const stats = {};
        codeFiles.forEach(file => {
            const extension = Utils.getFileExtension(file.path);
            const language = Utils.getLanguageFromExtension(extension);
            stats[language] = (stats[language] || 0) + 1;
        });
        return stats;
    }

    getSymbolStatistics() {
        const stats = {};
        for (const symbolList of this.fileSystem.index.symbolIndex.values()) {
            symbolList.forEach(symbol => {
                stats[symbol.type] = (stats[symbol.type] || 0) + 1;
            });
        }
        return stats;
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.SearchFilesTool = SearchFilesTool;
    window.FindSymbolTool = FindSymbolTool;
    window.AnalyzeCodeTool = AnalyzeCodeTool;
}