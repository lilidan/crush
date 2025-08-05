/**
 * Demo data and examples for Browser Crush
 */

class DemoData {
    static getSampleProject() {
        return {
            name: 'React Todo App',
            description: 'A simple React-based todo application with TypeScript',
            files: {
                'package.json': {
                    content: JSON.stringify({
                        "name": "react-todo-app",
                        "version": "1.0.0",
                        "description": "A simple React todo application",
                        "main": "src/index.tsx",
                        "scripts": {
                            "start": "react-scripts start",
                            "build": "react-scripts build",
                            "test": "react-scripts test",
                            "eject": "react-scripts eject"
                        },
                        "dependencies": {
                            "react": "^18.2.0",
                            "react-dom": "^18.2.0",
                            "typescript": "^4.9.5"
                        },
                        "devDependencies": {
                            "@types/react": "^18.0.28",
                            "@types/react-dom": "^18.0.11",
                            "react-scripts": "5.0.1"
                        },
                        "browserslist": {
                            "production": [
                                ">0.2%",
                                "not dead",
                                "not op_mini all"
                            ],
                            "development": [
                                "last 1 chrome version",
                                "last 1 firefox version",
                                "last 1 safari version"
                            ]
                        }
                    }, null, 2),
                    type: 'file',
                    size: 1024,
                    lastModified: new Date()
                },
                'src/index.tsx': {
                    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
                    type: 'file',
                    size: 256,
                    lastModified: new Date()
                },
                'src/App.tsx': {
                    content: `import React, { useState, useEffect } from 'react';
import './App.css';
import TodoList from './components/TodoList';
import TodoForm from './components/TodoForm';
import { Todo } from './types/Todo';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = (text: string) => {
    const newTodo: Todo = {
      id: Date.now(),
      text,
      completed: false,
      createdAt: new Date()
    };
    setTodos([...todos, newTodo]);
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos(todos.filter(todo => !todo.completed));
  };

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active':
        return !todo.completed;
      case 'completed':
        return todo.completed;
      default:
        return true;
    }
  });

  const activeTodoCount = todos.filter(todo => !todo.completed).length;
  const completedTodoCount = todos.filter(todo => todo.completed).length;

  return (
    <div className="App">
      <header className="App-header">
        <h1>Todo App</h1>
        <TodoForm onSubmit={addTodo} />
        
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All ({todos.length})
          </button>
          <button 
            className={filter === 'active' ? 'active' : ''} 
            onClick={() => setFilter('active')}
          >
            Active ({activeTodoCount})
          </button>
          <button 
            className={filter === 'completed' ? 'active' : ''} 
            onClick={() => setFilter('completed')}
          >
            Completed ({completedTodoCount})
          </button>
        </div>

        <TodoList 
          todos={filteredTodos} 
          onToggle={toggleTodo} 
          onDelete={deleteTodo} 
        />

        {completedTodoCount > 0 && (
          <button className="clear-completed" onClick={clearCompleted}>
            Clear Completed
          </button>
        )}
      </header>
    </div>
  );
}

export default App;`,
                    type: 'file',
                    size: 2048,
                    lastModified: new Date()
                },
                'src/components/TodoList.tsx': {
                    content: `import React from 'react';
import TodoItem from './TodoItem';
import { Todo } from '../types/Todo';

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

const TodoList: React.FC<TodoListProps> = ({ todos, onToggle, onDelete }) => {
  if (todos.length === 0) {
    return (
      <div className="todo-list-empty">
        <p>No todos yet. Add one above!</p>
      </div>
    );
  }

  return (
    <div className="todo-list">
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default TodoList;`,
                    type: 'file',
                    size: 512,
                    lastModified: new Date()
                },
                'src/components/TodoItem.tsx': {
                    content: `import React from 'react';
import { Todo } from '../types/Todo';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  return (
    <div className={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        className="todo-checkbox"
      />
      <span className="todo-text">{todo.text}</span>
      <span className="todo-date">
        {todo.createdAt.toLocaleDateString()}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="todo-delete"
        aria-label="Delete todo"
      >
        ×
      </button>
    </div>
  );
};

export default TodoItem;`,
                    type: 'file',
                    size: 768,
                    lastModified: new Date()
                },
                'src/components/TodoForm.tsx': {
                    content: `import React, { useState } from 'react';

interface TodoFormProps {
  onSubmit: (text: string) => void;
}

const TodoForm: React.FC<TodoFormProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedText = text.trim();
    if (trimmedText) {
      onSubmit(trimmedText);
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="todo-form">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        className="todo-input"
        autoFocus
      />
      <button type="submit" className="todo-submit">
        Add Todo
      </button>
    </form>
  );
};

export default TodoForm;`,
                    type: 'file',
                    size: 512,
                    lastModified: new Date()
                },
                'src/types/Todo.ts': {
                    content: `export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

export interface TodoFilter {
  type: 'all' | 'active' | 'completed';
  label: string;
}`,
                    type: 'file',
                    size: 128,
                    lastModified: new Date()
                },
                'src/App.css': {
                    content: `.App {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.App-header {
  background-color: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h1 {
  color: #333;
  margin-bottom: 2rem;
}

.todo-form {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.todo-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.todo-input:focus {
  outline: none;
  border-color: #007bff;
}

.todo-submit {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.todo-submit:hover {
  background: #0056b3;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  justify-content: center;
}

.filter-buttons button {
  padding: 0.5rem 1rem;
  border: 2px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.filter-buttons button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.todo-list {
  margin-bottom: 2rem;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  background: white;
}

.todo-item.completed {
  opacity: 0.6;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
}

.todo-checkbox {
  width: 1.2rem;
  height: 1.2rem;
}

.todo-text {
  flex: 1;
  text-align: left;
}

.todo-date {
  font-size: 0.875rem;
  color: #666;
}

.todo-delete {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}

.todo-delete:hover {
  background: #c82333;
}

.todo-list-empty {
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.clear-completed {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.clear-completed:hover {
  background: #5a6268;
}`,
                    type: 'file',
                    size: 2048,
                    lastModified: new Date()
                },
                'src/index.css': {
                    content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

* {
  box-sizing: border-box;
}`,
                    type: 'file',
                    size: 256,
                    lastModified: new Date()
                },
                'public/index.html': {
                    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="A simple React todo application"
    />
    <title>React Todo App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`,
                    type: 'file',
                    size: 512,
                    lastModified: new Date()
                },
                'README.md': {
                    content: `# React Todo App

A simple, elegant todo application built with React and TypeScript.

## Features

- ✅ Add new todos
- ✅ Mark todos as complete/incomplete
- ✅ Filter todos by status (All, Active, Completed)
- ✅ Delete individual todos
- ✅ Clear all completed todos
- ✅ Persistent storage with localStorage
- ✅ Responsive design
- ✅ TypeScript support

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm start
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Project Structure

\`\`\`
src/
├── components/
│   ├── TodoForm.tsx      # Form to add new todos
│   ├── TodoItem.tsx      # Individual todo item
│   └── TodoList.tsx      # List of todos
├── types/
│   └── Todo.ts           # TypeScript interfaces
├── App.tsx               # Main application component
├── App.css               # Application styles
├── index.tsx             # Application entry point
└── index.css             # Global styles
\`\`\`

## Available Scripts

- \`npm start\` - Runs the app in development mode
- \`npm test\` - Launches the test runner
- \`npm run build\` - Builds the app for production
- \`npm run eject\` - Ejects from Create React App

## Technologies Used

- React 18
- TypeScript
- CSS3
- Create React App

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - feel free to use this project for learning or as a starting point for your own applications.`,
                    type: 'file',
                    size: 1536,
                    lastModified: new Date()
                }
            }
        };
    }

    static getSamplePrompts() {
        return [
            {
                category: 'Analysis',
                prompts: [
                    'Analyze the code structure and tell me what this project does',
                    'Find all the React components and their relationships',
                    'Look for any potential bugs or improvements in the Todo app',
                    'Show me the data flow in this React application'
                ]
            },
            {
                category: 'Enhancement',
                prompts: [
                    'Add a priority field to todos (high, medium, low)',
                    'Implement drag and drop reordering for todos',
                    'Add a due date feature to todos',
                    'Create a dark mode toggle for the app'
                ]
            },
            {
                category: 'Refactoring',
                prompts: [
                    'Extract the localStorage logic into a custom hook',
                    'Convert the app to use React Context for state management',
                    'Split the large App component into smaller components',
                    'Add proper error handling for localStorage operations'
                ]
            },
            {
                category: 'Testing',
                prompts: [
                    'Write unit tests for the Todo components',
                    'Create integration tests for the todo functionality',
                    'Add accessibility tests for the todo app',
                    'Write tests for the localStorage functionality'
                ]
            },
            {
                category: 'Documentation',
                prompts: [
                    'Add JSDoc comments to all components and functions',
                    'Create a detailed API documentation for the components',
                    'Write a deployment guide for this application',
                    'Document the component props and their types'
                ]
            }
        ];
    }

    static getExampleConversations() {
        return [
            {
                title: 'Code Analysis',
                messages: [
                    {
                        role: 'user',
                        content: 'Can you analyze this React todo app and tell me what it does?'
                    },
                    {
                        role: 'assistant',
                        content: `I've analyzed your React Todo App. Here's what it does:

## Overview
This is a well-structured React application built with TypeScript that implements a classic todo/task management system.

## Key Features
- **Add Todos**: Users can add new tasks through a form
- **Toggle Completion**: Mark tasks as completed/incomplete with checkboxes
- **Filter Todos**: View all, active, or completed todos
- **Delete Todos**: Remove individual tasks
- **Clear Completed**: Bulk delete all completed tasks
- **Persistent Storage**: Uses localStorage to save todos between sessions

## Architecture
The app follows React best practices with:
- **Component Composition**: Breaks down into focused components (TodoForm, TodoList, TodoItem)
- **TypeScript Integration**: Proper type definitions in \`types/Todo.ts\`
- **State Management**: Uses React hooks (useState, useEffect)
- **Local Storage**: Automatic persistence of todo data

## File Structure
- \`App.tsx\` - Main component with state management
- \`components/\` - Reusable UI components
- \`types/\` - TypeScript type definitions
- Styling with CSS modules

The code is clean, well-organized, and follows modern React patterns. Would you like me to suggest any improvements or help you add new features?`
                    }
                ]
            },
            {
                title: 'Adding Features',
                messages: [
                    {
                        role: 'user',
                        content: 'I want to add a priority field to each todo item. Can you help me implement this?'
                    },
                    {
                        role: 'assistant',
                        content: `I'll help you add a priority field to your todo items. This involves updating the Todo type, modifying components, and adding UI controls.

Let me implement this step by step:

1. First, I'll update the Todo type definition
2. Modify the TodoForm to include priority selection
3. Update TodoItem to display priority
4. Enhance the App component to handle priority
5. Add CSS styling for priority indicators

Let me start with the type definition:`
                    }
                ]
            }
        ];
    }

    /**
     * Load demo project into the file system
     */
    static async loadDemoProject(fileSystem) {
        const demo = this.getSampleProject();
        
        for (const [filePath, fileData] of Object.entries(demo.files)) {
            await fileSystem.addFile(filePath, fileData.content, fileData.type);
        }
        
        return {
            name: demo.name,
            description: demo.description,
            fileCount: Object.keys(demo.files).length
        };
    }

    /**
     * Get demo configuration
     */
    static getDemoConfig() {
        return {
            llm: {
                defaultProvider: 'openai',
                defaultModel: 'gpt-4',
                providers: {
                    openai: {
                        apiKey: '' // User needs to provide this
                    },
                    anthropic: {
                        apiKey: '' // User needs to provide this
                    },
                    ollama: {
                        baseUrl: 'http://localhost:11434'
                    }
                }
            },
            context: {
                maxContextTokens: 8000,
                avgCharsPerToken: 4
            },
            editor: {
                theme: 'github-dark',
                fontSize: 14,
                wordWrap: true,
                minimap: false
            }
        };
    }

    /**
     * Show demo tutorial
     */
    static showTutorial() {
        const steps = [
            {
                title: 'Welcome to Browser Crush!',
                content: 'This is your AI-powered coding assistant that runs entirely in your browser.',
                element: '.app-container'
            },
            {
                title: 'Load a Repository',
                content: 'Click here to load a GitHub repository or use our demo project.',
                element: '#repo-button'
            },
            {
                title: 'File Explorer',
                content: 'Browse your project files here. Click on any file to open it in the editor.',
                element: '#file-tree'
            },
            {
                title: 'Code Editor',
                content: 'Edit your code with syntax highlighting and auto-completion.',
                element: '#editor-container'
            },
            {
                title: 'AI Chat',
                content: 'Ask me anything about your code! I can analyze, refactor, add features, and more.',
                element: '#chat-container'
            },
            {
                title: 'Settings',
                content: 'Configure your API keys and preferences here.',
                element: '#settings-button'
            }
        ];

        // Simple tutorial implementation
        let currentStep = 0;
        
        const showStep = (step) => {
            const tutorial = document.createElement('div');
            tutorial.className = 'tutorial-overlay';
            tutorial.innerHTML = `
                <div class="tutorial-content">
                    <h3>${step.title}</h3>
                    <p>${step.content}</p>
                    <div class="tutorial-buttons">
                        <button onclick="this.closest('.tutorial-overlay').remove()">Skip</button>
                        <button onclick="nextTutorialStep()">
                            ${currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(tutorial);
            
            // Highlight target element
            const target = document.querySelector(step.element);
            if (target) {
                target.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.8)';
                setTimeout(() => {
                    target.style.boxShadow = '';
                }, 3000);
            }
        };

        window.nextTutorialStep = () => {
            document.querySelector('.tutorial-overlay')?.remove();
            currentStep++;
            if (currentStep < steps.length) {
                setTimeout(() => showStep(steps[currentStep]), 500);
            }
        };

        showStep(steps[0]);
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.DemoData = DemoData;
}