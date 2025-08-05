/**
 * LLM Client for Browser Crush - SDK Version
 * Uses official OpenAI and Anthropic SDKs instead of direct API calls
 */

// Import SDKs directly from npm packages
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

class LLMClientSDK {
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
                models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini']
            },
            anthropic: {
                baseUrl: 'https://api.anthropic.com/v1',
                models: ['claude-3-5-sonnet-20241022', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
            },
            ollama: {
                baseUrl: config.baseUrl || 'http://localhost:11434',
                models: ['codellama', 'llama2', 'mistral']
            }
        };
        
        // Initialize SDK clients
        this.clients = {};
        this.initializeClients();
    }

    /**
     * Initialize SDK clients
     */
    initializeClients() {
        try {
            // Initialize OpenAI client
            if (this.apiKey && this.provider === 'openai' && OpenAI) {
                this.clients.openai = new OpenAI({
                    apiKey: this.apiKey,
                    baseURL: this.baseUrl || this.providers.openai.baseUrl,
                    dangerouslyAllowBrowser: true // Required for browser usage
                });
            }

            // Initialize Anthropic client
            if (this.apiKey && this.provider === 'anthropic' && Anthropic) {
                this.clients.anthropic = new Anthropic({
                    apiKey: this.apiKey,
                    baseURL: this.baseUrl || this.providers.anthropic.baseUrl,
                    dangerouslyAllowBrowser: true // Required for browser usage
                });
            }
        } catch (error) {
            console.warn('Failed to initialize SDK clients:', error);
        }
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
                return await this.callOpenAISDK(request);
            case 'anthropic':
                return await this.callAnthropicSDK(request);
            case 'ollama':
                return await this.callOllama(request); // Keep existing implementation
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
                yield* this.streamOpenAISDK(messages, options);
                break;
            case 'anthropic':
                yield* this.streamAnthropicSDK(messages, options);
                break;
            case 'ollama':
                yield* this.streamOllama(messages, options); // Keep existing implementation
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
     * Call OpenAI using SDK
     */
    async callOpenAISDK(request) {
        if (!this.clients.openai) {
            throw new Error('OpenAI SDK client not initialized. Check API key and SDK availability.');
        }

        try {
            const messages = request.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const params = {
                model: this.model || 'gpt-4',
                messages: messages,
                temperature: request.temperature,
                max_tokens: request.maxTokens,
                stream: false
            };

            // Add tools if provided
            if (request.tools && request.tools.length > 0) {
                params.tools = request.tools;
                params.tool_choice = 'auto';
            }

            const completion = await this.clients.openai.chat.completions.create(params);
            
            return new LLMResponse(
                completion.choices[0].message.content || '',
                this.parseOpenAIToolCalls(completion.choices[0].message.tool_calls),
                completion.usage
            );
        } catch (error) {
            throw new Error(`OpenAI SDK error: ${error.message}`);
        }
    }

    /**
     * Call Anthropic using SDK
     */
    async callAnthropicSDK(request) {
        if (!this.clients.anthropic) {
            throw new Error('Anthropic SDK client not initialized. Check API key and SDK availability.');
        }

        try {
            const messages = request.messages.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));

            const params = {
                model: this.model || 'claude-3-5-sonnet-20241022',
                messages: messages,
                max_tokens: request.maxTokens,
                temperature: request.temperature
            };

            // Add tools if provided (convert to Anthropic format)
            if (request.tools && request.tools.length > 0) {
                params.tools = request.tools.map(tool => ({
                    name: tool.function.name,
                    description: tool.function.description,
                    input_schema: tool.function.parameters
                }));
            }

            const message = await this.clients.anthropic.messages.create(params);
            
            return new LLMResponse(
                this.extractAnthropicText(message.content),
                this.parseAnthropicToolCalls(message.content),
                {
                    prompt_tokens: message.usage.input_tokens || 0,
                    completion_tokens: message.usage.output_tokens || 0,
                    total_tokens: (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0)
                }
            );
        } catch (error) {
            throw new Error(`Anthropic SDK error: ${error.message}`);
        }
    }

    /**
     * Stream OpenAI response using SDK
     */
    async* streamOpenAISDK(messages, options) {
        if (!this.clients.openai) {
            throw new Error('OpenAI SDK client not initialized');
        }

        try {
            const params = {
                model: this.model || 'gpt-4',
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                temperature: options.temperature || this.defaultTemperature,
                max_tokens: options.maxTokens || this.defaultMaxTokens,
                stream: true
            };

            const stream = await this.clients.openai.chat.completions.create(params);

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                    yield delta;
                }
            }
        } catch (error) {
            throw new Error(`OpenAI streaming error: ${error.message}`);
        }
    }

    /**
     * Stream Anthropic response using SDK
     */
    async* streamAnthropicSDK(messages, options) {
        if (!this.clients.anthropic) {
            throw new Error('Anthropic SDK client not initialized');
        }

        try {
            const params = {
                model: this.model || 'claude-3-5-sonnet-20241022',
                messages: messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                })),
                max_tokens: options.maxTokens || this.defaultMaxTokens,
                temperature: options.temperature || this.defaultTemperature
            };

            const stream = this.clients.anthropic.messages.stream(params);

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.text) {
                    yield event.delta.text;
                }
            }
        } catch (error) {
            throw new Error(`Anthropic streaming error: ${error.message}`);
        }
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
     * Call Ollama API (keeping existing implementation)
     */
    async callOllama(request) {
        const baseUrl = this.baseUrl || 'http://localhost:11434';
        
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
                    num_ctx: Math.min(request.maxTokens * 2, 8192)
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
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
     * Stream Ollama response (keeping existing implementation)
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
     * Format tools for Ollama
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
     * Update configuration
     */
    updateConfig(config) {
        if (config.provider) this.provider = config.provider;
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl;
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

        // Re-initialize SDK clients with new config
        this.initializeClients();
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
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ];
    }

    /**
     * Get Anthropic models
     */
    getAnthropicModels() {
        return [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
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
     * Completion method (alias for generateWithTools)
     */
    async completion(request) {
        const tools = request.tools || [];
        const options = {
            temperature: request.temperature || this.defaultTemperature,
            maxTokens: request.maxTokens || this.defaultMaxTokens
        };

        const prompt = request.messages || request.prompt;
        
        try {
            const result = await this.generateWithTools(prompt, tools, options);
            
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

// Factory function for SDK-based client
class LLMClientFactorySDK {
    static create(provider, apiKey, options = {}) {
        const config = {
            provider,
            apiKey,
            baseUrl: options.baseUrl,
            model: options.model
        };
        return new LLMClientSDK(config);
    }

    static createFromStorage(provider) {
        const apiKey = window.CrushStorage ? window.CrushStorage.getApiKey(provider) : null;
        const config = window.CrushStorage ? window.CrushStorage.getConfig() : {};
        const llmConfig = config.llm || {};
        
        return new LLMClientSDK({
            provider,
            apiKey,
            baseUrl: llmConfig.baseUrl,
            model: llmConfig.model
        });
    }
}

// Export to global scope for backward compatibility
if (typeof window !== 'undefined') {
    window.LLMClientSDK = LLMClientSDK;
    window.LLMClientFactorySDK = LLMClientFactorySDK;
    console.log('LLMClientSDK exported to window:', !!window.LLMClientSDK);
}

// ES Module exports
export { LLMClientSDK, LLMClientFactorySDK };
export default LLMClientSDK;