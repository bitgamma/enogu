// Preset editor logic

import { DOM, state } from './state.js';
import { loadPresetContent, downloadPreset } from './api.js';
import { refreshPresetsAndUI } from './refresh.js';
import { executeOperation } from './editor.js';
import { showError } from './ui.js';

// Preset operation configurations
const PRESET_OPERATIONS = {
    save: {
        endpoint: '/api/preset-editor/preset',
        method: 'POST',
        successMsg: 'Preset saved successfully',
        buildPayload: (name) => ({
            name,
            settings: DOM.settingsJsonEditor.value,
        }),
        onsuccess: () => {
            if (!state.editorOriginalPresetNames.has(state.currentPreset)) {
                refreshPresetsAndUI(populateEditorPresetList);
            }
        },
    },
    duplicate: {
        endpoint: '/api/preset-editor/preset/duplicate',
        method: 'POST',
        successMsg: 'Preset duplicated successfully',
        prompt: (name) => `Enter new name for duplicate of "${name}":`,
        buildPayload: (name, newName) => ({ source_name: name, new_name: newName }),
        onsuccess: () => refreshPresetsAndUI(populateEditorPresetList),
    },
    rename: {
        endpoint: '/api/preset-editor/preset/rename',
        method: 'POST',
        successMsg: 'Preset renamed successfully',
        prompt: (name) => `Enter new name for "${name}":`,
        buildPayload: (name, newName) => ({ old_name: name, new_name: newName }),
        onsuccess: (newName) => {
            refreshPresetsAndUI(() => {
                DOM.editorPresetName.textContent = newName;
                DOM.presetSelect.value = newName;
                DOM.presetSelectResult.value = newName;
                populateEditorPresetList();
            });
        },
    },
    delete: {
        endpoint: (name) => `/api/preset-editor/preset/${encodeURIComponent(name)}`,
        method: 'DELETE',
        successMsg: 'Preset deleted successfully',
        confirm: (name) => `Are you sure you want to delete preset "${name}"? This action cannot be undone.`,
        buildPayload: (name) => ({ name }),
        onsuccess: () => {
            state.currentPreset = null;
            DOM.presetSelect.value = '';
            DOM.presetSelectResult.value = '';
            state.editorPresetData = { settings: '' };
            DOM.editorPresetName.textContent = 'Select a preset';
            DOM.savePresetBtn.disabled = true;
            DOM.duplicatePresetBtn.disabled = true;
            DOM.renamePresetBtn.disabled = true;
            DOM.deletePresetBtn.disabled = true;
            DOM.presetEditorContent.style.display = 'none';
            DOM.presetEditorPlaceholder.style.display = 'block';
            DOM.settingsJsonEditor.value = '';
            document.querySelectorAll('.preset-item').forEach(item => {
                item.classList.remove('selected');
            });
            refreshPresetsAndUI(populateEditorPresetList);
        },
    },
};

/**
 * Populate editor preset list from already-loaded data.
 */
export function populateEditorPresetList() {
    const presetList = DOM.presetList;
    presetList.innerHTML = '';

    if (state.availablePresets.length > 0) {
        state.editorOriginalPresetNames.clear();
        state.availablePresets.forEach(preset => {
            state.editorOriginalPresetNames.add(preset.name);
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.dataset.name = preset.name;
            presetItem.innerHTML = `
                <span class="preset-name">${preset.name}</span>
                <button class="preset-item-btn" data-download="${preset.name}">\u2193</button>
            `;
            presetItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('preset-item-btn')) {
                    selectPresetForEdit(preset.name);
                } else if (e.target.dataset.download) {
                    downloadPreset(e.target.dataset.download);
                }
            });
            presetList.appendChild(presetItem);
        });
    }
}

/**
 * Sync editor sidebar selection to match state.currentPreset.
 * Only updates UI, does not load content.
 */
export function syncPresetEditorSidebar() {
    const presetName = state.currentPreset;
    document.querySelectorAll('.preset-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.name === presetName);
    });

    if (presetName) {
        DOM.editorPresetName.textContent = presetName;
        DOM.savePresetBtn.disabled = false;
        DOM.duplicatePresetBtn.disabled = false;
        DOM.renamePresetBtn.disabled = false;
        DOM.deletePresetBtn.disabled = false;
        DOM.presetEditorContent.style.display = 'block';
        DOM.presetEditorPlaceholder.style.display = 'none';
    } else {
        DOM.editorPresetName.textContent = 'Select a preset';
        DOM.savePresetBtn.disabled = true;
        DOM.duplicatePresetBtn.disabled = true;
        DOM.renamePresetBtn.disabled = true;
        DOM.deletePresetBtn.disabled = true;
        DOM.presetEditorContent.style.display = 'none';
        DOM.presetEditorPlaceholder.style.display = 'block';
    }
}

/**
 * Load preset content into the editor.
 */
export async function loadPresetContentIntoEditor(presetName) {
    if (!presetName) return;

    try {
        const data = await loadPresetContent(presetName);

        state.editorPresetData.settings = data.settings || '{}';

        DOM.settingsJsonEditor.value = state.editorPresetData.settings;
    } catch (err) {
        console.error('Failed to load preset content:', err);
        showError('Failed to load preset content');
    }
}

/**
 * Select a preset for editing.
 * @param {string} presetName - Preset name to select
 */
export async function selectPresetForEdit(presetName) {
    state.currentPreset = presetName;
    DOM.presetSelect.value = presetName;
    DOM.presetSelectResult.value = presetName;

    syncPresetEditorSidebar();
    await loadPresetContentIntoEditor(presetName);
}

// Preset operation handlers
export async function saveCurrentPreset() {
    await executeOperation(PRESET_OPERATIONS, 'save', state.currentPreset, 'preset', selectPresetForEdit);
}

export async function duplicateCurrentPreset() {
    await executeOperation(PRESET_OPERATIONS, 'duplicate', state.currentPreset, 'preset', selectPresetForEdit);
}

export async function renameCurrentPreset() {
    await executeOperation(PRESET_OPERATIONS, 'rename', state.currentPreset, 'preset', selectPresetForEdit);
}

export async function deleteCurrentPreset() {
    await executeOperation(PRESET_OPERATIONS, 'delete', state.currentPreset, 'preset', selectPresetForEdit);
}
