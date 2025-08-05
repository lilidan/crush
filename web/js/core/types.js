/**
 * Core type definitions and interfaces for Browser Crush
 */

// File system types
class FileEntry {
    constructor(path, content, type, size = 0, lastModified = new Date(), encoding = 'utf-8') {
        this.path = path;
        this.content = content;
        this.type = type; // 'file' | 'directory'
        this.size = size;
        this.lastModified = lastModified;
        this.encoding = encoding;
        this.sha = null; // Git SHA for versioning
    }
}

class SymbolInfo {
    constructor(name, type, filePath, lineNumber, column, context) {
        this.name = name;
        this.type = type; // 'function' | 'class' | 'interface' | 'variable' | 'method'
        this.filePath = filePath;
        this.lineNumber = lineNumber;
        this.column = column;
        this.context = context;
    }
}

class LineInfo {
    constructor(lineNumber, content, tokens = [], indentation = 0) {
        this.lineNumber = lineNumber;
        this.content = content;
        this.tokens = tokens;
        this.indentation = indentation;
    }
}

// Search types
class SearchOptions {
    constructor() {
        this.includeFilenames = true;
        this.includeContent = true;
        this.caseSensitive = false;
        this.maxResults = 50;
        this.filePattern = null;
        this.semantic = false;
        this.contentOptions = {};
    }
}

class FileSearchResult {
    constructor(filePath, content, score, matchedLines = [], reason = 'content_match') {
        this.filePath = filePath;
        this.content = content;
        this.score = score;
        this.matchedLines = matchedLines;
        this.reason = reason;
    }
}

class MatchedLine {
    constructor(lineNumber, content, matchStart, matchEnd) {
        this.lineNumber = lineNumber;
        this.content = content;
        this.matchStart = matchStart;
        this.matchEnd = matchEnd;
    }
}

// Context types
class UserIntent {
    constructor() {
        this.type = 'unknown'; // 'create' | 'edit' | 'delete' | 'read' | 'fix'
        this.targetFiles = [];
        this.keywords = [];
        this.operation = 'read';
    }
}

class RelevantFile {
    constructor(path, content, relevanceScore, reason, matchedLines = []) {
        this.path = path;
        this.content = content;
        this.relevanceScore = relevanceScore;
        this.reason = reason;
        this.matchedLines = matchedLines;
    }
}

class CodeContext {
    constructor() {
        this.projectStructure = null;
        this.relevantFiles = [];
        this.symbols = [];
        this.dependencies = [];
        this.recentChanges = [];
    }
}

class ContextResult {
    constructor(filePath, content, score, context) {
        this.filePath = filePath;
        this.content = content;
        this.score = score;
        this.context = context;
    }
}

// Change tracking types
class Change {
    constructor(type, filePath, oldContent = null, newContent = null, timestamp = new Date()) {
        this.type = type; // 'edit' | 'create' | 'delete'
        this.filePath = filePath;
        this.oldContent = oldContent;
        this.newContent = newContent;
        this.timestamp = timestamp;
        this.id = this.generateId();
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

class UndoAction {
    constructor(type, change, timestamp = new Date()) {
        this.type = type;
        this.change = change;
        this.timestamp = timestamp;
    }
}

// LLM types
class LLMConfig {
    constructor(provider, apiKey, baseUrl = null, model = null) {
        this.provider = provider; // 'openai' | 'anthropic' | 'ollama' | 'local'
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.model = model;
    }
}

class LLMMessage {
    constructor(role, content) {
        this.role = role; // 'user' | 'assistant' | 'system'
        this.content = content;
    }
}

class LLMRequest {
    constructor(messages, optionsOrTools = [], temperature = 0.1, maxTokens = 4000) {
        this.messages = messages;
        
        // Handle both old and new constructor signatures
        if (typeof optionsOrTools === 'object' && optionsOrTools.tools) {
            // New signature: (messages, options)
            const options = optionsOrTools;
            this.tools = options.tools || [];
            this.temperature = options.temperature || 0.1;
            this.maxTokens = options.maxTokens || 4000;
            this.stream = options.stream !== false;
        } else {
            // Old signature: (messages, tools, temperature, maxTokens)
            this.tools = Array.isArray(optionsOrTools) ? optionsOrTools : [];
            this.temperature = temperature;
            this.maxTokens = maxTokens;
            this.stream = false;
        }
    }
}

class LLMResponse {
    constructor(text, toolCalls = [], usage = null) {
        this.text = text;
        this.content = text; // Alias for compatibility
        this.toolCalls = toolCalls;
        this.usage = usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }
}

class ToolCall {
    constructor(id, name, args) {
        this.id = id;
        this.name = name;
        this.arguments = args;
    }
}

// Tool types
class ToolParameter {
    constructor(name, type, description, required = false, enumValues = null) {
        this.name = name;
        this.type = type;
        this.description = description;
        this.required = required;
        this.enum = enumValues;
    }
}

class ToolDefinition {
    constructor(type, func) {
        this.type = type;
        this.function = func;
    }
}

class ToolResult {
    constructor(success, result = null, error = null, toolCall = null) {
        this.success = success;
        this.result = result;
        this.error = error;
        this.toolCall = toolCall;
    }
}

// Agent types
class AgentConfig {
    constructor(llmProvider, apiKey, baseUrl = null) {
        this.llmProvider = llmProvider;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
}

class AgentResponse {
    constructor(sessionId, response, changes = [], artifacts = []) {
        this.sessionId = sessionId;
        this.response = response;
        this.changes = changes;
        this.artifacts = artifacts;
    }
}

class Session {
    constructor() {
        this.id = this.generateId();
        this.createdAt = new Date();
        this.messages = [];
        this.context = new CodeContext();
    }

    generateId() {
        return 'session_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Repository types
class RepositoryData {
    constructor(files = []) {
        this.files = files;
    }
}

class FileData {
    constructor(path, content, type, sha = null) {
        this.path = path;
        this.content = content;
        this.type = type;
        this.sha = sha;
    }
}

// Cache types
class CacheEntry {
    constructor(value, timestamp, ttl) {
        this.value = value;
        this.timestamp = timestamp;
        this.ttl = ttl;
    }
}

// Export types to global scope for browser usage
if (typeof window !== 'undefined') {
    window.FileEntry = FileEntry;
    window.SymbolInfo = SymbolInfo;
    window.LineInfo = LineInfo;
    window.SearchOptions = SearchOptions;
    window.FileSearchResult = FileSearchResult;
    window.MatchedLine = MatchedLine;
    window.UserIntent = UserIntent;
    window.RelevantFile = RelevantFile;
    window.CodeContext = CodeContext;
    window.ContextResult = ContextResult;
    window.Change = Change;
    window.UndoAction = UndoAction;
    window.LLMConfig = LLMConfig;
    window.LLMMessage = LLMMessage;
    window.LLMRequest = LLMRequest;
    window.LLMResponse = LLMResponse;
    window.ToolCall = ToolCall;
    window.ToolParameter = ToolParameter;
    window.ToolDefinition = ToolDefinition;
    window.ToolResult = ToolResult;
    window.AgentConfig = AgentConfig;
    window.AgentResponse = AgentResponse;
    window.Session = Session;
    window.RepositoryData = RepositoryData;
    window.FileData = FileData;
    window.CacheEntry = CacheEntry;
}