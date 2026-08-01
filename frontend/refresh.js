// Shared data-loading and refresh helpers used across views.
// Lives in its own module to avoid circular imports between main.js and the editors.
import { loadProfiles as fetchProfiles, loadWorkflows as fetchWorkflows } from './api.js';
import { DOM, state } from './state.js';
import { populateSelect, showError } from './ui.js';

/**
 * Load profiles from backend and update state.
 */
export async function loadProfilesAndUI() {
    try {
        const profiles = await fetchProfiles();
        if (profiles.length > 0) {
            state.availableProfiles = [...profiles];
            state.profilesLoaded = true;
        } else {
            showError('No profiles available');
        }
    } catch (err) {
        console.error('Failed to load profiles:', err);
        showError('Failed to load profiles. Please refresh the page.');
    }
}

/**
 * Load workflows from backend and update state.
 */
export async function loadWorkflowsAndUI() {
    try {
        const workflows = await fetchWorkflows();
        if (workflows.length > 0) {
            state.availableWorkflows = [...workflows];
            state.workflowsLoaded = true;
        } else {
            showError('No workflows available');
        }
    } catch (err) {
        console.error('Failed to load workflows:', err);
        showError('Failed to load workflows. Please refresh the page.');
    }
}

/**
 * Populate all profile selects from loaded data.
 */
export function populateProfileSelects() {
    if (state.availableProfiles.length > 0) {
        populateSelect(DOM.profileSelect, state.availableProfiles, (name) => { state.currentProfile = name; });
        populateSelect(DOM.profileSelectResult, state.availableProfiles);
    }
}

/**
 * Populate all workflow selects from loaded data.
 */
export function populateWorkflowSelects() {
    if (state.availableWorkflows.length > 0) {
        populateSelect(DOM.workflowSelect, state.availableWorkflows, (name) => { state.currentWorkflow = name; });
        populateSelect(DOM.workflowSelectResult, state.availableWorkflows);
    }
}

/**
 * Refresh profiles and update all UIs.
 * @param {Function} extraCallback - Optional repopulation of editor lists.
 */
export async function refreshProfilesAndUI(extraCallback = null) {
    await loadProfilesAndUI();
    populateProfileSelects();
    if (extraCallback) extraCallback();
}

/**
 * Refresh workflows and update all UIs.
 * @param {Function} extraCallback - Optional repopulation of editor lists.
 */
export async function refreshWorkflowsAndUI(extraCallback = null) {
    await loadWorkflowsAndUI();
    populateWorkflowSelects();
    if (extraCallback) extraCallback();
}
