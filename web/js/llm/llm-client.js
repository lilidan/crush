/**
 * LLM Client for Browser Crush
 * Supports multiple LLM providers: OpenAI, Anthropic, Ollama
 */

class LLMClient {
    constructor(config = {}) {
        this.provider = config.provider || 'openai';
        this.apiKey = config.apiKey || null;
        this.baseUrl = config.baseUrl || null;
        this.model = config.model || 'gpt-4';
        this.defaultMaxTokens = 4000;
        this.defaultTemperature = 0.1;
        
        // Provider configurations
        this.providers = {
            openai: {
                baseUrl: 'https://api.openai.com/v1',
                models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
            },
            anthropic: {
                baseUrl: 'https://api.anthropic.com/v1',
                corsProxy: 'https://cors-anywhere.herokuapp.com/',
                models: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
            },
            ollama: {
                baseUrl: config.baseUrl || 'http://localhost:11434',
                models: ['codellama', 'llama2', 'mistral']
            }
        };
        
        // CORS proxy settings
        this.useCorsProxy = true; // Set to false when running with proper backend
    }

    /**
     * Generate response with tool support
     */
    async generateWithTools(prompt, tools = [], options = {}) {
        const messages = this.formatMessages(prompt);
        const request = new LLMRequest(
            messages,
            tools.map(tool => tool.getDefinition()),
            options.temperature || this.defaultTemperature,
            options.maxTokens || this.defaultMaxTokens
        );

        switch (this.provider) {
            case 'openai':
                return await this.callOpenAI(request);
            case 'anthropic':
                return await this.callAnthropic(request);
            case 'ollama':
                return await this.callOllama(request);
            default:
                throw new Error(`Unsupported LLM provider: ${this.provider}`);
        }
    }

    /**
     * Generate streaming response
     */
    async* generateStream(prompt, options = {}) {
        const messages = this.formatMessages(prompt);
        
        switch (this.provider) {
            case 'openai':
                yield* this.streamOpenAI(messages, options);
                break;
            case 'anthropic':
                yield* this.streamAnthropic(messages, options);
                break;
            case 'ollama':
                yield* this.streamOllama(messages, options);
                break;
            default:
                throw new Error(`Streaming not supported for provider: ${this.provider}`);
        }
    }

    /**
     * Format prompt into messages array
     */
    formatMessages(prompt) {
        if (Array.isArray(prompt)) {
            return prompt;
        }
        
        return [new LLMMessage('user', prompt)];
    }

    /**
     * Call OpenAI API
     */
    async callOpenAI(request) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model || 'gpt-4-turbo-preview',
                messages: request.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                tools: request.tools.length > 0 ? request.tools : undefined,
                tool_choice: request.tools.length > 0 ? 'auto' : undefined,
                temperature: request.temperature,
                max_tokens: request.maxTokens,
                stream: false
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        return new LLMResponse(
            data.choices[0].message.content || '',
            this.parseOpenAIToolCalls(data.choices[0].message.tool_calls),
            data.usage
        );
    }

    /**
     * Parse OpenAI tool calls
     */
    parseOpenAIToolCalls(toolCalls) {
        if (!toolCalls) return [];
        
        return toolCalls.map(call => new ToolCall(
            call.id,
            call.function.name,
            JSON.parse(call.function.arguments)
        ));
    }

    /**
     * Stream OpenAI response
     */
    async* streamOpenAI(messages, options) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model || 'gpt-4-turbo-preview',
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                temperature: options.temperature || this.defaultTemperature,
                max_tokens: options.maxTokens || this.defaultMaxTokens,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body reader available');
        }

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') return;

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices[0]?.delta?.content;
                            if (delta) {
                                yield delta;
                            }
                        } catch (error) {
                            Utils.warn('Failed to parse streaming chunk:', error);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Call Anthropic API
     */
    async callAnthropic(request) {
        if (!this.apiKey) {
            throw new Error('Anthropic API key is required');
        }

        // Convert tools to Anthropic format
        const anthropicTools = request.tools.map(tool => ({
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters
        }));

        const requestBody = {
            model: this.model || 'claude-3-sonnet-20240229',
            messages: request.messages.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            })),
            tools: anthropicTools.length > 0 ? anthropicTools : undefined,
            max_tokens: request.maxTokens,
            temperature: request.temperature
        };

        // Try direct API call first, then fallback to proxy
        const primaryFetch = async () => {
            return await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });
        };

        const proxyFetch = async () => {
            const proxyUrl = this.providers.anthropic.corsProxy + 'https://api.anthropic.com/v1/messages';
            return await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });
        };

        let response;
        try {
            response = await primaryFetch();
        } catch (error) {
            if (window.CORSHelper && window.CORSHelper.isLikelyCORSError(error)) {
                console.warn('🔄 CORS error detected, trying proxy...');
                try {
                    response = await proxyFetch();
                } catch (proxyError) {
                    const instructions = window.CORSHelper ? window.CORSHelper.getProxyInstructions() : 
                        'Run: node cors-proxy.js to start the local CORS proxy server';
                    throw new Error(`CORS error: Cannot access Anthropic API directly from browser.\n\n${instructions}`);
                }
            } else {
                throw error;
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        return new LLMResponse(
            this.extractAnthropicText(data.content),
            this.parseAnthropicToolCalls(data.content),
            { 
                prompt_tokens: data.usage?.input_tokens || 0,
                completion_tokens: data.usage?.output_tokens || 0,
                total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
            }
        );
    }

    /**
     * Extract text from Anthropic response
     */
    extractAnthropicText(content) {
        if (!Array.isArray(content)) return '';
        
        return content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');
    }

    /**
     * Parse Anthropic tool calls
     */
    parseAnthropicToolCalls(content) {
        if (!Array.isArray(content)) return [];
        
        return content
            .filter(block => block.type === 'tool_use')
            .map(block => new ToolCall(
                block.id,
                block.name,
                block.input
            ));
    }

    /**
     * Stream Anthropic response
     */
    async* streamAnthropic(messages, options) {
        if (!this.apiKey) {
            throw new Error('Anthropic API key is required');
        }

        // Build URL with CORS proxy if needed
        const providerConfig = this.providers.anthropic;
        const baseUrl = this.useCorsProxy && providerConfig.corsProxy 
            ? providerConfig.corsProxy + providerConfig.baseUrl 
            : providerConfig.baseUrl;

        console.log(this);
        console.log(this.providers);
        console.log(this.providers.anthropic);
        console.log('this.providers.anthropic.corsProxy', this.providers.anthropic.corsProxy);
        console.log('this.providers.anthropic.baseUrl', this.providers.anthropic.baseUrl);
        
        const response = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model || 'claude-3-sonnet-20240229',
                messages: messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                })),
                max_tokens: options.maxTokens || this.defaultMaxTokens,
                temperature: options.temperature || this.defaultTemperature,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status} - ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body reader available');
        }

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') return;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                yield parsed.delta.text;
                            }
                        } catch (error) {
                            Utils.warn('Failed to parse streaming chunk:', error);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Call Ollama API
     */
    async callOllama(request) {
        const baseUrl = this.baseUrl || 'http://localhost:11434';
        
        // Ollama doesn't support tools in the same way, so we'll include them in the prompt
        let prompt = request.messages[request.messages.length - 1].content;
        
        if (request.tools.length > 0) {
            const toolsDescription = this.formatToolsForOllama(request.tools);
            prompt = `${toolsDescription}\n\nUser request: ${prompt}`;
        }

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model || 'codellama',
                prompt: prompt,
                stream: false,
                options: {
                    temperature: request.temperature,
                    num_ctx: Math.min(request.maxTokens * 2, 8192) // Context window
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        // Try to parse tool calls from the response
        const toolCalls = this.parseOllamaToolCalls(data.response);
        
        return new LLMResponse(
            data.response,
            toolCalls,
            {
                prompt_tokens: data.prompt_eval_count || 0,
                completion_tokens: data.eval_count || 0,
                total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
            }
        );
    }

    /**
     * Format tools for Ollama (include in prompt)
     */
    formatToolsForOllama(tools) {
        const toolDescriptions = tools.map(tool => {
            const func = tool.function;
            const params = Object.entries(func.parameters.properties || {})
                .map(([name, param]) => `${name}: ${param.description}`)
                .join(', ');
            
            return `${func.name}(${params}): ${func.description}`;
        }).join('\n');

        return `Available tools:\n${toolDescriptions}\n\nTo use a tool, respond with JSON in this format:
{
  "tool_calls": [
    {
      "name": "tool_name",
      "arguments": { "param1": "value1" }
    }
  ],
  "response": "Your explanation here"
}`;
    }

    /**
     * Parse tool calls from Ollama response
     */
    parseOllamaToolCalls(response) {
        try {
            // Look for JSON in the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return [];

            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
                return parsed.tool_calls.map((call, index) => new ToolCall(
                    `ollama_${index}`,
                    call.name,
                    call.arguments
                ));
            }
        } catch (error) {
            Utils.warn('Failed to parse Ollama tool calls:', error);
        }
        
        return [];
    }

    /**
     * Stream Ollama response
     */
    async* streamOllama(messages, options) {
        const baseUrl = this.baseUrl || 'http://localhost:11434';
        const prompt = messages[messages.length - 1].content;

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model || 'codellama',
                prompt: prompt,
                stream: true,
                options: {
                    temperature: options.temperature || this.defaultTemperature,
                    num_ctx: Math.min((options.maxTokens || this.defaultMaxTokens) * 2, 8192)
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body reader available');
        }

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.response) {
                            yield parsed.response;
                        }
                        if (parsed.done) {
                            return;
                        }
                    } catch (error) {
                        Utils.warn('Failed to parse Ollama streaming chunk:', error);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Test connection to the LLM provider
     */
    async testConnection() {
        try {
            const testPrompt = 'Hello, please respond with "OK" to confirm the connection.';
            const response = await this.generateWithTools(testPrompt);
            return response.text.includes('OK') || response.text.length > 0;
        } catch (error) {
            Utils.error('Connection test failed:', error);
            return false;
        }
    }

    /**
     * Get available models for the provider
     */
    async getAvailableModels() {
        switch (this.provider) {
            case 'openai':
                return this.getOpenAIModels();
            case 'anthropic':
                return this.getAnthropicModels();
            case 'ollama':
                return this.getOllamaModels();
            default:
                return [];
        }
    }

    /**
     * Get OpenAI models
     */
    getOpenAIModels() {
        return [
            { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo' },
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
            { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K' }
        ];
    }

    /**
     * Get Anthropic models
     */
    getAnthropicModels() {
        return [
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
        ];
    }

    /**
     * Get Ollama models
     */
    async getOllamaModels() {
        try {
            const baseUrl = this.baseUrl || 'http://localhost:11434';
            const response = await fetch(`${baseUrl}/api/tags`);
            
            if (!response.ok) {
                return [{ id: 'codellama', name: 'CodeLlama (default)' }];
            }
            
            const data = await response.json();
            return data.models?.map(model => ({
                id: model.name,
                name: model.name
            })) || [];
        } catch (error) {
            Utils.warn('Failed to get Ollama models:', error);
            return [{ id: 'codellama', name: 'CodeLlama (default)' }];
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        if (config.provider) this.provider = config.provider;
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl;
        if (config.model) this.model = config.model;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            provider: this.provider,
            apiKey: this.apiKey ? '***' : null,
            baseUrl: this.baseUrl,
            model: this.model
        };
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        if (config.provider) this.provider = config.provider;
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        if (config.model) this.model = config.model;
        if (config.defaultMaxTokens) this.defaultMaxTokens = config.defaultMaxTokens;
        if (config.defaultTemperature) this.defaultTemperature = config.defaultTemperature;
        
        // Update provider-specific configs
        if (config.providers) {
            Object.keys(config.providers).forEach(provider => {
                if (this.providers[provider]) {
                    this.providers[provider] = { ...this.providers[provider], ...config.providers[provider] };
                } else {
                    this.providers[provider] = config.providers[provider];
                }
            });
        }
    }

    /**
     * Completion method (alias for generateWithTools)
     */
    async completion(request) {
        const tools = request.tools || [];
        const options = {
            temperature: request.temperature || this.defaultTemperature,
            maxTokens: request.maxTokens || this.defaultMaxTokens
        };

        // Convert LLMRequest to the format expected by generateWithTools
        const prompt = request.messages || request.prompt;
        
        try {
            const result = await this.generateWithTools(prompt, tools, options);
            
            // Return in expected format
            return new LLMResponse(
                result.content || result.message || result.text || '',
                result.toolCalls || [],
                result.usage || null
            );
        } catch (error) {
            throw new Error(`LLM completion failed: ${error.message}`);
        }
    }

    /**
     * Stream completion method
     */
    async streamCompletion(request, onChunk) {
        const options = {
            temperature: request.temperature || this.defaultTemperature,
            maxTokens: request.maxTokens || this.defaultMaxTokens
        };

        const prompt = request.messages || request.prompt;
        
        try {
            let fullContent = '';
            let toolCalls = [];

            // Use the generator function
            for await (const chunk of this.generateStream(prompt, options)) {
                if (typeof chunk === 'string') {
                    fullContent += chunk;
                    if (onChunk) {
                        onChunk({
                            content: chunk,
                            fullContent: fullContent,
                            toolCalls: toolCalls
                        });
                    }
                } else if (chunk && chunk.toolCalls) {
                    toolCalls.push(...chunk.toolCalls);
                    if (onChunk) {
                        onChunk({
                            content: '',
                            fullContent: fullContent,
                            toolCalls: chunk.toolCalls
                        });
                    }
                }
            }

            return new LLMResponse(fullContent, toolCalls, null);
        } catch (error) {
            throw new Error(`LLM streaming failed: ${error.message}`);
        }
    }
}

// Factory function to create LLM client
class LLMClientFactory {
    static create(provider, apiKey, options = {}) {
        const config = new LLMConfig(provider, apiKey, options.baseUrl, options.model);
        return new LLMClient(config);
    }

    static createFromStorage(provider) {
        const apiKey = window.CrushStorage ? window.CrushStorage.getApiKey(provider) : null;
        const config = window.CrushStorage ? window.CrushStorage.getConfig() : {};
        const llmConfig = config.llm || {};
        
        return new LLMClient({
            provider,
            apiKey,
            baseUrl: llmConfig.baseUrl,
            model: llmConfig.model
        });
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.LLMClient = LLMClient;
    window.LLMClientFactory = LLMClientFactory;
}