// API call functions

import { showSuccess, showError } from './ui.js';
import { generateRandomSeed } from './state.js';

/**
 * Generic API call helper with standardized error handling.
 * @param {string} endpoint - API endpoint URL
 * @param {FormData|Object} body - Request body
 * @param {Object} options - Additional fetch options
 * @param {string} errorPrefix - Prefix for error messages
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function apiCall(endpoint, body, options = {}, errorPrefix = 'Request') {
    const response = await fetch(endpoint, { method: 'POST', body, ...options });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_reason || data.detail || `${errorPrefix} failed`);
    }
    return data;
}

/**
 * Analyze an image via the /api/analyze endpoint.
 * @param {File} file - The image file to analyze
 * @param {string} profile - The profile name
 * @returns {Promise<{prompt: string}>}
 */
export async function analyzeImageAPI(file, profile) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile', profile);
    return apiCall('/api/analyze', formData, {}, 'Analysis');
}

/**
 * Generate an image via the /api/generate endpoint.
 * @param {string} prompt - The generation prompt
 * @param {string} profile - The profile name
 * @param {string} workflow - The workflow name
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number|null} seed - Seed value (null for random)
 * @param {boolean} upscale - Whether to upscale
 * @param {number} upscaleResolution - Upscale resolution
 * @param {boolean} save - Whether to save to gallery
 * @returns {Promise<{image: string}>}
 */
export async function generateImageAPI(prompt, profile, workflow, width, height, seed, upscale, upscaleResolution, save = false) {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('profile', profile);
    formData.append('workflow', workflow);
    formData.append('width', width);
    formData.append('height', height);

    if (seed !== null) {
        formData.append('seed', seed);
    } else {
        formData.append('seed', generateRandomSeed());
    }

    if (upscale) {
        formData.append('upscale_switch', true);
        formData.append('upscale_resolution', upscaleResolution);
    }

    formData.append('save', save);

    return apiCall('/api/generate', formData, {}, 'Generation');
}

/**
 * Load available profiles from backend.
 * @returns {Promise<Array>} List of profiles
 */
export async function loadProfiles() {
    const response = await fetch('/api/profiles');
    const data = await response.json();
    return data?.profiles || [];
}

/**
 * Load available workflows from backend.
 * @returns {Promise<Array>} List of workflows
 */
export async function loadWorkflows() {
    const response = await fetch('/api/workflows');
    const data = await response.json();
    return data?.workflows || [];
}

/**
 * Load configuration from backend.
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig() {
    const response = await fetch('/api/config/providers');
    const data = await response.json();
    return data.providers || {};
}

/**
 * Save configuration to backend.
 * @param {Object} config - Configuration object
 * @returns {Promise<Response>} Fetch response
 */
export async function saveConfig(config) {
    return fetch('/api/config/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
}

/**
 * Refresh LLM models from backend.
 * @returns {Promise<Array>} List of model names
 */
export async function refreshLLMModels() {
    const response = await fetch('/api/config/models');
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to load LLM models');
    }
    const data = await response.json();
    return data.models || [];
}

// ============== Profile API ==============

/**
 * Load profile content for editing.
 * @param {string} profileName - Profile name
 * @returns {Promise<Object>} Profile content
 */
export async function loadProfileContent(profileName) {
    const response = await fetch(`/api/profile-editor/profile/${encodeURIComponent(profileName)}`);
    return response.json();
}

/**
 * Save a profile.
 * @param {Object} payload - Profile data
 * @returns {Promise<Response>} Fetch response
 */
export async function saveProfile(payload) {
    return fetch('/api/profile-editor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

/**
 * Duplicate a profile.
 * @param {string} sourceName - Source profile name
 * @param {string} newName - New profile name
 * @returns {Promise<Response>} Fetch response
 */
export async function duplicateProfile(sourceName, newName) {
    return fetch('/api/profile-editor/profile/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_name: sourceName, new_name: newName })
    });
}

/**
 * Rename a profile.
 * @param {string} oldName - Old profile name
 * @param {string} newName - New profile name
 * @returns {Promise<Response>} Fetch response
 */
export async function renameProfile(oldName, newName) {
    return fetch('/api/profile-editor/profile/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_name: oldName, new_name: newName })
    });
}

/**
 * Delete a profile.
 * @param {string} name - Profile name
 * @returns {Promise<Response>} Fetch response
 */
export async function deleteProfile(name) {
    return fetch(`/api/profile-editor/profile/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/**
 * Download a specific profile.
 * @param {string} profileName - Profile name
 */
export function downloadProfile(profileName) {
    window.location.href = `/api/profile-editor/download/${encodeURIComponent(profileName)}`;
}

/**
 * Download all profiles.
 */
export function downloadAllProfiles() {
    window.location.href = '/api/profile-editor/download-all';
}

// ============== Workflow API ==============

/**
 * Load workflow content for editing.
 * @param {string} workflowName - Workflow name
 * @returns {Promise<Object>} Workflow content
 */
export async function loadWorkflowContent(workflowName) {
    const response = await fetch(`/api/workflow-editor/workflow/${encodeURIComponent(workflowName)}`);
    return response.json();
}

/**
 * Save a workflow.
 * @param {Object} payload - Workflow data
 * @returns {Promise<Response>} Fetch response
 */
export async function saveWorkflow(payload) {
    return fetch('/api/workflow-editor/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

/**
 * Duplicate a workflow.
 * @param {string} sourceName - Source workflow name
 * @param {string} newName - New workflow name
 * @returns {Promise<Response>} Fetch response
 */
export async function duplicateWorkflow(sourceName, newName) {
    return fetch('/api/workflow-editor/workflow/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_name: sourceName, new_name: newName })
    });
}

/**
 * Rename a workflow.
 * @param {string} oldName - Old workflow name
 * @param {string} newName - New workflow name
 * @returns {Promise<Response>} Fetch response
 */
export async function renameWorkflow(oldName, newName) {
    return fetch('/api/workflow-editor/workflow/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_name: oldName, new_name: newName })
    });
}

/**
 * Delete a workflow.
 * @param {string} name - Workflow name
 * @returns {Promise<Response>} Fetch response
 */
export async function deleteWorkflow(name) {
    return fetch(`/api/workflow-editor/workflow/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/**
 * Download a specific workflow.
 * @param {string} workflowName - Workflow name
 */
export function downloadWorkflow(workflowName) {
    window.location.href = `/api/workflow-editor/download/${encodeURIComponent(workflowName)}`;
}

/**
 * Download all workflows.
 */
export function downloadAllWorkflows() {
    window.location.href = '/api/workflow-editor/download-all';
}

/**
 * Handle API response for editor operations.
 * @param {Response} response - The fetch response
 * @param {string} successMessage - Message to show on success
 * @param {string} operationName - Name of the operation for error messages
 * @returns {Promise<boolean>} True if successful
 */
export async function handleApiResponse(response, successMessage, operationName) {
    const data = await response.json();
    if (response.ok) {
        showSuccess(successMessage);
        return true;
    } else {
        showError(data.detail || `${operationName} failed`);
        return false;
    }
}

// ============== Gallery API ==============

/**
 * Load gallery images from backend.
 * @returns {Promise<Array>} List of gallery items
 */
export async function loadGallery() {
    const response = await fetch('/api/gallery');
    const data = await response.json();
    return data?.images || [];
}

/**
 * Delete a single image from the gallery.
 * @param {string} filename - The filename to delete
 * @returns {Promise<Object>} Response data
 */
export async function deleteGalleryImage(filename) {
    const response = await fetch(`/api/gallery/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete image');
    }
    return data;
}

/**
 * Delete all images from the gallery.
 * @returns {Promise<Object>} Response data
 */
export async function deleteAllGalleryImages() {
    const response = await fetch('/api/gallery', { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete all images');
    }
    return data;
}
