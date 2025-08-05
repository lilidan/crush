/**
 * Change Tracker for Browser Crush
 * Manages file changes, undo/redo operations, and version history
 */

class ChangeTracker {
    constructor() {
        this.changes = new Map(); // filePath -> Change[]
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 100;
        this.listeners = new Set();
    }

    /**
     * Record a new change
     */
    recordChange(change) {
        if (!(change instanceof Change)) {
            throw new Error('Change must be an instance of Change class');
        }

        const filePath = change.filePath;
        
        // Add to file-specific changes
        if (!this.changes.has(filePath)) {
            this.changes.set(filePath, []);
        }
        this.changes.get(filePath).push(change);

        // Add to undo stack
        this.undoStack.push(new UndoAction('change', change));
        
        // Clear redo stack (new changes invalidate redo)
        this.redoStack = [];
        
        // Limit history size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }

        // Notify listeners
        this.notifyListeners('change_recorded', { change });

        Utils.log(`Recorded ${change.type} change for ${filePath}`);
    }

    /**
     * Undo the last change
     */
    async undo() {
        if (this.undoStack.length === 0) {
            return false;
        }

        const action = this.undoStack.pop();
        const change = action.change;

        try {
            await this.revertChange(change);
            
            // Add to redo stack
            this.redoStack.push(action);
            
            // Notify listeners
            this.notifyListeners('change_undone', { change });
            
            Utils.log(`Undid ${change.type} change for ${change.filePath}`);
            return true;

        } catch (error) {
            // Put the action back if undo failed
            this.undoStack.push(action);
            Utils.error('Undo failed:', error);
            throw error;
        }
    }

    /**
     * Redo the last undone change
     */
    async redo() {
        if (this.redoStack.length === 0) {
            return false;
        }

        const action = this.redoStack.pop();
        const change = action.change;

        try {
            await this.applyChange(change);
            
            // Add back to undo stack
            this.undoStack.push(action);
            
            // Notify listeners
            this.notifyListeners('change_redone', { change });
            
            Utils.log(`Redid ${change.type} change for ${change.filePath}`);
            return true;

        } catch (error) {
            // Put the action back if redo failed
            this.redoStack.push(action);
            Utils.error('Redo failed:', error);
            throw error;
        }
    }

    /**
     * Revert a change
     */
    async revertChange(change) {
        switch (change.type) {
            case 'create':
                await this.revertCreate(change);
                break;
            case 'edit':
                await this.revertEdit(change);
                break;
            case 'delete':
                await this.revertDelete(change);
                break;
            default:
                throw new Error(`Unknown change type: ${change.type}`);
        }
    }

    /**
     * Apply a change
     */
    async applyChange(change) {
        switch (change.type) {
            case 'create':
                await this.applyCreate(change);
                break;
            case 'edit':
                await this.applyEdit(change);
                break;
            case 'delete':
                await this.applyDelete(change);
                break;
            default:
                throw new Error(`Unknown change type: ${change.type}`);
        }
    }

    /**
     * Revert file creation
     */
    async revertCreate(change) {
        // Remove the created file
        if (window.fileSystem) {
            window.fileSystem.deleteFile(change.filePath);
        }
    }

    /**
     * Revert file edit
     */
    async revertEdit(change) {
        // Restore old content
        if (window.fileSystem && change.oldContent !== null) {
            await window.fileSystem.updateFile(change.filePath, change.oldContent);
        }
    }

    /**
     * Revert file deletion
     */
    async revertDelete(change) {
        // Recreate the deleted file
        if (window.fileSystem && change.oldContent !== null) {
            await window.fileSystem.addFile(change.filePath, change.oldContent, 'file');
        }
    }

    /**
     * Apply file creation
     */
    async applyCreate(change) {
        if (window.fileSystem && change.newContent !== null) {
            await window.fileSystem.addFile(change.filePath, change.newContent, 'file');
        }
    }

    /**
     * Apply file edit
     */
    async applyEdit(change) {
        if (window.fileSystem && change.newContent !== null) {
            await window.fileSystem.updateFile(change.filePath, change.newContent);
        }
    }

    /**
     * Apply file deletion
     */
    async applyDelete(change) {
        if (window.fileSystem) {
            window.fileSystem.deleteFile(change.filePath);
        }
    }

    /**
     * Get changes for a specific file
     */
    getChanges(filePath = null) {
        if (filePath) {
            return this.changes.get(filePath) || [];
        }

        // Return all changes, sorted by timestamp
        const allChanges = [];
        for (const changes of this.changes.values()) {
            allChanges.push(...changes);
        }

        return allChanges.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Get recent changes
     */
    getRecentChanges(limit = 10) {
        return this.getChanges().slice(0, limit);
    }

    /**
     * Get changes by type
     */
    getChangesByType(type) {
        return this.getChanges().filter(change => change.type === type);
    }

    /**
     * Generate diff for a file
     */
    generateDiff(filePath) {
        const changes = this.getChanges(filePath);
        if (changes.length === 0) {
            return '';
        }

        // Simple diff generation
        let diff = `--- ${filePath}\n+++ ${filePath}\n`;
        
        changes.forEach((change, index) => {
            diff += `@@ Change ${index + 1} (${change.type}) @@\n`;
            
            if (change.oldContent !== null) {
                const oldLines = change.oldContent.split('\n');
                oldLines.forEach(line => {
                    diff += `-${line}\n`;
                });
            }
            
            if (change.newContent !== null) {
                const newLines = change.newContent.split('\n');
                newLines.forEach(line => {
                    diff += `+${line}\n`;
                });
            }
            
            diff += '\n';
        });

        return diff;
    }

    /**
     * Generate summary of all changes
     */
    generateSummary() {
        const allChanges = this.getChanges();
        const summary = {
            total: allChanges.length,
            byType: {},
            byFile: {},
            timespan: null
        };

        if (allChanges.length === 0) {
            return summary;
        }

        // Count by type
        allChanges.forEach(change => {
            summary.byType[change.type] = (summary.byType[change.type] || 0) + 1;
        });

        // Count by file
        allChanges.forEach(change => {
            summary.byFile[change.filePath] = (summary.byFile[change.filePath] || 0) + 1;
        });

        // Calculate timespan
        const timestamps = allChanges.map(c => c.timestamp.getTime());
        const earliest = new Date(Math.min(...timestamps));
        const latest = new Date(Math.max(...timestamps));
        summary.timespan = {
            earliest,
            latest,
            duration: latest.getTime() - earliest.getTime()
        };

        return summary;
    }

    /**
     * Clear all changes
     */
    clear() {
        this.changes.clear();
        this.undoStack = [];
        this.redoStack = [];
        this.notifyListeners('changes_cleared');
        Utils.log('Cleared all change history');
    }

    /**
     * Clear changes for a specific file
     */
    clearFile(filePath) {
        const hadChanges = this.changes.has(filePath);
        this.changes.delete(filePath);
        
        // Remove from undo/redo stacks
        this.undoStack = this.undoStack.filter(action => action.change.filePath !== filePath);
        this.redoStack = this.redoStack.filter(action => action.change.filePath !== filePath);
        
        if (hadChanges) {
            this.notifyListeners('file_changes_cleared', { filePath });
        }
    }

    /**
     * Check if there are changes that can be undone
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if there are changes that can be redone
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Get undo/redo statistics
     */
    getHistoryStats() {
        return {
            undoStack: this.undoStack.length,
            redoStack: this.redoStack.length,
            maxHistorySize: this.maxHistorySize,
            totalChanges: this.getChanges().length
        };
    }

    /**
     * Add change listener
     */
    addListener(callback) {
        this.listeners.add(callback);
    }

    /**
     * Remove change listener
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
                Utils.error('Change listener error:', error);
            }
        });
    }

    /**
     * Export changes for backup
     */
    exportChanges() {
        const allChanges = this.getChanges();
        return {
            changes: allChanges.map(change => ({
                id: change.id,
                type: change.type,
                filePath: change.filePath,
                oldContent: change.oldContent,
                newContent: change.newContent,
                timestamp: change.timestamp.toISOString()
            })),
            summary: this.generateSummary(),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import changes from backup
     */
    importChanges(data) {
        try {
            if (!data.changes || !Array.isArray(data.changes)) {
                throw new Error('Invalid changes data');
            }

            this.clear();

            data.changes.forEach(changeData => {
                const change = new Change(
                    changeData.type,
                    changeData.filePath,
                    changeData.oldContent,
                    changeData.newContent,
                    new Date(changeData.timestamp)
                );
                change.id = changeData.id;

                const filePath = change.filePath;
                if (!this.changes.has(filePath)) {
                    this.changes.set(filePath, []);
                }
                this.changes.get(filePath).push(change);
            });

            this.notifyListeners('changes_imported', { count: data.changes.length });
            Utils.log(`Imported ${data.changes.length} changes`);

        } catch (error) {
            Utils.error('Failed to import changes:', error);
            throw error;
        }
    }

    /**
     * Compress change history (remove redundant changes)
     */
    compressHistory() {
        let removedCount = 0;

        for (const [filePath, changes] of this.changes.entries()) {
            if (changes.length <= 1) continue;

            const compressed = [];
            let currentContent = null;

            // Process changes chronologically
            const sortedChanges = [...changes].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            for (const change of sortedChanges) {
                if (change.type === 'create') {
                    currentContent = change.newContent;
                    compressed.push(change);
                } else if (change.type === 'edit') {
                    if (compressed.length > 0 && compressed[compressed.length - 1].type === 'edit') {
                        // Merge consecutive edits
                        compressed[compressed.length - 1].newContent = change.newContent;
                        compressed[compressed.length - 1].timestamp = change.timestamp;
                        removedCount++;
                    } else {
                        compressed.push(change);
                    }
                    currentContent = change.newContent;
                } else if (change.type === 'delete') {
                    compressed.push(change);
                    currentContent = null;
                }
            }

            this.changes.set(filePath, compressed);
        }

        if (removedCount > 0) {
            this.notifyListeners('history_compressed', { removedCount });
            Utils.log(`Compressed history: removed ${removedCount} redundant changes`);
        }

        return removedCount;
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.ChangeTracker = ChangeTracker;
}