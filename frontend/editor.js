// Shared editor operation executor used by both profile and workflow editors.

import { handleApiResponse } from './api.js';
import { showPrompt, showConfirm, showError } from './ui.js';

/**
 * Execute a CRUD operation from an operation config object.
 * @param {Object} operationConfig - Map of operation key -> {endpoint, method, successMsg, ...}
 * @param {string} operationKey - Key of the operation to run (save, duplicate, rename, delete)
 * @param {string} currentName - Currently selected item name
 * @param {string} label - Singular label for error messages ('profile' or 'workflow')
 * @param {Function} onDuplicateSelected - Called with the new name after a duplicate
 */
export async function executeOperation(operationConfig, operationKey, currentName, label, onDuplicateSelected) {
    const op = operationConfig[operationKey];
    if (!currentName) return;

    // Handle confirmation dialog
    if (op.confirm && !(await showConfirm(op.confirm(currentName)))) {
        return;
    }

    // Handle name prompt
    let newName = null;
    if (op.prompt) {
        newName = await showPrompt(op.prompt(currentName));
        if (newName === null) return;
        if (newName === currentName) {
            showError(`A ${label} with this name already exists`);
            return;
        }
    }

    const payload = op.buildPayload(currentName, newName);
    const endpoint = typeof op.endpoint === 'function' ? op.endpoint(currentName) : op.endpoint;

    let response;
    if (op.method === 'DELETE') {
        response = await fetch(endpoint, { method: 'DELETE' });
    } else {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    const success = await handleApiResponse(response, op.successMsg, op.successMsg);
    if (success && op.onsuccess) {
        await op.onsuccess(newName);
        // Special handling for duplicate: select the new item
        if (operationKey === 'duplicate' && newName) {
            onDuplicateSelected(newName);
        }
    }
}
