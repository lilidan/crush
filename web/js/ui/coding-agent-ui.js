/**
 * UI Components for Browser Crush Coding Agent
 */

class CodingAgentUI {
    constructor(agent) {
        this.agent = agent;
        this.elements = {};
        this.editor = null;
        this.currentFile = null;
        this.isInitialized = false;
        
        this.init();
    }

    /**
     * Initialize UI
     */
    init() {
        this.setupElements();
        this.setupEventListeners();
        this.setupEditor();
        this.setupFileTree();
        this.setupChat();
        
        this.isInitialized = true;
        console.log('UI initialized');
    }

    /**
     * Setup DOM elements
     */
    setupElements() {
        this.elements = {
            // Main containers
            sidebar: document.getElementById('sidebar'),
            mainContent: document.getElementById('main-content'),
            fileTree: document.getElementById('file-tree'),
            editorContainer: document.getElementById('editor-container'),
            chatContainer: document.getElementById('chat-container'),
            
            // File tree elements
            fileTreeContent: document.getElementById('file-tree-content'),
            
            // Editor elements
            editorTabs: document.getElementById('editor-tabs'),
            monacoEditor: document.getElementById('monaco-editor'),
            
            // Chat elements
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            chatSend: document.getElementById('chat-send'),
            
            // Repository elements
            repoButton: document.getElementById('repo-button'),
            repoModal: document.getElementById('repo-modal'),
            repoUrlInput: document.getElementById('repo-url'),
            repoLoadButton: document.getElementById('repo-load'),
            repoCloseButton: document.getElementById('repo-close'),
            
            // Settings elements
            settingsButton: document.getElementById('settings-button'),
            settingsModal: document.getElementById('settings-modal'),
            settingsCloseButton: document.getElementById('settings-close'),
            settingsSaveButton: document.getElementById('settings-save'),
            
            // Status elements
            statusBar: document.getElementById('status-bar'),
            statusText: document.getElementById('status-text'),
            
            // Control buttons
            undoButton: document.getElementById('undo-button'),
            redoButton: document.getElementById('redo-button'),
            clearButton: document.getElementById('clear-button')
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Agent events
        this.agent.addListener((event, data) => {
            this.handleAgentEvent(event, data);
        });

        // Chat events
        if (this.elements.chatSend) {
            this.elements.chatSend.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Repository events
        if (this.elements.repoButton) {
            this.elements.repoButton.addEventListener('click', () => this.showRepoModal());
        }
        
        if (this.elements.repoLoadButton) {
            this.elements.repoLoadButton.addEventListener('click', () => this.loadRepository());
        }
        
        if (this.elements.repoCloseButton) {
            this.elements.repoCloseButton.addEventListener('click', () => this.hideRepoModal());
        }

        // Settings events
        if (this.elements.settingsButton) {
            this.elements.settingsButton.addEventListener('click', () => this.showSettingsModal());
        }
        
        if (this.elements.settingsCloseButton) {
            this.elements.settingsCloseButton.addEventListener('click', () => this.hideSettingsModal());
        }
        
        if (this.elements.settingsSaveButton) {
            this.elements.settingsSaveButton.addEventListener('click', () => this.saveSettings());
        }

        // Control events
        if (this.elements.undoButton) {
            this.elements.undoButton.addEventListener('click', () => this.agent.undo());
        }
        
        if (this.elements.redoButton) {
            this.elements.redoButton.addEventListener('click', () => this.agent.redo());
        }
        
        if (this.elements.clearButton) {
            this.elements.clearButton.addEventListener('click', () => this.clearChat());
        }

        // Window events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('beforeunload', () => this.agent.saveState());

        // Provider selector events
        const providerSelect = document.getElementById('llmProviderSelect');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                const provider = e.target.value;
                const apiKey = this.agent.storage.getApiKey(provider);
                if (apiKey) {
                    this.agent.switchProvider(provider).catch(error => {
                        console.error('Failed to switch provider:', error);
                        this.setStatus(`Error switching to ${provider}`, 'error');
                    });
                } else {
                    this.setStatus(`Configure API key for ${provider}`, 'error');
                    this.showSettingsModal();
                }
            });
        }
    }

    /**
     * Setup Monaco Editor
     */
    setupEditor() {
        if (!window.monaco || !this.elements.monacoEditor) return;

        // Configure Monaco
        monaco.editor.defineTheme('crush-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#1a1a1a',
                'editor.foreground': '#e0e0e0',
                'editorLineNumber.foreground': '#666666',
                'editorLineNumber.activeForeground': '#ffffff'
            }
        });

        // Create editor
        this.editor = monaco.editor.create(this.elements.monacoEditor, {
            value: '// Welcome to Browser Crush\n// Load a repository or create files to get started',
            language: 'javascript',
            theme: 'crush-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false
        });

        // Setup editor events
        this.editor.onDidChangeModelContent((e) => {
            if (this.currentFile) {
                this.handleFileEdit(this.currentFile, this.editor.getValue());
            }
        });
    }

    /**
     * Setup file tree
     */
    setupFileTree() {
        if (!this.elements.fileTreeContent) return;

        // Initial empty state
        this.updateFileTree([]);
    }

    /**
     * Setup chat interface
     */
    setupChat() {
        if (!this.elements.chatMessages) return;

        // Add welcome message
        this.addChatMessage('assistant', 'Welcome to Browser Crush! I\'m your AI coding assistant. Load a repository or ask me to help you with your code.');
    }

    /**
     * Handle agent events
     */
    handleAgentEvent(event, data) {
        switch (event) {
            case 'processing_started':
                this.setStatus('Processing...', 'processing');
                this.addChatMessage('user', data.message);
                break;
                
            case 'response_chunk':
                this.updateChatResponse(data.chunk, data.fullResponse);
                break;
                
            case 'processing_completed':
                this.setStatus('Ready', 'ready');
                this.finalizeChatResponse(data.response);
                break;
                
            case 'processing_error':
                this.setStatus('Error', 'error');
                this.addChatMessage('error', `Error: ${data.error.message}`);
                break;
                
            case 'project_loaded':
                this.updateFileTree().catch(error => console.error('Failed to update file tree:', error));
                this.setStatus(`Loaded ${data.result.fileCount} files`, 'ready');
                break;
                
            case 'file_system_event':
                if (data.event === 'file_added' || data.event === 'file_updated' || data.event === 'file_deleted') {
                    this.updateFileTree().catch(error => console.error('Failed to update file tree:', error));
                }
                break;
                
            case 'change_undone':
            case 'change_redone':
                this.updateControlButtons();
                if (this.currentFile) {
                    this.refreshCurrentFile();
                }
                break;
        }
    }

    /**
     * Send chat message
     */
    async sendMessage() {
        const input = this.elements.chatInput;
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        input.disabled = true;

        try {
            await this.agent.processMessage(message);
        } catch (error) {
            this.addChatMessage('error', `Error: ${error.message}`);
        } finally {
            input.disabled = false;
            input.focus();
        }
    }

    /**
     * Add chat message
     */
    addChatMessage(role, content) {
        if (!this.elements.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'assistant' || role === 'error') {
            // Render markdown-like content
            contentDiv.innerHTML = this.formatMarkdown(content);
        } else {
            contentDiv.textContent = content;
        }
        
        messageDiv.appendChild(contentDiv);
        this.elements.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    /**
     * Update chat response (for streaming)
     */
    updateChatResponse(chunk, fullResponse) {
        let responseDiv = this.elements.chatMessages.querySelector('.chat-message.assistant:last-child .message-content');
        
        if (!responseDiv) {
            this.addChatMessage('assistant', '');
            responseDiv = this.elements.chatMessages.querySelector('.chat-message.assistant:last-child .message-content');
        }
        
        responseDiv.innerHTML = this.formatMarkdown(fullResponse);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    /**
     * Finalize chat response
     */
    finalizeChatResponse(response) {
        const responseDiv = this.elements.chatMessages.querySelector('.chat-message.assistant:last-child .message-content');
        if (responseDiv) {
            responseDiv.innerHTML = this.formatMarkdown(response);
        }
    }

    /**
     * Format markdown-like content
     */
    formatMarkdown(content) {
        return content
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    /**
     * Update file tree
     */
    async updateFileTree() {
        if (!this.elements.fileTreeContent || !this.agent.fileSystem) return;

        const files = await this.agent.fileSystem.listFiles();
        this.elements.fileTreeContent.innerHTML = '';

        if (files.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'file-tree-empty';
            emptyDiv.textContent = 'No files loaded';
            this.elements.fileTreeContent.appendChild(emptyDiv);
            return;
        }

        // Build tree structure
        const tree = this.buildFileTree(files);
        this.renderFileTree(tree, this.elements.fileTreeContent);
    }

    /**
     * Build file tree structure
     */
    buildFileTree(files) {
        const tree = {};
        
        files.forEach(file => {
            const parts = file.path.split('/');
            let current = tree;
            
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        name: part,
                        path: parts.slice(0, index + 1).join('/'),
                        type: index === parts.length - 1 ? file.type : 'directory',
                        children: {}
                    };
                }
                current = current[part].children;
            });
        });
        
        return tree;
    }

    /**
     * Render file tree
     */
    renderFileTree(tree, container, level = 0) {
        Object.values(tree).forEach(node => {
            const div = document.createElement('div');
            div.className = `file-tree-item level-${level}`;
            div.style.paddingLeft = `${level * 20}px`;
            
            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = node.type === 'directory' ? '📁' : '📄';
            
            const name = document.createElement('span');
            name.className = 'file-name';
            name.textContent = node.name;
            
            div.appendChild(icon);
            div.appendChild(name);
            
            if (node.type === 'file') {
                div.addEventListener('click', () => this.openFile(node.path));
                div.className += ' file';
            } else {
                div.className += ' directory';
                div.addEventListener('click', () => this.toggleDirectory(div));
            }
            
            container.appendChild(div);
            
            if (node.type === 'directory' && Object.keys(node.children).length > 0) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'file-tree-children';
                childrenDiv.style.display = 'none';
                this.renderFileTree(node.children, childrenDiv, level + 1);
                container.appendChild(childrenDiv);
            }
        });
    }

    /**
     * Toggle directory in file tree
     */
    toggleDirectory(dirDiv) {
        const children = dirDiv.nextElementSibling;
        if (children) {
            const isOpen = children.style.display !== 'none';
            children.style.display = isOpen ? 'none' : 'block';
            
            const icon = dirDiv.querySelector('.file-icon');
            icon.textContent = isOpen ? '📁' : '📂';
        }
    }

    /**
     * Open file in editor
     */
    async openFile(filePath) {
        if (!this.editor || !this.agent.fileSystem) return;

        try {
            const file = await this.agent.fileSystem.getFile(filePath);
            if (!file || file.type !== 'file') return;

            this.currentFile = filePath;
            this.editor.setValue(file.content);
            
            // Set language based on file extension
            const language = this.getLanguageFromPath(filePath);
            const model = this.editor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, language);
            }
            
            // Update tab
            this.updateEditorTab(filePath);
            
            // Update status
            this.setStatus(`Editing: ${filePath}`, 'ready');
            
        } catch (error) {
            console.error('Failed to open file:', error);
        }
    }

    /**
     * Update editor tab
     */
    updateEditorTab(filePath) {
        if (!this.elements.editorTabs) return;

        this.elements.editorTabs.innerHTML = '';
        
        const tab = document.createElement('div');
        tab.className = 'editor-tab active';
        tab.textContent = filePath.split('/').pop();
        tab.title = filePath;
        
        this.elements.editorTabs.appendChild(tab);
    }

    /**
     * Handle file edit
     */
    async handleFileEdit(filePath, content) {
        if (!this.agent.fileSystem) return;

        try {
            const file = await this.agent.fileSystem.getFile(filePath);
            if (file && file.content !== content) {
                await this.agent.fileSystem.updateFile(filePath, content);
                
                // Record change
                this.agent.changeTracker.recordChange(
                    new Change('edit', filePath, file.content, content)
                );
            }
        } catch (error) {
            console.error('Failed to update file:', error);
        }
    }

    /**
     * Refresh current file
     */
    async refreshCurrentFile() {
        if (this.currentFile) {
            await this.openFile(this.currentFile);
        }
    }

    /**
     * Get language from file path
     */
    getLanguageFromPath(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
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
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'md': 'markdown',
            'sh': 'shell',
            'sql': 'sql'
        };
        return languageMap[extension] || 'plaintext';
    }

    /**
     * Show repository modal
     */
    showRepoModal() {
        if (this.elements.repoModal) {
            this.elements.repoModal.style.display = 'flex';
            if (this.elements.repoUrlInput) {
                this.elements.repoUrlInput.focus();
            }
        }
    }

    /**
     * Hide repository modal
     */
    hideRepoModal() {
        if (this.elements.repoModal) {
            this.elements.repoModal.style.display = 'none';
        }
    }

    /**
     * Load repository
     */
    async loadRepository() {
        const urlInput = this.elements.repoUrlInput;
        if (!urlInput) return;

        const url = urlInput.value.trim();
        if (!url) return;

        try {
            await this.agent.loadProject(url);
            this.hideRepoModal();
            urlInput.value = '';
        } catch (error) {
            alert(`Failed to load repository: ${error.message}`);
        }
    }

    /**
     * Show settings modal
     */
    showSettingsModal() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.style.display = 'flex';
            this.loadSettingsForm();
        }
    }

    /**
     * Hide settings modal
     */
    hideSettingsModal() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.style.display = 'none';
        }
    }

    /**
     * Load settings form
     */
    loadSettingsForm() {
        const config = this.agent.storage.getConfig();
        
        // Load API keys from storage
        const openaiKey = document.getElementById('openai-api-key');
        const anthropicKey = document.getElementById('anthropic-api-key');
        const ollamaUrl = document.getElementById('ollama-url');
        
        if (openaiKey) {
            const key = this.agent.storage.getApiKey('openai');
            openaiKey.value = key ? '••••••••' : ''; // Mask existing keys
        }
        if (anthropicKey) {
            const key = this.agent.storage.getApiKey('anthropic');
            anthropicKey.value = key ? '••••••••' : ''; // Mask existing keys
        }
        if (ollamaUrl) {
            ollamaUrl.value = config.llm?.providers?.ollama?.baseUrl || 'http://localhost:11434';
        }
        
        // Load other settings
        const provider = document.getElementById('llm-provider');
        const model = document.getElementById('llm-model');
        
        if (provider) provider.value = config.llm?.provider || 'openai';
        if (model) model.value = config.llm?.model || 'gpt-4';
        
        // Update UI based on current provider
        const currentProvider = config.llm?.provider || 'openai';
        const headerSelect = document.getElementById('llmProviderSelect');
        if (headerSelect) {
            headerSelect.value = currentProvider;
        }
    }

    /**
     * Save settings
     */
    saveSettings() {
        const provider = document.getElementById('llm-provider')?.value || 'openai';
        const model = document.getElementById('llm-model')?.value || 'gpt-4';
        
        // Save API keys (only if they're not masked)
        const openaiKey = document.getElementById('openai-api-key')?.value;
        const anthropicKey = document.getElementById('anthropic-api-key')?.value;
        const ollamaUrl = document.getElementById('ollama-url')?.value || 'http://localhost:11434';
        console.log('openaiKey', openaiKey);
        console.log('anthropicKey', anthropicKey);

        if (openaiKey && openaiKey !== '••••••••') {
            this.agent.storage.setApiKey('openai', openaiKey, true);
        }
        if (anthropicKey && anthropicKey !== '••••••••') {
            this.agent.storage.setApiKey('anthropic', anthropicKey, true);
        }
        
        const config = {
            llm: {
                provider: provider,
                model: model,
                providers: {
                    openai: { model: 'gpt-4' },
                    anthropic: { model: 'claude-sonnet-4-0' },
                    ollama: { baseUrl: ollamaUrl }
                }
            },
            context: {
                maxContextTokens: 8000
            }
        };

        this.agent.updateConfig(config);
        
        // Switch to the selected provider
        try {
            this.agent.switchProvider(provider);
            this.setStatus(`Switched to ${provider}`, 'ready');
        } catch (error) {
            this.setStatus(`Error: ${error.message}`, 'error');
        }
        
        this.hideSettingsModal();
    }

    /**
     * Clear chat
     */
    clearChat() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
            this.setupChat();
        }
        this.agent.clearHistory();
    }

    /**
     * Update control buttons
     */
    updateControlButtons() {
        if (this.elements.undoButton) {
            this.elements.undoButton.disabled = !this.agent.changeTracker.canUndo();
        }
        if (this.elements.redoButton) {
            this.elements.redoButton.disabled = !this.agent.changeTracker.canRedo();
        }
    }

    /**
     * Set status
     */
    setStatus(text, type = 'ready') {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = text;
        }
        if (this.elements.statusBar) {
            this.elements.statusBar.className = `status-bar ${type}`;
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.editor) {
            this.editor.layout();
        }
    }

    /**
     * Destroy UI
     */
    destroy() {
        if (this.editor) {
            this.editor.dispose();
        }
        this.isInitialized = false;
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.CodingAgentUI = CodingAgentUI;
}