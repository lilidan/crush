/**
 * Base Tool class and tool system for Browser Crush
 */

class BaseTool {
    constructor() {
        this.name = '';
        this.description = '';
        this.parameters = [];
    }

    /**
     * Get tool definition for LLM
     */
    getDefinition() {
        const properties = {};
        const required = [];

        this.parameters.forEach(param => {
            properties[param.name] = {
                type: param.type,
                description: param.description
            };

            if (param.enum) {
                properties[param.name].enum = param.enum;
            }

            if (param.required) {
                required.push(param.name);
            }
        });

        return new ToolDefinition('function', {
            name: this.name,
            description: this.description,
            parameters: {
                type: 'object',
                properties: properties,
                required: required
            }
        });
    }

    /**
     * Execute the tool - must be implemented by subclasses
     */
    async execute(args) {
        throw new Error('execute method must be implemented by subclass');
    }

    /**
     * Validate arguments
     */
    validateArgs(args) {
        const errors = [];

        this.parameters.forEach(param => {
            if (param.required && !(param.name in args)) {
                errors.push(`Required parameter '${param.name}' is missing`);
            }

            if (param.name in args) {
                const value = args[param.name];
                
                // Type validation
                switch (param.type) {
                    case 'string':
                        if (typeof value !== 'string') {
                            errors.push(`Parameter '${param.name}' must be a string`);
                        }
                        break;
                    case 'number':
                        if (typeof value !== 'number') {
                            errors.push(`Parameter '${param.name}' must be a number`);
                        }
                        break;
                    case 'boolean':
                        if (typeof value !== 'boolean') {
                            errors.push(`Parameter '${param.name}' must be a boolean`);
                        }
                        break;
                    case 'array':
                        if (!Array.isArray(value)) {
                            errors.push(`Parameter '${param.name}' must be an array`);
                        }
                        break;
                    case 'object':
                        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                            errors.push(`Parameter '${param.name}' must be an object`);
                        }
                        break;
                }

                // Enum validation
                if (param.enum && !param.enum.includes(value)) {
                    errors.push(`Parameter '${param.name}' must be one of: ${param.enum.join(', ')}`);
                }
            }
        });

        return errors;
    }

    /**
     * Format tool result
     */
    formatResult(result, success = true, error = null) {
        return new ToolResult(success, result, error);
    }

    /**
     * Format error result
     */
    formatError(error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new ToolResult(false, null, errorMessage);
    }
}

/**
 * Tool Registry - manages all available tools
 */
class ToolRegistry {
    constructor() {
        this.tools = new Map();
        this.categories = new Map();
    }

    /**
     * Register a tool
     */
    register(tool, category = 'general') {
        if (!(tool instanceof BaseTool)) {
            throw new Error('Tool must extend BaseTool class');
        }

        this.tools.set(tool.name, tool);
        
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(tool.name);

        Utils.log(`Registered tool: ${tool.name} (category: ${category})`);
    }

    /**
     * Get tool by name
     */
    get(name) {
        return this.tools.get(name);
    }

    /**
     * Get all tools
     */
    getAll() {
        return Array.from(this.tools.values());
    }

    /**
     * Get tools by category
     */
    getByCategory(category) {
        const toolNames = this.categories.get(category) || [];
        return toolNames.map(name => this.tools.get(name)).filter(Boolean);
    }

    /**
     * Execute a tool
     */
    async execute(toolCall) {
        const tool = this.get(toolCall.name);
        if (!tool) {
            return new ToolResult(false, null, `Unknown tool: ${toolCall.name}`);
        }

        try {
            // Validate arguments
            const validationErrors = tool.validateArgs(toolCall.arguments);
            if (validationErrors.length > 0) {
                return tool.formatError(`Validation errors: ${validationErrors.join(', ')}`);
            }

            // Execute tool
            const result = await tool.execute(toolCall.arguments);
            return tool.formatResult(result);

        } catch (error) {
            Utils.error(`Tool execution failed: ${toolCall.name}`, error);
            return tool.formatError(error);
        }
    }

    /**
     * Get tool definitions for LLM
     */
    getDefinitions() {
        return this.getAll().map(tool => tool.getDefinition());
    }

    /**
     * List available tools
     */
    list() {
        const toolList = [];
        
        for (const [category, toolNames] of this.categories) {
            const tools = toolNames.map(name => {
                const tool = this.tools.get(name);
                return {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters.map(p => ({
                        name: p.name,
                        type: p.type,
                        required: p.required,
                        description: p.description
                    }))
                };
            });

            toolList.push({
                category,
                tools
            });
        }

        return toolList;
    }

    /**
     * Remove tool
     */
    unregister(name) {
        const tool = this.tools.get(name);
        if (tool) {
            this.tools.delete(name);
            
            // Remove from categories
            for (const [category, toolNames] of this.categories) {
                const index = toolNames.indexOf(name);
                if (index !== -1) {
                    toolNames.splice(index, 1);
                    if (toolNames.length === 0) {
                        this.categories.delete(category);
                    }
                }
            }
        }
    }

    /**
     * Clear all tools
     */
    clear() {
        this.tools.clear();
        this.categories.clear();
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalTools: this.tools.size,
            categories: this.categories.size,
            toolsByCategory: Object.fromEntries(
                Array.from(this.categories.entries()).map(([cat, tools]) => [cat, tools.length])
            )
        };
    }
}

// Create global tool registry instance
const toolRegistry = new ToolRegistry();

// Export to global scope
if (typeof window !== 'undefined') {
    window.BaseTool = BaseTool;
    window.ToolRegistry = ToolRegistry;
    window.toolRegistry = toolRegistry;
}