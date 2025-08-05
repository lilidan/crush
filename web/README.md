# Browser Crush - AI Coding Agent

A complete browser-based implementation of the Crush coding agent functionality in JavaScript. This application provides an AI-powered coding assistant that runs entirely in your browser with no backend required.

## Features

🤖 **AI-Powered Assistance**
- Supports multiple LLM providers with **official SDK integration**
- OpenAI SDK and Anthropic SDK for improved reliability
- Intelligent code analysis and generation
- Context-aware suggestions and modifications

📁 **File Management**
- Virtual file system for browser-based projects
- GitHub repository loading and browsing
- File tree visualization with syntax highlighting
- Support for multiple programming languages

✏️ **Code Editing**
- Monaco Editor integration with syntax highlighting
- Auto-completion and IntelliSense
- Multiple file tabs and navigation
- Real-time code analysis

🔧 **Advanced Tools**
- File operations (read, write, edit, create, delete)
- Code search and symbol finding
- Project analysis and complexity metrics
- Change tracking with undo/redo functionality

💬 **Interactive Chat**
- Natural language interface for code operations
- Streaming responses for real-time interaction
- Context management for relevant code suggestions
- Tool calling for automated code modifications

## Quick Start

### Development Server (Recommended)
For full SDK functionality, use the development server:

```bash
# Install dependencies
npm install

# Start development server
./start-dev.sh
# or
npm run dev
```

### Direct Browser Access
```bash
# Simply open index.html in your browser
open index.html
# Or serve it with a local server
python -m http.server 8000
```

### Testing SDK Integration
Open `test-sdk.html` to verify SDK functionality before using the main application.

2. **Configure API Keys**
   - Click the settings button (⚙️) in the top right
   - Add your OpenAI or Anthropic API key
   - Or use Ollama for local AI models

3. **Load a Project**
   - Click "Try Demo Project" to load a sample React app
   - Or click "Load from GitHub" to import a repository
   - Use format: `https://github.com/username/repository`

4. **Start Coding**
   - Browse files in the left sidebar
   - Edit code in the Monaco editor
   - Chat with the AI assistant for help

## Demo Project

The application includes a complete React Todo App as a demo project featuring:
- TypeScript components
- Modern React hooks
- Local storage persistence
- Responsive CSS design
- Complete project structure

### Example Commands

Try these commands with the demo project:

**Code Analysis:**
- "Analyze the code structure and tell me what this project does"
- "Find all React components and their relationships"
- "Look for potential bugs or improvements"

**Feature Enhancement:**
- "Add a priority field to todos (high, medium, low)"
- "Implement drag and drop reordering"
- "Add a dark mode toggle"

**Refactoring:**
- "Extract localStorage logic into a custom hook"
- "Convert the app to use React Context"
- "Add proper error handling"

**Testing:**
- "Write unit tests for the Todo components"
- "Create integration tests"
- "Add accessibility tests"

## Architecture

### Core Components

1. **CodingAgent** (`js/core/coding-agent.js`)
   - Main orchestrator class
   - Manages all subsystems
   - Handles user interactions

2. **VirtualFileSystem** (`js/core/file-system.js`)
   - Browser-based file management
   - GitHub API integration
   - File indexing and search

3. **LLM System** (`js/llm/`)
   - **SDK-based clients** with official OpenAI and Anthropic SDKs
   - Automatic fallback to direct API calls
   - Multi-provider support with optimized performance
   - Streaming response support and tool calling capabilities

4. **ToolRegistry** (`js/tools/`)
   - Extensible tool system
   - File operations and search tools
   - Code analysis capabilities

5. **ContextManager** (`js/core/context-manager.js`)
   - Intelligent context gathering
   - Relevance scoring
   - Token limit management

### File Structure

```
web/
├── index.html              # Main HTML file
├── css/
│   └── styles.css         # Application styles
├── js/
│   ├── core/              # Core system classes
│   │   ├── types.js       # Type definitions
│   │   ├── utils.js       # Utility functions
│   │   ├── storage.js     # Browser storage
│   │   ├── file-system.js # Virtual file system
│   │   ├── context-manager.js # Context management
│   │   ├── change-tracker.js  # Change tracking
│   │   ├── prompts.js     # Optimized prompt system
│   │   └── coding-agent.js    # Main agent class
│   ├── llm/               # LLM integration
│   │   ├── llm-client.js      # Original client (fallback)
│   │   ├── llm-client-sdk.js  # SDK-based client
│   │   └── sdk-loader.js      # SDK loading and management
│   ├── tools/             # Tool system
│   │   ├── base-tool.js   # Base tool class
│   │   ├── file-tools.js  # File operations
│   │   └── search-tools.js # Search and analysis
│   ├── ui/                # User interface
│   │   └── coding-agent-ui.js # UI components
│   ├── demo/              # Demo data
│   │   └── demo-data.js   # Sample project
│   └── app.js             # Application bootstrap
├── test-sdk.html          # SDK testing interface
├── package.json           # Dependencies and build scripts
├── vite.config.js         # Vite development configuration
├── start-dev.sh           # Development server script
└── README.md              # This file
```

## SDK Architecture

### New Features

The latest version includes official SDK integration for improved reliability and performance:

#### OpenAI SDK Integration
- **Direct SDK calls** instead of fetch-based API requests
- **Better error handling** and automatic retries
- **Streaming support** with proper event handling
- **Tool calling** fully compatible with latest OpenAI API

#### Anthropic SDK Integration
- **Official Anthropic SDK** for Claude models
- **Streaming responses** with proper event parsing
- **Tool calling** support for Claude 3.5 and 3.0 models
- **Better rate limit handling**

#### Automatic Fallback
- **Graceful degradation** to original API clients if SDKs fail
- **Seamless user experience** with no manual intervention required
- **Error logging** for troubleshooting SDK issues

#### Performance Improvements
- **Reduced latency** through optimized SDK connections
- **Better connection management** and pooling
- **Improved streaming** with proper chunk handling

### Migration from API Calls

The application automatically detects and prefers SDK-based clients:

1. **Automatic Detection**: On startup, the app attempts to load official SDKs
2. **Transparent Switching**: Users see no difference in interface or functionality
3. **Fallback Protection**: If SDKs fail, the app uses original API-based clients
4. **No Configuration Changes**: Existing API keys and settings work unchanged

## API Keys Setup

### OpenAI
1. Get an API key from [OpenAI Platform](https://platform.openai.com/)
2. Add it in Settings → OpenAI API Key
3. Select GPT-4 or GPT-3.5-turbo as the model

### Anthropic
1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Add it in Settings → Anthropic API Key
3. Select Claude 3 Sonnet or Haiku as the model

### Ollama (Local)
1. Install [Ollama](https://ollama.ai/) locally
2. Start Ollama: `ollama serve`
3. Pull a model: `ollama pull codellama`
4. Set Ollama URL to `http://localhost:11434`

## Browser Compatibility

- **Chrome/Edge**: Full support with all features
- **Firefox**: Full support with all features
- **Safari**: Full support with some minor UI differences

## Limitations

- **File Size**: Large repositories may take time to load
- **Browser Storage**: Limited by browser storage quotas
- **API Limits**: Subject to LLM provider rate limits
- **CORS**: GitHub API has rate limits for unauthenticated requests

## Security

- API keys are stored locally in encrypted browser storage
- No data is sent to external servers except LLM providers
- All processing happens client-side in the browser
- No server-side storage or logging

## Development

### Adding New Tools

1. Create a new tool class extending `BaseTool`
2. Implement the `execute` method
3. Register the tool in the `CodingAgent` constructor

```javascript
class MyCustomTool extends BaseTool {
    constructor() {
        super();
        this.name = 'my_tool';
        this.description = 'My custom tool';
        this.parameters = [
            new ToolParameter('input', 'string', 'Tool input', true)
        ];
    }

    async execute(args) {
        // Tool implementation
        return `Result: ${args.input}`;
    }
}

// Register in CodingAgent
this.toolRegistry.register(new MyCustomTool(), 'custom');
```

### Adding New LLM Providers

1. Extend the `LLMClient` class
2. Add provider-specific configuration
3. Implement the API integration

### Customizing the UI

1. Modify `css/styles.css` for styling changes
2. Update `js/ui/coding-agent-ui.js` for UI behavior
3. Add new modal dialogs in `index.html`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in multiple browsers
5. Submit a pull request

## License

This project is based on the original Crush codebase and follows the same licensing terms. The browser implementation is designed for educational and development purposes.

## Troubleshooting

### Common Issues

**Monaco Editor not loading:**
- Check browser console for CDN errors
- Try refreshing the page
- Ensure internet connection is stable

**API key not working:**
- Verify the key is correct and has sufficient credits
- Check if the key has the required permissions
- Try a different model if available

**File loading errors:**
- Check if the GitHub repository is public
- Verify the repository URL format
- Try with a smaller repository first

**Chat not responding:**
- Ensure API key is configured
- Check browser network tab for errors
- Verify the selected model is available

### Getting Help

1. Check browser developer console for errors
2. Review the network tab for API call failures
3. Try the demo project to isolate issues
4. Reset settings if problems persist

For additional support, refer to the original Crush documentation or create an issue in the repository.