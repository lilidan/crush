/**
 * File operation tools for Browser Crush
 */

/**
 * Read File Tool
 */
class ReadFileTool extends BaseTool {
    constructor(fileSystem) {
        super();
        this.name = 'read_file';
        this.description = 'Read the contents of a file';
        this.parameters = [
            new ToolParameter('file_path', 'string', 'Path to the file to read', true),
            new ToolParameter('start_line', 'number', 'Starting line number (1-based, optional)', false),
            new ToolParameter('end_line', 'number', 'Ending line number (1-based, optional)', false)
        ];
        this.fileSystem = fileSystem;
    }

    async execute(args) {
        const { file_path, start_line, end_line } = args;
        
        try {
            const file = await this.fileSystem.getFile(file_path);
            if (!file) {
                throw new Error(`File not found: ${file_path}`);
            }

            if (file.type === 'directory') {
                throw new Error(`Path is a directory, not a file: ${file_path}`);
            }

            let content = file.content;
            let lineNumbers = '';

            // Handle line range if specified
            if (start_line !== undefined || end_line !== undefined) {
                const lines = content.split('\n');
                const startIdx = Math.max(0, (start_line || 1) - 1);
                const endIdx = Math.min(lines.length, end_line || lines.length);
                
                const selectedLines = lines.slice(startIdx, endIdx);
                content = selectedLines.join('\n');
                
                // Add line numbers
                lineNumbers = selectedLines.map((line, idx) => 
                    `${startIdx + idx + 1}: ${line}`
                ).join('\n');
            } else {
                // Add line numbers for entire file
                const lines = content.split('\n');
                lineNumbers = lines.map((line, idx) => 
                    `${idx + 1}: ${line}`
                ).join('\n');
            }

            // Add file to recent files
            if (window.CrushStorage) {
                window.CrushStorage.addRecentFile(file_path);
            }

            const result = `## File: ${file_path}\n\n\`\`\`\n${lineNumbers}\n\`\`\`\n\n**File size:** ${Utils.formatFileSize(file.size)}\n**Last modified:** ${Utils.formatDate(file.lastModified)}`;
            
            return result;

        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }
}

/**
 * Write File Tool
 */
class WriteFileTool extends BaseTool {
    constructor(fileSystem, changeTracker) {
        super();
        this.name = 'write_file';
        this.description = 'Create a new file or overwrite an existing file with content';
        this.parameters = [
            new ToolParameter('file_path', 'string', 'Path to the file to write', true),
            new ToolParameter('content', 'string', 'Content to write to the file', true)
        ];
        this.fileSystem = fileSystem;
        this.changeTracker = changeTracker;
    }

    async execute(args) {
        const { file_path, content } = args;
        
        try {
            // Check if file already exists
            const existingFile = await this.fileSystem.getFile(file_path);
            const oldContent = existingFile ? existingFile.content : null;

            // Create or update the file
            const file = await this.fileSystem.updateFile(file_path, content);

            // Record the change
            const changeType = existingFile ? 'edit' : 'create';
            this.changeTracker.recordChange(new Change(changeType, file_path, oldContent, content));

            // Add to recent files
            if (window.CrushStorage) {
                window.CrushStorage.addRecentFile(file_path);
            }

            const action = existingFile ? 'Updated' : 'Created';
            return `${action} file: ${file_path}\n\n**Size:** ${Utils.formatFileSize(file.size)}\n**Lines:** ${content.split('\n').length}`;

        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }
}

/**
 * Edit File Tool
 */
class EditFileTool extends BaseTool {
    constructor(fileSystem, changeTracker) {
        super();
        this.name = 'edit_file';
        this.description = 'Edit a file by replacing specific content with new content';
        this.parameters = [
            new ToolParameter('file_path', 'string', 'Path to the file to edit', true),
            new ToolParameter('old_content', 'string', 'Content to replace (must match exactly)', true),
            new ToolParameter('new_content', 'string', 'New content to replace with', true),
            new ToolParameter('replace_all', 'boolean', 'Replace all occurrences (default: false)', false)
        ];
        this.fileSystem = fileSystem;
        this.changeTracker = changeTracker;
    }

    async execute(args) {
        const { file_path, old_content, new_content, replace_all = false } = args;
        
        try {
            const file = await this.fileSystem.getFile(file_path);
            if (!file) {
                throw new Error(`File not found: ${file_path}`);
            }

            if (file.type === 'directory') {
                throw new Error(`Path is a directory, not a file: ${file_path}`);
            }

            const originalContent = file.content;

            // Check if old content exists
            if (!originalContent.includes(old_content)) {
                throw new Error(`Content not found in file. Make sure the content matches exactly, including whitespace and line breaks.`);
            }

            // Count occurrences
            const occurrences = (originalContent.match(new RegExp(this.escapeRegex(old_content), 'g')) || []).length;
            
            if (!replace_all && occurrences > 1) {
                throw new Error(`Content appears ${occurrences} times in the file. Use replace_all: true to replace all occurrences, or provide more specific content to match only one occurrence.`);
            }

            // Perform replacement
            let newFileContent;
            if (replace_all) {
                newFileContent = originalContent.replace(new RegExp(this.escapeRegex(old_content), 'g'), new_content);
            } else {
                newFileContent = originalContent.replace(old_content, new_content);
            }

            // Update the file
            await this.fileSystem.updateFile(file_path, newFileContent);

            // Record the change
            this.changeTracker.recordChange(new Change('edit', file_path, originalContent, newFileContent));

            // Add to recent files
            if (window.CrushStorage) {
                window.CrushStorage.addRecentFile(file_path);
            }

            const replacedCount = replace_all ? occurrences : 1;
            return `Successfully edited file: ${file_path}\n\n**Replacements made:** ${replacedCount}\n**Old content:** ${old_content.substring(0, 100)}${old_content.length > 100 ? '...' : ''}\n**New content:** ${new_content.substring(0, 100)}${new_content.length > 100 ? '...' : ''}`;

        } catch (error) {
            throw new Error(`Failed to edit file: ${error.message}`);
        }
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

/**
 * Create File Tool
 */
class CreateFileTool extends BaseTool {
    constructor(fileSystem, changeTracker) {
        super();
        this.name = 'create_file';
        this.description = 'Create a new file with specified content';
        this.parameters = [
            new ToolParameter('file_path', 'string', 'Path for the new file', true),
            new ToolParameter('content', 'string', 'Initial content for the file', false),
            new ToolParameter('file_type', 'string', 'Type of file to create', false, ['text', 'code', 'config', 'markdown'])
        ];
        this.fileSystem = fileSystem;
        this.changeTracker = changeTracker;
    }

    async execute(args) {
        const { file_path, content = '', file_type = 'text' } = args;
        
        try {
            // Check if file already exists
            const existingFile = await this.fileSystem.getFile(file_path);
            if (existingFile) {
                throw new Error(`File already exists: ${file_path}. Use write_file or edit_file to modify existing files.`);
            }

            // Add template content based on file type
            let finalContent = content;
            if (!content && file_type) {
                finalContent = this.getTemplateContent(file_path, file_type);
            }

            // Create the file
            const file = await this.fileSystem.addFile(file_path, finalContent, 'file');

            // Record the change
            this.changeTracker.recordChange(new Change('create', file_path, null, finalContent));

            // Add to recent files
            if (window.CrushStorage) {
                window.CrushStorage.addRecentFile(file_path);
            }

            return `Created new file: ${file_path}\n\n**Type:** ${file_type}\n**Size:** ${Utils.formatFileSize(file.size)}\n**Lines:** ${finalContent.split('\n').length}`;

        } catch (error) {
            throw new Error(`Failed to create file: ${error.message}`);
        }
    }

    getTemplateContent(filePath, fileType) {
        const extension = Utils.getFileExtension(filePath);
        const fileName = Utils.getFileName(filePath);

        switch (fileType) {
            case 'code':
                return this.getCodeTemplate(extension, fileName);
            case 'config':
                return this.getConfigTemplate(extension);
            case 'markdown':
                return this.getMarkdownTemplate(fileName);
            default:
                return '';
        }
    }

    getCodeTemplate(extension, fileName) {
        switch (extension) {
            case 'js':
                return `/**\n * ${fileName}\n */\n\n// TODO: Implement functionality\n`;
            case 'ts':
                return `/**\n * ${fileName}\n */\n\n// TODO: Implement functionality\nexport {};\n`;
            case 'py':
                return `#!/usr/bin/env python3\n"""\n${fileName}\n"""\n\n# TODO: Implement functionality\n`;
            case 'java':
                const className = fileName.replace(/\.[^.]*$/, '');
                return `public class ${className} {\n    // TODO: Implement functionality\n}\n`;
            case 'cpp':
                return `#include <iostream>\n\nint main() {\n    // TODO: Implement functionality\n    return 0;\n}\n`;
            case 'html':
                return `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n    <!-- TODO: Add content -->\n</body>\n</html>\n`;
            case 'css':
                return `/* ${fileName} */\n\n/* TODO: Add styles */\n`;
            default:
                return `// ${fileName}\n\n// TODO: Implement functionality\n`;
        }
    }

    getConfigTemplate(extension) {
        switch (extension) {
            case 'json':
                return '{\n    "name": "project",\n    "version": "1.0.0"\n}\n';
            case 'yaml':
            case 'yml':
                return 'name: project\nversion: 1.0.0\n';
            case 'toml':
                return '[project]\nname = "project"\nversion = "1.0.0"\n';
            case 'ini':
                return '[DEFAULT]\nname = project\nversion = 1.0.0\n';
            default:
                return '# Configuration file\n';
        }
    }

    getMarkdownTemplate(fileName) {
        const title = fileName.replace(/\.[^.]*$/, '').replace(/[-_]/g, ' ');
        return `# ${title}\n\n## Overview\n\nTODO: Add description\n\n## Usage\n\nTODO: Add usage instructions\n`;
    }
}

/**
 * Delete File Tool
 */
class DeleteFileTool extends BaseTool {
    constructor(fileSystem, changeTracker) {
        super();
        this.name = 'delete_file';
        this.description = 'Delete a file from the filesystem';
        this.parameters = [
            new ToolParameter('file_path', 'string', 'Path to the file to delete', true),
            new ToolParameter('confirm', 'boolean', 'Confirm deletion (required for safety)', true)
        ];
        this.fileSystem = fileSystem;
        this.changeTracker = changeTracker;
    }

    async execute(args) {
        const { file_path, confirm } = args;
        
        if (!confirm) {
            throw new Error('Deletion must be confirmed by setting confirm: true');
        }

        try {
            const file = await this.fileSystem.getFile(file_path);
            if (!file) {
                throw new Error(`File not found: ${file_path}`);
            }

            if (file.type === 'directory') {
                throw new Error(`Cannot delete directory with this tool: ${file_path}`);
            }

            const oldContent = file.content;
            
            // Delete the file
            const deleted = this.fileSystem.deleteFile(file_path);
            if (!deleted) {
                throw new Error(`Failed to delete file: ${file_path}`);
            }

            // Record the change
            this.changeTracker.recordChange(new Change('delete', file_path, oldContent, null));

            return `Deleted file: ${file_path}`;

        } catch (error) {
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }
}

/**
 * List Files Tool
 */
class ListFilesTool extends BaseTool {
    constructor(fileSystem) {
        super();
        this.name = 'list_files';
        this.description = 'List files and directories in the project';
        this.parameters = [
            new ToolParameter('directory', 'string', 'Directory path to list (optional, defaults to root)', false),
            new ToolParameter('show_hidden', 'boolean', 'Include hidden files (default: false)', false),
            new ToolParameter('file_types', 'array', 'Filter by file extensions (optional)', false)
        ];
        this.fileSystem = fileSystem;
    }

    async execute(args) {
        const { directory = '', show_hidden = false, file_types = [] } = args;
        
        try {
            const files = await this.fileSystem.listFiles(directory);
            
            // Filter files
            let filteredFiles = files;
            
            if (!show_hidden) {
                filteredFiles = filteredFiles.filter(file => 
                    !Utils.getFileName(file.path).startsWith('.')
                );
            }

            if (file_types.length > 0) {
                filteredFiles = filteredFiles.filter(file => {
                    if (file.type === 'directory') return true;
                    const extension = Utils.getFileExtension(file.path);
                    return file_types.includes(extension);
                });
            }

            // Group by type
            const directories = filteredFiles.filter(f => f.type === 'directory');
            const regularFiles = filteredFiles.filter(f => f.type === 'file');

            let result = `## Files in ${directory || 'project root'}\n\n`;
            
            if (directories.length > 0) {
                result += `### Directories (${directories.length})\n`;
                directories.forEach(dir => {
                    result += `📁 ${dir.path}\n`;
                });
                result += '\n';
            }

            if (regularFiles.length > 0) {
                result += `### Files (${regularFiles.length})\n`;
                regularFiles.forEach(file => {
                    const icon = this.getFileIcon(file.path);
                    const sizeStr = Utils.formatFileSize(file.size);
                    const dateStr = Utils.formatDate(file.lastModified);
                    result += `${icon} ${file.path} (${sizeStr}, ${dateStr})\n`;
                });
            }

            if (filteredFiles.length === 0) {
                result += '*No files found matching the criteria.*\n';
            }

            return result;

        } catch (error) {
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    getFileIcon(filePath) {
        const extension = Utils.getFileExtension(filePath);
        const iconMap = {
            'js': '📄', 'ts': '📄', 'jsx': '⚛️', 'tsx': '⚛️',
            'html': '🌐', 'css': '🎨', 'scss': '🎨', 'less': '🎨',
            'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
            'go': '🐹', 'rs': '🦀', 'php': '🐘',
            'json': '📋', 'xml': '📋', 'yaml': '📋', 'yml': '📋',
            'md': '📝', 'txt': '📝',
            'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
            'zip': '📦', 'tar': '📦', 'gz': '📦',
            'sh': '💻', 'bat': '💻', 'ps1': '💻'
        };
        return iconMap[extension] || '📄';
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.ReadFileTool = ReadFileTool;
    window.WriteFileTool = WriteFileTool;
    window.EditFileTool = EditFileTool;
    window.CreateFileTool = CreateFileTool;
    window.DeleteFileTool = DeleteFileTool;
    window.ListFilesTool = ListFilesTool;
}