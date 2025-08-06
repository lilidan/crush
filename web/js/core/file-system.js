/**
 * Lightning-fs based File System for Browser Crush
 * Uses lightning-fs and isomorphic-git for file and git operations
 */


import FS from '@isomorphic-git/lightning-fs';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { Buffer } from 'buffer'
window.Buffer = Buffer;


class LightningFileSystem {
    constructor(name = 'crush-workspace') {
        this.fs = new FS(name).promises;
        this.workdir = '/';
        this.currentRepo = null;
        this.listeners = new Set();
        
        // Initialize git in the filesystem
        this.initializeGit();
    }

    /**
     * Initialize git repository
     */
    async initializeGit() {
        try {
            await git.init({ 
                fs: this.fs, 
                dir: this.workdir,
                defaultBranch: 'main'
            });
        } catch (error) {
            // Repository might already exist
            console.log('Git repository already exists or initialization failed:', error.message);
        }
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
     * Notify all listeners of an event
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('FileSystem listener error:', error);
            }
        });
    }

    /**
     * Clone repository from GitHub
     */
    async cloneRepository(repoUrl, branch = 'main') {
        console.log(`Cloning repository: ${repoUrl} (${branch})`);
        
        try {
            // Parse GitHub URL
            const repoInfo = this.parseGitHubUrl(repoUrl);
            if (!repoInfo) {
                throw new Error('Invalid GitHub URL');
            }

            // Clear existing files
            await this.clear();

            // Clone repository
            await git.clone({
                fs: this.fs,
                http,
                dir: this.workdir,
                url: repoUrl,
                ref: branch,
                singleBranch: true,
                depth: 1
            });

            // Store repository info
            this.currentRepo = { ...repoInfo, branch, url: repoUrl };
            if (window.CrushStorage) {
                window.CrushStorage.addRepository(this.currentRepo);
            }
            
            const files = await this.listFiles();
            console.log(`Cloned ${files.length} files from repository`);
            
            this.notifyListeners('repository_loaded', { 
                repo: this.currentRepo, 
                fileCount: files.length 
            });
            
            return true;
            
        } catch (error) {
            console.error('Failed to clone repository', error);
            throw error;
        }
    }

    /**
     * Parse GitHub URL
     */
    parseGitHubUrl(url) {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
            return {
                owner: match[1],
                repo: match[2].replace('.git', '')
            };
        }
        return null;
    }

    /**
     * Clear all files
     */
    async clear() {
        try {
            // Remove all files and directories except .git
            const files = await this.listFiles();
            for (const file of files) {
                if (!file.path.startsWith('.git')) {
                    await this.deleteFile(file.path);
                }
            }
        } catch (error) {
            console.warn('Error clearing files:', error);
        }
    }

    /**
     * Add/Create file
     */
    async addFile(path, content, type = 'file') {
        const normalizedPath = "/root/" + this.normalizePath(path);
        try {
            if (type === 'directory') {
                await this.fs.mkdir(normalizedPath, { recursive: true });
            } else {
                // Ensure parent directory exists
                const dir = this.dirname(normalizedPath);
                if (dir && dir !== '.' && dir !== '/') {
                    try {
                        await this.fs.mkdir(dir, { recursive: true });
                    } catch (error) {
                        console.error(`Failed to create directory: ${dir}`, error);
                    }
                }
                // Write file
                await this.fs.writeFile(normalizedPath, content, 'utf8');
            }

            // Get file stats
            const stats = await this.fs.stat(normalizedPath);
            const fileEntry = {
                path: normalizedPath,
                content: type === 'file' ? content : null,
                type: type,
                size: stats.size,
                lastModified: stats.mtime
            };

            // Notify listeners
            this.notifyListeners('file_added', { 
                path: normalizedPath, 
                type: type, 
                size: stats.size,
                file: fileEntry
            });
            
            return fileEntry;
            
        } catch (error) {
            console.error(`Failed to add file: ${normalizedPath}`, error);
            throw error;
        }
    }

    /**
     * Update file content
     */
    async updateFile(filePath, newContent) {
        const normalizedPath = this.normalizePath(filePath);
        
        try {
            // Read old content for comparison
            let oldContent = '';
            try {
                oldContent = await this.fs.readFile(normalizedPath, 'utf8');
            } catch (error) {
                // File doesn't exist, treat as new file
                return await this.addFile(normalizedPath, newContent, 'file');
            }

            // Write new content
            await this.fs.writeFile(normalizedPath, newContent, 'utf8');

            // Get updated stats
            const stats = await this.fs.stat(normalizedPath);
            const fileEntry = {
                path: normalizedPath,
                content: newContent,
                type: 'file',
                size: stats.size,
                lastModified: stats.mtime
            };

            // Notify listeners
            this.notifyListeners('file_updated', { 
                path: normalizedPath, 
                oldContent: oldContent,
                newContent: newContent,
                size: stats.size,
                file: fileEntry
            });
            
            return fileEntry;
            
        } catch (error) {
            console.error(`Failed to update file: ${normalizedPath}`, error);
            throw error;
        }
    }

    /**
     * Get file
     */
    async getFile(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        
        try {
            const stats = await this.fs.stat(normalizedPath);
            const content = stats.isFile() ? await this.fs.readFile(normalizedPath, 'utf8') : null;
            
            return {
                path: normalizedPath,
                content: content,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                lastModified: stats.mtime
            };
            
        } catch (error) {
            // File doesn't exist
            return null;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        
        try {
            // Get file info before deletion
            const existingFile = await this.getFile(normalizedPath);
            if (!existingFile) {
                return false;
            }

            // Delete file or directory
            if (existingFile.type === 'directory') {
                await this.fs.rmdir(normalizedPath, { recursive: true });
            } else {
                await this.fs.unlink(normalizedPath);
            }

            // Notify listeners
            this.notifyListeners('file_deleted', { 
                path: normalizedPath, 
                file: existingFile
            });
            
            return true;
            
        } catch (error) {
            console.error(`Failed to delete file: ${normalizedPath}`, error);
            return false;
        }
    }

    /**
     * List files in directory
     */
    async listFiles(directoryPath = '') {
        const normalizedDir = this.normalizePath(directoryPath);
        
        try {
            const files = [];
            await this.walkDirectory(normalizedDir || '/', (filePath, stats) => {
                files.push({
                    path: filePath,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    lastModified: stats.mtime
                });
            });
            
            return files.sort((a, b) => {
                // Directories first, then files
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.path.localeCompare(b.path);
            });
            
        } catch (error) {
            console.error('Failed to list files:', error);
            return [];
        }
    }

    /**
     * Walk directory recursively
     */
    async walkDirectory(dir, callback) {
        try {
            const entries = await this.fs.readdir(dir);
            
            for (const entry of entries) {
                if (entry === '.' || entry === '..') continue;
                
                const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
                const stats = await this.fs.stat(fullPath);
                
                callback(fullPath.replace(/^\/+/, ''), stats);
                
                if (stats.isDirectory()) {
                    await this.walkDirectory(fullPath, callback);
                }
            }
        } catch (error) {
            // Directory might not exist or be empty
        }
    }

    /**
     * Normalize file path
     */
    normalizePath(path) {
        if (!path) return '';
        return path.replace(/\\/g, '/')
    }

    /**
     * Get directory name
     */
    dirname(path) {
        const parts = path.split('/');
        parts.pop();
        return parts.join('/') || '.';
    }

    /**
     * Git operations
     */
    async gitAdd(filepath) {
        await git.add({ fs: this.fs, dir: this.workdir, filepath });
    }

    async gitCommit(message, author = { name: 'Browser Crush', email: 'crush@example.com' }) {
        await git.commit({
            fs: this.fs,
            dir: this.workdir,
            author,
            message
        });
    }

    async gitStatus() {
        return await git.statusMatrix({ fs: this.fs, dir: this.workdir });
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.LightningFileSystem = LightningFileSystem;
}

export default LightningFileSystem;