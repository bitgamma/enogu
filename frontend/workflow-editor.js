// Workflow editor logic

import { DOM, state } from './state.js';
import { loadWorkflowContent, downloadWorkflow } from './api.js';
import { refreshWorkflowsAndUI } from './refresh.js';
import { executeOperation } from './editor.js';
import { showError } from './ui.js';

// Workflow operation configurations
const WORKFLOW_OPERATIONS = {
    save: {
        endpoint: '/api/workflow-editor/workflow',
        method: 'POST',
        successMsg: 'Workflow saved successfully',
        buildPayload: (name) => ({
            name,
            workflow: DOM.workflowJsonEditor.value,
            mappings: DOM.mappingsJsonEditor.value,
        }),
        onsuccess: () => {
            if (!state.editorOriginalWorkflowNames.has(state.currentWorkflow)) {
                refreshWorkflowsAndUI(populateEditorWorkflowList);
            }
        },
    },
    duplicate: {
        endpoint: '/api/workflow-editor/workflow/duplicate',
        method: 'POST',
        successMsg: 'Workflow duplicated successfully',
        prompt: (name) => `Enter new name for duplicate of "${name}":`,
        buildPayload: (name, newName) => ({ source_name: name, new_name: newName }),
        onsuccess: () => refreshWorkflowsAndUI(populateEditorWorkflowList),
    },
    rename: {
        endpoint: '/api/workflow-editor/workflow/rename',
        method: 'POST',
        successMsg: 'Workflow renamed successfully',
        prompt: (name) => `Enter new name for "${name}":`,
        buildPayload: (name, newName) => ({ old_name: name, new_name: newName }),
        onsuccess: (newName) => {
            refreshWorkflowsAndUI(() => {
                DOM.editorWorkflowName.textContent = newName;
                DOM.workflowSelect.value = newName;
                DOM.workflowSelectResult.value = newName;
                populateEditorWorkflowList();
            });
        },
    },
    delete: {
        endpoint: (name) => `/api/workflow-editor/workflow/${encodeURIComponent(name)}`,
        method: 'DELETE',
        successMsg: 'Workflow deleted successfully',
        confirm: (name) => `Are you sure you want to delete workflow "${name}"? This action cannot be undone.`,
        buildPayload: (name) => ({ name }),
        onsuccess: () => {
            state.currentWorkflow = null;
            DOM.workflowSelect.value = '';
            DOM.workflowSelectResult.value = '';
            state.editorWorkflowData = { workflow: '', mappings: '' };
            DOM.editorWorkflowName.textContent = 'Select a workflow';
            DOM.saveWorkflowBtn.disabled = true;
            DOM.duplicateWorkflowBtn.disabled = true;
            DOM.renameWorkflowBtn.disabled = true;
            DOM.deleteWorkflowBtn.disabled = true;
            DOM.workflowEditorTabs.style.display = 'none';
            DOM.workflowEditorContent.style.display = 'none';
            DOM.workflowEditorPlaceholder.style.display = 'block';
            DOM.workflowJsonEditor.value = '';
            DOM.mappingsJsonEditor.value = '';
            document.querySelectorAll('.workflow-item').forEach(item => {
                item.classList.remove('selected');
            });
            refreshWorkflowsAndUI(populateEditorWorkflowList);
        },
    },
};

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

// Workflow operation handlers
export async function saveCurrentWorkflow() {
    await executeOperation(WORKFLOW_OPERATIONS, 'save', state.currentWorkflow, 'workflow', selectWorkflowForEdit);
}

export async function duplicateCurrentWorkflow() {
    await executeOperation(WORKFLOW_OPERATIONS, 'duplicate', state.currentWorkflow, 'workflow', selectWorkflowForEdit);
}

export async function renameCurrentWorkflow() {
    await executeOperation(WORKFLOW_OPERATIONS, 'rename', state.currentWorkflow, 'workflow', selectWorkflowForEdit);
}

export async function deleteCurrentWorkflow() {
    await executeOperation(WORKFLOW_OPERATIONS, 'delete', state.currentWorkflow, 'workflow', selectWorkflowForEdit);
}
