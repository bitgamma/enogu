// Profile editor logic

import { DOM, PROFILE_OPERATIONS, state } from './state.js';
import { loadProfileContent, handleApiResponse, downloadProfile, downloadAllProfiles } from './api.js';
import { showPrompt, showConfirm, showSuccess, showError } from './ui.js';

// View switching (forwarded to main.js coordination)
export function showGenerateView() {
    window.switchViewMain('generate', null, true);
}

export function showProfileEditor() {
    window.switchViewMain('generate', 'editor', true);
}

export function showConfigEditor() {
    window.switchViewMain(['generate', 'editor'], 'config', false);
    window.loadConfigView();
}

/**
 * Switch between main views.
 * @param {string|string[]} hideViews - View(s) to hide
 * @param {string|null} showView - View to show
 * @param {boolean} refreshProfiles - Whether to refresh profiles
 */
export function switchView(hideViews, showView, refreshProfiles) {
    const hideList = Array.isArray(hideViews) ? hideViews : [hideViews];
    
    const isActiveGenerate = !hideList.includes('generate') && showView === 'generate';
    const isActiveEditor = !hideList.includes('editor') && showView === 'editor';
    const isActiveConfig = !hideList.includes('config') && showView === 'config';
    
    DOM.navGenerate?.classList.toggle('active', isActiveGenerate);
    DOM.navEditor?.classList.toggle('active', isActiveEditor);
    DOM.navConfig?.classList.toggle('active', isActiveConfig);
    
    DOM.screen1.parentElement.style.display = showView === null ? 'block' : 'none';
    DOM.profileEditorContainer.style.display = showView === 'editor' ? 'flex' : 'none';
    DOM.configEditorContainer.style.display = showView === 'config' ? 'block' : 'none';
    
    if (refreshProfiles) {
        window.refreshProfilesAndUI();
    }
}

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
 * Select a profile for editing.
 * @param {string} profileName - Profile name to select
 */
export async function selectProfileForEdit(profileName) {
    document.querySelectorAll('.profile-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.name === profileName) {
            item.classList.add('selected');
        }
    });
    
    state.editorCurrentProfile = profileName;
    DOM.editorProfileName.textContent = profileName;
    DOM.saveProfileBtn.disabled = false;
    DOM.duplicateProfileBtn.disabled = false;
    DOM.renameProfileBtn.disabled = false;
    DOM.deleteProfileBtn.disabled = false;
    DOM.editorTabs.style.display = 'flex';
    DOM.editorContent.style.display = 'block';
    DOM.editorPlaceholder.style.display = 'none';
    
    try {
        const data = await loadProfileContent(profileName);
        
        state.editorProfileData.extraction_prompt = data.extraction_prompt || '';
        state.editorProfileData.workflow = data.workflow || '{}';
        state.editorProfileData.mappings = data.mappings || '{}';
        
        DOM.extractionPromptEditor.value = state.editorProfileData.extraction_prompt;
        DOM.workflowEditor.value = state.editorProfileData.workflow;
        DOM.mappingsEditor.value = state.editorProfileData.mappings;
        switchEditorTab('extraction_prompt');
    } catch (err) {
        console.error('Failed to load profile content:', err);
        showError('Failed to load profile content');
    }
}

/**
 * Switch editor tab.
 * @param {string} tabName - Tab name to switch to
 */
export function switchEditorTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    const tabMap = {
        extraction_prompt: 'extractionPromptEditor',
        workflow: 'workflowEditor',
        mappings: 'mappingsEditor'
    };
    
    document.querySelectorAll('.editor-textarea').forEach(el => {
        el.style.display = 'none';
    });
    
    const domKey = tabMap[tabName];
    if (domKey && DOM[domKey]) {
        DOM[domKey].style.display = 'block';
    }
}

/**
 * Execute a profile operation.
 * @param {string} operationKey - Operation key (save, duplicate, rename, delete)
 */
export async function executeProfileOperation(operationKey) {
    if (!state.editorCurrentProfile) return;
    
    const op = PROFILE_OPERATIONS[operationKey];
    
    // Handle confirmation dialog
    if (op.confirm && !(await showConfirm(op.confirm(state.editorCurrentProfile)))) {
        return;
    }
    
    // Handle name prompt
    let newName = null;
    if (op.prompt) {
        newName = await showPrompt(op.prompt(state.editorCurrentProfile));
        if (newName === null) return;
        if (newName === state.editorCurrentProfile) {
            showError('New name must be different from current profile');
            return;
        }
    }
    
    if (op.validate && newName && !op.validate(newName)) {
        if (operationKey === 'rename') {
            showError('A profile with this name already exists');
        }
        return;
    }
    
    const payload = op.buildPayload(state.editorCurrentProfile, newName);
    const endpoint = typeof op.endpoint === 'function' ? op.endpoint(state.editorCurrentProfile) : op.endpoint;
    
    let response;
    switch (op.method) {
        case 'POST':
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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
