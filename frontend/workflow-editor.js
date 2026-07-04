// Workflow editor logic

import { DOM, WORKFLOW_OPERATIONS, state } from './state.js';
import { loadWorkflowContent, handleApiResponse, downloadWorkflow } from './api.js';
import { showPrompt, showConfirm, showError } from './ui.js';

/**
 * Populate editor workflow list from already-loaded data.
 */
export function populateEditorWorkflowList() {
    const workflowList = DOM.workflowList;
    workflowList.innerHTML = '';

    if (state.availableWorkflows.length > 0) {
        state.editorOriginalWorkflowNames.clear();
        state.availableWorkflows.forEach(workflow => {
            state.editorOriginalWorkflowNames.add(workflow.name);
            const workflowItem = document.createElement('div');
            workflowItem.className = 'workflow-item';
            workflowItem.dataset.name = workflow.name;
            workflowItem.innerHTML = `
                <span class="workflow-name">${workflow.name}</span>
                <button class="workflow-item-btn" data-download="${workflow.name}">\u2193</button>
            `;
            workflowItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('workflow-item-btn')) {
                    selectWorkflowForEdit(workflow.name);
                } else if (e.target.dataset.download) {
                    downloadWorkflow(e.target.dataset.download);
                }
            });
            workflowList.appendChild(workflowItem);
        });
    }
}

/**
 * Sync editor sidebar selection to match state.currentWorkflow.
 * Only updates UI, does not load content.
 */
export function syncWorkflowEditorSidebar() {
    const workflowName = state.currentWorkflow;
    document.querySelectorAll('.workflow-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.name === workflowName);
    });

    if (workflowName) {
        DOM.editorWorkflowName.textContent = workflowName;
        DOM.saveWorkflowBtn.disabled = false;
        DOM.duplicateWorkflowBtn.disabled = false;
        DOM.renameWorkflowBtn.disabled = false;
        DOM.deleteWorkflowBtn.disabled = false;
        DOM.workflowEditorTabs.style.display = 'flex';
        DOM.workflowEditorContent.style.display = 'block';
        DOM.workflowEditorPlaceholder.style.display = 'none';
    } else {
        DOM.editorWorkflowName.textContent = 'Select a workflow';
        DOM.saveWorkflowBtn.disabled = true;
        DOM.duplicateWorkflowBtn.disabled = true;
        DOM.renameWorkflowBtn.disabled = true;
        DOM.deleteWorkflowBtn.disabled = true;
        DOM.workflowEditorTabs.style.display = 'none';
        DOM.workflowEditorContent.style.display = 'none';
        DOM.workflowEditorPlaceholder.style.display = 'block';
    }
}

/**
 * Load workflow content into the editor.
 */
export async function loadWorkflowContentIntoEditor(workflowName) {
    if (!workflowName) return;

    try {
        const data = await loadWorkflowContent(workflowName);

        state.editorWorkflowData.workflow = data.workflow || '{}';
        state.editorWorkflowData.mappings = data.mappings || '{}';

        DOM.workflowJsonEditor.value = state.editorWorkflowData.workflow;
        DOM.mappingsJsonEditor.value = state.editorWorkflowData.mappings;
        switchWorkflowEditorTab('workflow');
    } catch (err) {
        console.error('Failed to load workflow content:', err);
        showError('Failed to load workflow content');
    }
}

/**
 * Select a workflow for editing.
 * @param {string} workflowName - Workflow name to select
 */
export async function selectWorkflowForEdit(workflowName) {
    state.currentWorkflow = workflowName;
    DOM.workflowSelect.value = workflowName;
    DOM.workflowSelectResult.value = workflowName;

    syncWorkflowEditorSidebar();
    await loadWorkflowContentIntoEditor(workflowName);
}

/**
 * Switch workflow editor tab.
 * @param {string} tabName - Tab name to switch to
 */
export function switchWorkflowEditorTab(tabName) {
    document.querySelectorAll('#workflowEditorTabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const tabMap = {
        workflow: 'workflowJsonEditor',
        mappings: 'mappingsJsonEditor'
    };

    DOM.workflowJsonEditor.style.display = 'none';
    DOM.mappingsJsonEditor.style.display = 'none';

    const domKey = tabMap[tabName];
    if (domKey && DOM[domKey]) {
        DOM[domKey].style.display = 'block';
    }
}

/**
 * Execute a workflow operation.
 * @param {string} operationKey - Operation key (save, duplicate, rename, delete)
 */
export async function executeWorkflowOperation(operationKey) {
    if (!state.currentWorkflow) return;

    const op = WORKFLOW_OPERATIONS[operationKey];

    // Handle confirmation dialog
    if (op.confirm && !(await showConfirm(op.confirm(state.currentWorkflow)))) {
        return;
    }

    // Handle name prompt
    let newName = null;
    if (op.prompt) {
        newName = await showPrompt(op.prompt(state.currentWorkflow));
        if (newName === null) return;
        if (newName === state.currentWorkflow) {
            showError('A workflow with this name already exists');
            return;
        }
    }

    const payload = op.buildPayload(state.currentWorkflow, newName);
    const endpoint = typeof op.endpoint === 'function' ? op.endpoint(state.currentWorkflow) : op.endpoint;

    let response;
    switch (op.method) {
        case 'POST':
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            break;
        case 'DELETE':
            response = await fetch(endpoint, { method: 'DELETE' });
            break;
    }

    const success = await handleApiResponse(response, op.successMsg, op.successMsg);
    if (success && op.onsuccess) {
        await op.onsuccess(newName);
        // Special handling for duplicate: select the new workflow
        if (operationKey === 'duplicate' && newName) {
            selectWorkflowForEdit(newName);
        }
    }
}

// Workflow operation handlers
export async function saveCurrentWorkflow() {
    await executeWorkflowOperation('save');
}

export async function duplicateCurrentWorkflow() {
    await executeWorkflowOperation('duplicate');
}

export async function renameCurrentWorkflow() {
    await executeWorkflowOperation('rename');
}

export async function deleteCurrentWorkflow() {
    await executeWorkflowOperation('delete');
}
