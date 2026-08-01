// Profile editor logic

import { DOM, state } from './state.js';
import { loadProfileContent, downloadProfile } from './api.js';
import { refreshProfilesAndUI } from './refresh.js';
import { executeOperation } from './editor.js';
import { showError } from './ui.js';

// Profile operation configurations
const PROFILE_OPERATIONS = {
    save: {
        endpoint: '/api/profile-editor/profile',
        method: 'POST',
        successMsg: 'Profile saved successfully',
        buildPayload: (name) => ({
            name,
            extraction_prompt: DOM.extractionPromptEditor.value,
        }),
        onsuccess: () => {
            if (!state.editorOriginalNames.has(state.currentProfile)) {
                refreshProfilesAndUI(populateEditorProfileList);
            }
        },
    },
    duplicate: {
        endpoint: '/api/profile-editor/profile/duplicate',
        method: 'POST',
        successMsg: 'Profile duplicated successfully',
        prompt: (name) => `Enter new name for duplicate of "${name}":`,
        buildPayload: (name, newName) => ({ source_name: name, new_name: newName }),
        onsuccess: () => refreshProfilesAndUI(populateEditorProfileList),
    },
    rename: {
        endpoint: '/api/profile-editor/profile/rename',
        method: 'POST',
        successMsg: 'Profile renamed successfully',
        prompt: (name) => `Enter new name for "${name}":`,
        buildPayload: (name, newName) => ({ old_name: name, new_name: newName }),
        onsuccess: (newName) => {
            refreshProfilesAndUI(() => {
                DOM.editorProfileName.textContent = newName;
                DOM.profileSelect.value = newName;
                populateEditorProfileList();
            });
        },
    },
    delete: {
        endpoint: (name) => `/api/profile-editor/profile/${encodeURIComponent(name)}`,
        method: 'DELETE',
        successMsg: 'Profile deleted successfully',
        confirm: (name) => `Are you sure you want to delete profile "${name}"? This action cannot be undone.`,
        buildPayload: (name) => ({ name }),
        onsuccess: () => {
            state.currentProfile = null;
            DOM.profileSelect.value = '';
            state.editorProfileData = { extraction_prompt: '' };
            DOM.editorProfileName.textContent = 'Select a profile';
            DOM.saveProfileBtn.disabled = true;
            DOM.duplicateProfileBtn.disabled = true;
            DOM.renameProfileBtn.disabled = true;
            DOM.deleteProfileBtn.disabled = true;
            if (DOM.editorTabs) DOM.editorTabs.style.display = 'none';
            DOM.editorContent.style.display = 'none';
            DOM.editorPlaceholder.style.display = 'block';
            DOM.extractionPromptEditor.value = '';
            document.querySelectorAll('.profile-item').forEach(item => {
                item.classList.remove('selected');
            });
            refreshProfilesAndUI(populateEditorProfileList);
        },
    },
};

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

// Profile operation handlers
export async function saveCurrentProfile() {
    await executeOperation(PROFILE_OPERATIONS, 'save', state.currentProfile, 'profile', selectProfileForEdit);
}

export async function duplicateCurrentProfile() {
    await executeOperation(PROFILE_OPERATIONS, 'duplicate', state.currentProfile, 'profile', selectProfileForEdit);
}

export async function renameCurrentProfile() {
    await executeOperation(PROFILE_OPERATIONS, 'rename', state.currentProfile, 'profile', selectProfileForEdit);
}

export async function deleteCurrentProfile() {
    await executeOperation(PROFILE_OPERATIONS, 'delete', state.currentProfile, 'profile', selectProfileForEdit);
}
