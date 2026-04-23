// API call functions

import { DOM, state } from './state.js';
import { showSuccess, showError } from './ui.js';

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
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number|null} seed - Seed value (null for random)
 * @param {boolean} upscale - Whether to upscale
 * @param {number} upscaleResolution - Upscale resolution
 * @returns {Promise<{image: string}>}
 */
export async function generateImageAPI(prompt, profile, width, height, seed, upscale, upscaleResolution) {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('profile', profile);
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
    
    return apiCall('/api/generate', formData, {}, 'Generation');
}

/**
 * Load available profiles from backend.
 * @returns {Promise<Array>} List of profiles
 */
export async function loadProfiles() {
    const response = await fetch('/api/profiles');
    const data = await response.json();
    if (data.profiles && data.profiles.length > 0) {
        return data.profiles;
    }
    return [];
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
    return fetch(`/api/profile-editor/profile/${encodeURIComponent(name)}`, {
        method: 'DELETE'
    });
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

/**
 * Generate a random seed value.
 * @returns {number} Random seed
 */
export function generateRandomSeed() {
    return Math.floor(Math.random() * 4294967295);
}

/**
 * Handle API response for profile operations.
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
