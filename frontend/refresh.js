// Shared data-loading and refresh helpers used across views.
// Lives in its own module to avoid circular imports between main.js and the editors.
import { loadProfiles as fetchProfiles, loadPresets as fetchPresets } from './api.js';
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
 * Load presets from backend and update state.
 */
export async function loadPresetsAndUI() {
    try {
        const presets = await fetchPresets();
        if (presets.length > 0) {
            state.availablePresets = [...presets];
            state.presetsLoaded = true;
        } else {
            showError('No presets available');
        }
    } catch (err) {
        console.error('Failed to load presets:', err);
        showError('Failed to load presets. Please refresh the page.');
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
 * Populate all preset selects from loaded data.
 */
export function populatePresetSelects() {
    if (state.availablePresets.length > 0) {
        populateSelect(DOM.presetSelect, state.availablePresets, (name) => { state.currentPreset = name; });
        populateSelect(DOM.presetSelectResult, state.availablePresets);
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
 * Refresh presets and update all UIs.
 * @param {Function} extraCallback - Optional repopulation of editor lists.
 */
export async function refreshPresetsAndUI(extraCallback = null) {
    await loadPresetsAndUI();
    populatePresetSelects();
    if (extraCallback) extraCallback();
}
