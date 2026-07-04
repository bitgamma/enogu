// Profile editor logic

import { DOM, PROFILE_OPERATIONS, state } from './state.js';
import { loadProfileContent, handleApiResponse, downloadProfile } from './api.js';
import { showPrompt, showConfirm, showError } from './ui.js';

/**
 * Populate editor profile list from already-loaded data.
 */
export function populateEditorProfileList() {
    const profileList = DOM.profileList;
    profileList.innerHTML = '';

    if (state.availableProfiles.length > 0) {
        state.editorOriginalNames.clear();
        state.availableProfiles.forEach(profile => {
            state.editorOriginalNames.add(profile.name);
            const profileItem = document.createElement('div');
            profileItem.className = 'profile-item';
            profileItem.dataset.name = profile.name;
            profileItem.innerHTML = `
                <span class="profile-name">${profile.name}</span>
                <button class="profile-item-btn" data-download="${profile.name}">\u2193</button>
            `;
            profileItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('profile-item-btn')) {
                    selectProfileForEdit(profile.name);
                } else if (e.target.dataset.download) {
                    downloadProfile(e.target.dataset.download);
                }
            });
            profileList.appendChild(profileItem);
        });
    }
}

/**
 * Sync editor sidebar selection to match state.currentProfile.
 * Only updates UI, does not load content.
 */
export function syncEditorSidebar() {
    const profileName = state.currentProfile;
    document.querySelectorAll('.profile-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.name === profileName);
    });

    if (profileName) {
        DOM.editorProfileName.textContent = profileName;
        DOM.saveProfileBtn.disabled = false;
        DOM.duplicateProfileBtn.disabled = false;
        DOM.renameProfileBtn.disabled = false;
        DOM.deleteProfileBtn.disabled = false;
        DOM.editorContent.style.display = 'block';
        DOM.editorPlaceholder.style.display = 'none';
    } else {
        DOM.editorProfileName.textContent = 'Select a profile';
        DOM.saveProfileBtn.disabled = true;
        DOM.duplicateProfileBtn.disabled = true;
        DOM.renameProfileBtn.disabled = true;
        DOM.deleteProfileBtn.disabled = true;
        DOM.editorContent.style.display = 'none';
        DOM.editorPlaceholder.style.display = 'block';
    }
}

/**
 * Load profile content into the editor.
 */
export async function loadProfileContentIntoEditor(profileName) {
    if (!profileName) return;

    try {
        const data = await loadProfileContent(profileName);

        state.editorProfileData.extraction_prompt = data.extraction_prompt || '';

        DOM.extractionPromptEditor.value = state.editorProfileData.extraction_prompt;
    } catch (err) {
        console.error('Failed to load profile content:', err);
        showError('Failed to load profile content');
    }
}

/**
 * Select a profile for editing.
 * @param {string} profileName - Profile name to select
 */
export async function selectProfileForEdit(profileName) {
    state.currentProfile = profileName;
    DOM.profileSelect.value = profileName;

    syncEditorSidebar();
    await loadProfileContentIntoEditor(profileName);
}

/**
 * Execute a profile operation.
 * @param {string} operationKey - Operation key (save, duplicate, rename, delete)
 */
export async function executeProfileOperation(operationKey) {
    if (!state.currentProfile) return;

    const op = PROFILE_OPERATIONS[operationKey];

    // Handle confirmation dialog
    if (op.confirm && !(await showConfirm(op.confirm(state.currentProfile)))) {
        return;
    }

    // Handle name prompt
    let newName = null;
    if (op.prompt) {
        newName = await showPrompt(op.prompt(state.currentProfile));
        if (newName === null) return;
        if (newName === state.currentProfile) {
            showError('A profile with this name already exists');
            return;
        }
    }

    const payload = op.buildPayload(state.currentProfile, newName);
    const endpoint = typeof op.endpoint === 'function' ? op.endpoint(state.currentProfile) : op.endpoint;

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
        // Special handling for duplicate: select the new profile
        if (operationKey === 'duplicate' && newName) {
            selectProfileForEdit(newName);
        }
    }
}

// Profile operation handlers
export async function saveCurrentProfile() {
    await executeProfileOperation('save');
}

export async function duplicateCurrentProfile() {
    await executeProfileOperation('duplicate');
}

export async function renameCurrentProfile() {
    await executeProfileOperation('rename');
}

export async function deleteCurrentProfile() {
    await executeProfileOperation('delete');
}
