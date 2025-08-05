/**
 * Main Coding Agent for Browser Crush
 * Orchestrates all components to provide AI-powered code assistance
 */

class CodingAgent {
    constructor() {
        this.fileSystem = null;
        this.llmClient = null;
        this.changeTracker = null;
        this.contextManager = null;
        this.toolRegistry = null;
        this.storage = null;
        
        // UI components
        this.ui = null;
        this.isInitialized = false;
        
        // Conversation history
        this.conversationHistory = [];
        this.maxHistoryLength = 50;
        
        // State
        this.isProcessing = false;
        this.currentRequest = null;
        
        // Event listeners
        this.listeners = new Set();
        
        // Initialize
        this.init();
    }

    /**
     * Initialize the coding agent
     */
    async init() {
        try {
            Utils.log('Initializing Browser Crush Coding Agent...');
            
            // Initialize storage
            this.storage = window.CrushStorage || new StorageManager();
            
            // Initialize file system
            this.fileSystem = new VirtualFileSystem();
            
            // Initialize change tracker
            this.changeTracker = new ChangeTracker();
            
            // Initialize context manager
            this.contextManager = new ContextManager(this.fileSystem);
            
            // Initialize LLM client (will be set up in loadConfiguration)
            this.llmClient = null;
            
            // Initialize tool registry
            this.toolRegistry = new ToolRegistry();
            this.setupTools();
            
            // Initialize UI
            this.ui = new CodingAgentUI(this);
            
            // Load configuration
            await this.loadConfiguration();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            this.notifyListeners('initialized');
            
            Utils.log('Coding Agent initialized successfully');
            
        } catch (error) {
            Utils.error('Failed to initialize Coding Agent:', error);
            throw error;
        }
    }

    /**
     * Setup tools
     */
    setupTools() {
        // File operation tools
        this.toolRegistry.register(new ReadFileTool(this.fileSystem), 'file');
        this.toolRegistry.register(new WriteFileTool(this.fileSystem, this.changeTracker), 'file');
        this.toolRegistry.register(new EditFileTool(this.fileSystem, this.changeTracker), 'file');
        this.toolRegistry.register(new CreateFileTool(this.fileSystem, this.changeTracker), 'file');
        this.toolRegistry.register(new DeleteFileTool(this.fileSystem, this.changeTracker), 'file');
        this.toolRegistry.register(new ListFilesTool(this.fileSystem), 'file');
        
        // Search and analysis tools
        this.toolRegistry.register(new SearchFilesTool(this.fileSystem), 'search');
        this.toolRegistry.register(new FindSymbolTool(this.fileSystem), 'search');
        this.toolRegistry.register(new AnalyzeCodeTool(this.fileSystem), 'analysis');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Change tracker events
        this.changeTracker.addListener((event, data) => {
            this.notifyListeners('change_tracker_event', { event, data });
        });
        
        // File system events
        if (this.fileSystem.addListener) {
            this.fileSystem.addListener((event, data) => {
                this.notifyListeners('file_system_event', { event, data });
            });
        }
    }

    /**
     * Create LLM client directly using npm packages
     */
    createLLMClient(provider, apiKey, config = {}) {
        if (!window.LLMClientSDK) {
            throw new Error('LLMClientSDK not available');
        }
        
        return new window.LLMClientSDK({
            provider: provider,
            apiKey: apiKey,
            ...config
        });
    }

    /**
     * Load configuration
     */
    async loadConfiguration() {
        const config = this.storage.getConfig();
        
        // Get the selected provider from UI or config
        const selectedProvider = this.getSelectedProvider();
        
        // Create SDK-based LLM client
        const apiKey = this.storage.getApiKey(selectedProvider);
        
        if (selectedProvider && apiKey) {
            try {
                this.llmClient = this.createLLMClient(selectedProvider, apiKey, {
                    ...config.llm,
                    model: config.llm?.model
                });
                Utils.log(`LLM configured with provider: ${selectedProvider} (SDK)`);
            } catch (error) {
                Utils.error('Failed to initialize SDK client, falling back to basic client:', error);
                // Fallback to original client
                this.llmClient = new LLMClient({
                    ...config.llm,
                    provider: selectedProvider,
                    apiKey: apiKey
                });
                Utils.log(`LLM configured with provider: ${selectedProvider} (fallback)`);
            }
        } else {
            Utils.warn(`Missing API key for provider: ${selectedProvider}`);
            // Create basic client without API key for UI purposes
            this.llmClient = new LLMClient({
                ...config.llm,
                provider: selectedProvider
            });
        }
        
        // Update context manager configuration
        if (config.context) {
            this.contextManager.updateConfig(config.context);
        }
        
        // Load recent projects
        const recentProjects = this.storage.getRecentProjects();
        if (recentProjects.length > 0) {
            this.notifyListeners('recent_projects_loaded', { projects: recentProjects });
        }
    }

    /**
     * Get selected provider from UI
     */
    getSelectedProvider() {
        const providerSelect = document.getElementById('llmProviderSelect');
        if (providerSelect) {
            return providerSelect.value;
        }
        
        // Fallback to config
        const config = this.storage.getConfig();
        return config.llm?.provider || 'openai';
    }

    /**
     * Process user message
     */
    async processMessage(message, options = {}) {
        if (this.isProcessing) {
            throw new Error('Agent is currently processing another request');
        }

        this.isProcessing = true;
        this.currentRequest = {
            message,
            options,
            timestamp: new Date()
        };

        try {
            this.notifyListeners('processing_started', { message });

            // Add user message to history
            this.addToHistory('user', message);

            // Gather context
            const context = await this.contextManager.gatherContext(message, options);

            // Build system prompt with provider info
            const provider = this.llmClient.provider || 'anthropic';
            const systemPrompt = this.contextManager.buildContextPrompt(context, message, provider);

            // Prepare conversation for LLM
            const conversation = this.buildConversation(systemPrompt, message);

            // Get tool definitions
            const tools = this.toolRegistry.getDefinitions();

            // Create LLM request
            const llmRequest = new LLMRequest(
                conversation,
                {
                    temperature: options.temperature || 0.7,
                    maxTokens: options.maxTokens || 4000,
                    stream: options.stream !== false,
                    tools: tools
                }
            );

            // Process with LLM
            let response = '';
            let toolCalls = [];

            if (options.stream !== false) {
                await this.llmClient.streamCompletion(llmRequest, (chunk) => {
                    if (chunk.content) {
                        response += chunk.content;
                        this.notifyListeners('response_chunk', { chunk: chunk.content, fullResponse: response });
                    }
                    if (chunk.toolCalls) {
                        toolCalls.push(...chunk.toolCalls);
                    }
                });
            } else {
                const llmResponse = await this.llmClient.completion(llmRequest);
                response = llmResponse.content;
                toolCalls = llmResponse.toolCalls || [];
            }

            // Execute tool calls if any
            const toolResults = [];
            if (toolCalls.length > 0) {
                this.notifyListeners('tool_calls_started', { toolCalls });
                
                for (const toolCall of toolCalls) {
                    try {
                        const result = await this.toolRegistry.execute(toolCall);
                        toolResults.push({
                            toolCall,
                            result
                        });
                        this.notifyListeners('tool_executed', { toolCall, result });
                    } catch (error) {
                        const errorResult = { success: false, error: error.message };
                        toolResults.push({
                            toolCall,
                            result: errorResult
                        });
                        this.notifyListeners('tool_error', { toolCall, error });
                    }
                }

                // If tools were executed, get follow-up response
                if (toolResults.some(tr => tr.result.success)) {
                    const toolResultsText = this.formatToolResults(toolResults);
                    const followUpRequest = new LLMRequest([
                        ...conversation,
                        { role: 'assistant', content: response, toolCalls },
                        { role: 'user', content: `Tool results:\n${toolResultsText}\n\nPlease provide a summary or follow-up response based on these results.` }
                    ], { temperature: 0.7, maxTokens: 2000 });

                    const followUpResponse = await this.llmClient.completion(followUpRequest);
                    response += '\n\n' + followUpResponse.content;
                }
            }

            // Add assistant response to history
            this.addToHistory('assistant', response, { toolCalls, toolResults });

            // Notify completion
            this.notifyListeners('processing_completed', {
                message,
                response,
                toolCalls,
                toolResults,
                context
            });

            return {
                response,
                toolCalls,
                toolResults,
                context
            };

        } catch (error) {
            this.notifyListeners('processing_error', { message, error });
            throw error;
        } finally {
            this.isProcessing = false;
            this.currentRequest = null;
        }
    }

    /**
     * Build conversation for LLM
     */
    buildConversation(systemPrompt, userMessage) {
        const conversation = [
            { role: 'system', content: systemPrompt }
        ];

        // Add recent conversation history (excluding system messages)
        const recentHistory = this.conversationHistory
            .filter(msg => msg.role !== 'system')
            .slice(-10); // Last 10 messages

        conversation.push(...recentHistory);

        // Add current user message if not already in history
        if (!recentHistory.some(msg => msg.role === 'user' && msg.content === userMessage)) {
            conversation.push({ role: 'user', content: userMessage });
        }

        return conversation;
    }

    /**
     * Format tool results for LLM
     */
    formatToolResults(toolResults) {
        return toolResults.map(tr => {
            const { toolCall, result } = tr;
            return `**${toolCall.name}**:\n${result.success ? result.content : `Error: ${result.error}`}\n`;
        }).join('\n');
    }

    /**
     * Add message to conversation history
     */
    addToHistory(role, content, metadata = {}) {
        const message = {
            role,
            content,
            timestamp: new Date(),
            ...metadata
        };

        this.conversationHistory.push(message);

        // Limit history size
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }

        this.notifyListeners('history_updated', { message });
    }

    /**
     * Load project from GitHub
     */
    async loadProject(repoUrl, options = {}) {
        try {
            this.notifyListeners('project_loading_started', { repoUrl });

            const result = await this.fileSystem.loadFromGitHub(repoUrl, options);
            
            // Save to recent projects
            this.storage.addRecentProject({
                url: repoUrl,
                name: result.repoInfo.repo,
                owner: result.repoInfo.owner,
                loadedAt: new Date(),
                fileCount: result.fileCount
            });

            this.notifyListeners('project_loaded', { repoUrl, result });
            return result;

        } catch (error) {
            this.notifyListeners('project_loading_error', { repoUrl, error });
            throw error;
        }
    }

    /**
     * Save current state
     */
    async saveState() {
        const state = {
            conversationHistory: this.conversationHistory,
            changes: this.changeTracker.exportChanges(),
            timestamp: new Date()
        };

        this.storage.saveSessionData('current_state', state);
        this.notifyListeners('state_saved', { state });
    }

    /**
     * Load saved state
     */
    async loadState() {
        const state = this.storage.getSessionData('current_state');
        if (!state) return false;

        try {
            // Restore conversation history
            this.conversationHistory = state.conversationHistory || [];

            // Restore changes
            if (state.changes) {
                this.changeTracker.importChanges(state.changes);
            }

            this.notifyListeners('state_loaded', { state });
            return true;

        } catch (error) {
            Utils.error('Failed to load state:', error);
            return false;
        }
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
        this.notifyListeners('history_cleared');
    }

    /**
     * Undo last change
     */
    async undo() {
        if (this.changeTracker.canUndo()) {
            await this.changeTracker.undo();
            this.notifyListeners('change_undone');
            return true;
        }
        return false;
    }

    /**
     * Redo last undone change
     */
    async redo() {
        if (this.changeTracker.canRedo()) {
            await this.changeTracker.redo();
            this.notifyListeners('change_redone');
            return true;
        }
        return false;
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            processing: this.isProcessing,
            currentRequest: this.currentRequest,
            fileSystem: {
                hasProject: this.fileSystem.getFileCount() > 0,
                fileCount: this.fileSystem.getFileCount(),
                totalSize: this.fileSystem.getTotalSize()
            },
            changeTracker: this.changeTracker.getHistoryStats(),
            conversationLength: this.conversationHistory.length,
            tools: this.toolRegistry.getStats()
        };
    }

    /**
     * Update configuration
     */
    async updateConfig(config) {
        // Update LLM config with API key
        if (config.llm) {
            const provider = config.llm.provider;
            const apiKey = this.storage.getApiKey(provider);
            
            if (provider && apiKey) {
                try {
                    this.llmClient = this.createLLMClient(provider, apiKey, config.llm);
                    Utils.log(`LLM reconfigured with provider: ${provider} (SDK)`);
                } catch (error) {
                    Utils.error('Failed to update SDK client, using updateConfig fallback:', error);
                    // Fallback to updating existing client
                    if (this.llmClient && this.llmClient.updateConfig) {
                        const llmConfig = { ...config.llm, apiKey };
                        this.llmClient.updateConfig(llmConfig);
                    }
                }
            } else if (this.llmClient && this.llmClient.updateConfig) {
                this.llmClient.updateConfig(config.llm);
            }
        }

        // Update context manager config
        if (config.context) {
            this.contextManager.updateConfig(config.context);
        }

        // Save configuration
        this.storage.updateConfig(config);
        
        this.notifyListeners('config_updated', { config });
        
        Utils.log(`Configuration updated for provider: ${config.llm?.provider || 'unknown'}`);
    }

    /**
     * Switch LLM provider
     */
    async switchProvider(provider) {
        const apiKey = this.storage.getApiKey(provider);
        if (!apiKey) {
            throw new Error(`No API key found for provider: ${provider}`);
        }

        const config = this.storage.getConfig();
        console.log('config', config);
        console.log('apiKey', apiKey);
        console.log('provider', provider);
        
        try {
            this.llmClient = this.createLLMClient(provider, apiKey, {
                ...config.llm,
                provider: provider
            });
            Utils.log(`Switched to provider: ${provider} (SDK)`);
        } catch (error) {
            Utils.error('Failed to switch to SDK client, using fallback:', error);
            // Fallback to original client
            const llmConfig = {
                ...config.llm,
                provider: provider,
                apiKey: apiKey
            };
            
            if (this.llmClient && this.llmClient.updateConfig) {
                this.llmClient.updateConfig(llmConfig);
            } else {
                this.llmClient = new LLMClient(llmConfig);
            }
            Utils.log(`Switched to provider: ${provider} (fallback)`);
        }
        
        // Update stored config
        config.llm = { ...config.llm, provider: provider };
        this.storage.updateConfig(config);
        
        // Update UI
        const providerSelect = document.getElementById('llmProviderSelect');
        if (providerSelect) {
            providerSelect.value = provider;
        }

        this.notifyListeners('provider_switched', { provider });
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
     * Notify all listeners
     */
    notifyListeners(event, data = {}) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                Utils.error('Listener error:', error);
            }
        });
    }

    /**
     * Export project data
     */
    exportProject() {
        return {
            files: this.fileSystem.exportFiles(),
            changes: this.changeTracker.exportChanges(),
            conversation: this.conversationHistory,
            exportedAt: new Date()
        };
    }

    /**
     * Import project data
     */
    async importProject(data) {
        try {
            // Import files
            if (data.files) {
                await this.fileSystem.importFiles(data.files);
            }

            // Import changes
            if (data.changes) {
                this.changeTracker.importChanges(data.changes);
            }

            // Import conversation
            if (data.conversation) {
                this.conversationHistory = data.conversation;
            }

            this.notifyListeners('project_imported', { data });
            return true;

        } catch (error) {
            Utils.error('Failed to import project:', error);
            throw error;
        }
    }

    /**
     * Destroy the agent
     */
    destroy() {
        this.listeners.clear();
        this.conversationHistory = [];
        
        if (this.ui) {
            this.ui.destroy();
        }
        
        this.isInitialized = false;
        this.notifyListeners('destroyed');
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.CodingAgent = CodingAgent;
}