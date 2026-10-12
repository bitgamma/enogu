// Shared data-loading and refresh helpers used across views.
// Lives in its own module to avoid circular imports between main.js and the editors.
import { loadProfiles as fetchProfiles, loadPresets as fetchPresets } from './api.js';
import { DOM, state } from './state.js';
import { populateSelect, showError } from './ui.js';
import {
    DEFAULT_RATIO_KEY,
    RATIOS,
    computeSize,
    describeSize,
    describeTarget,
    presetResolution,
} from './resolution.js';

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
    updateResolutionInfo();
}

// ============== Resolution helpers ==============

/**
 * Set the selected preset and refresh everything derived from it (target resolution).
 * All preset-selection paths should go through here so the shown size never goes stale.
 * @param {string|null} name
 */
export function setCurrentPreset(name) {
    state.currentPreset = name;
    if (DOM.presetSelect.value !== name) DOM.presetSelect.value = name;
    if (DOM.presetSelectResult.value !== name) DOM.presetSelectResult.value = name;
    updateResolutionInfo();
}

/**
 * Set the selected aspect ratio (unknown keys are ignored).
 * @param {string} key - Ratio key from RATIOS
 */
export function setRatioKey(key) {
    if (!RATIOS[key]) return;
    state.currentRatioKey = key;
    if (DOM.resolutionSelect.value !== key) DOM.resolutionSelect.value = key;
    updateResolutionInfo();
}

/**
 * Set the per-side scale factor used by the regenerate buttons / upscaler.
 * @param {number} scale
 */
export function setScale(scale) {
    state.currentScale = Number(scale) > 0 ? Number(scale) : 1;
    updateResolutionInfo();
}

/**
 * Refresh the on-screen resolution read-out (size the next generation will use).
 */
export function updateResolutionInfo() {
    if (!DOM.resolutionInfo) return;
    const { targetMegapixels, divisor } = presetResolution(state.availablePresets, state.currentPreset);
    const size = computeSize({
        ratioKey: state.currentRatioKey,
        megapixels: targetMegapixels,
        scale: state.currentScale,
        divisor,
    });
    DOM.resolutionInfo.textContent = `${describeTarget(targetMegapixels, state.currentScale)} \u2192 ${describeSize(size)}`;
}

/**
 * Verify the aspect-ratio <select> matches RATIOS and apply the current selection.
 */
export function syncRatioSelect() {
    const missing = Object.keys(RATIOS).filter((key) => !DOM.resolutionSelect.querySelector(`option[value="${key}"]`));
    if (missing.length > 0) {
        console.warn('resolutionSelect is missing ratio options:', missing);
    }
    if (!RATIOS[state.currentRatioKey]) state.currentRatioKey = DEFAULT_RATIO_KEY;
    DOM.resolutionSelect.value = state.currentRatioKey;
    updateResolutionInfo();
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
