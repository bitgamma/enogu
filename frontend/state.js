// Centralized state management and DOM registry

// DOM Element Registry
export const DOM = {
    profileSelect: document.getElementById('profileSelect'),
    profileSelectResult: document.getElementById('profileSelectResult'),
    uploadSection: document.getElementById('uploadSection'),
    fileInput: document.getElementById('fileInput'),
    cameraInput: document.getElementById('cameraInput'),
    cameraBtn: document.getElementById('cameraBtn'),
    previewImage: document.getElementById('previewImage'),
    newBtn: document.getElementById('newBtn'),
    reanalyzeBtn: document.getElementById('reanalyzeBtn'),
    regenerateBtn: document.getElementById('regenerateBtn'),
    upscaleBtn: document.getElementById('upscaleBtn'),
    promptText: document.getElementById('promptText'),
    resolutionSelect: document.getElementById('resolutionSelect'),
    upscaleResolutionSelect: document.getElementById('upscaleResolutionSelect'),
    errorContainer: document.getElementById('errorContainer'),
    errorMessage: document.getElementById('errorMessage'),
    errorClose: document.getElementById('errorClose'),
    tryAgainBtn: document.getElementById('tryAgainBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    errorActions: document.getElementById('errorActions'),
    downloadBtn: document.getElementById('downloadBtn'),
    configEditorContainer: document.getElementById('configEditorContainer'),
    comfyuiEndpoint: document.getElementById('comfyuiEndpoint'),
    llmEndpoint: document.getElementById('llmEndpoint'),
    llmApiKey: document.getElementById('llmApiKey'),
    llmModel: document.getElementById('llmModel'),
    refreshModelsBtn: document.getElementById('refreshModelsBtn'),
    llmSystemPrompt: document.getElementById('llmSystemPrompt'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),
    progressFill: document.getElementById('progressFill'),
    stepIndicator1: document.getElementById('stepIndicator1'),
    stepIndicator2: document.getElementById('stepIndicator2'),
    stepIndicator3: document.getElementById('stepIndicator3'),
    processingText: document.getElementById('processingText'),
    screen1: document.getElementById('screen1'),
    screen2: document.getElementById('screen2'),
    screen3: document.getElementById('screen3'),
    historyContainer: document.getElementById('historyContainer'),
    resultImage: document.getElementById('resultImage'),
    profileEditorContainer: document.getElementById('profileEditorContainer'),
    profileList: document.getElementById('profileList'),
    editorProfileName: document.getElementById('editorProfileName'),
    editorTabs: document.getElementById('editorTabs'),
    editorContent: document.getElementById('editorContent'),
    editorPlaceholder: document.getElementById('editorPlaceholder'),
    extractionPromptEditor: document.getElementById('extractionPromptEditor'),
    workflowEditor: document.getElementById('workflowEditor'),
    mappingsEditor: document.getElementById('mappingsEditor'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    duplicateProfileBtn: document.getElementById('duplicateProfileBtn'),
    renameProfileBtn: document.getElementById('renameProfileBtn'),
    deleteProfileBtn: document.getElementById('deleteProfileBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    navGenerate: document.getElementById('navGenerate'),
    navEditor: document.getElementById('navEditor'),
    navConfig: document.getElementById('navConfig'),
};

// Resolution configuration
export const RESOLUTIONS = {
    '1024x1024': { width: 1024, height: 1024 },
    '768x1024': { width: 768, height: 1024 },
    '1024x768': { width: 1024, height: 768 },
    '720x1280': { width: 720, height: 1280 },
    '1280x720': { width: 1280, height: 720 },
    '688x1536': { width: 688, height: 1536 },
    '1536x688': { width: 1536, height: 688 },
};

// Constants
export const MAX_HISTORY = 10;

// Mutable state object - all mutable state goes through here
export const state = {
    // Profile selection
    currentProfile: null,
    availableProfiles: [],
    profilesLoaded: false,
    
    // Image handling
    selectedFile: null,
    currentResolution: { width: 768, height: 1024 },
    currentSeed: null,
    
    // Processing state
    isProcessing: false,
    
    // Image history
    imageHistory: [],
    upscaleResolution: 2048,
    
    // Profile editor state
    editorProfileData: { extraction_prompt: '', workflow: '', mappings: '' },
    editorOriginalNames: new Set(),
    
    // Configuration
    currentConfig: null,
    availableLLMModels: [],
    modelsLoading: false,
};

/**
 * Generate a random seed value.
 * @returns {number} Random seed
 */
export function generateRandomSeed() {
    return Math.floor(Math.random() * 4294967295);
}

// Action button configurations
export const ACTION_BUTTONS = [
    { btn: DOM.reanalyzeBtn, loading: 'Re-analyzing image with LLM...', complete: 'Analysis complete', progress: '100%' },
    { btn: DOM.regenerateBtn, loading: 'Generating image...', complete: 'Generation complete', progress: '75%' },
    { btn: DOM.upscaleBtn, loading: 'Upscaling image...', complete: 'Upscaling complete', progress: '75%' },
];

// Profile operation configurations
export const PROFILE_OPERATIONS = {
    save: {
        endpoint: '/api/profile-editor/profile',
        method: 'POST',
        successMsg: 'Profile saved successfully',
        buildPayload: (name) => ({
            name,
            extraction_prompt: DOM.extractionPromptEditor.value,
            workflow: DOM.workflowEditor.value,
            mappings: DOM.mappingsEditor.value
        }),
        onsuccess: () => !state.editorOriginalNames.has(state.currentProfile) ? window.refreshProfilesAndUI() : null
    },
    duplicate: {
        endpoint: '/api/profile-editor/profile/duplicate',
        method: 'POST',
        successMsg: 'Profile duplicated successfully',
        prompt: (name) => `Enter new name for duplicate of "${name}":`,
        buildPayload: (name, newName) => ({ source_name: name, new_name: newName }),
        onsuccess: (newName) => window.refreshProfilesAndUI()
    },
    rename: {
        endpoint: '/api/profile-editor/profile/rename',
        method: 'POST',
        successMsg: 'Profile renamed successfully',
        prompt: (name) => `Enter new name for "${name}":`,
        validate: (newName) => !state.editorOriginalNames.has(newName),
        buildPayload: (name, newName) => ({ old_name: name, new_name: newName }),
        onsuccess: (newName) => {
            window.refreshProfilesAndUI(() => { DOM.editorProfileName.textContent = newName; DOM.profileSelect.value = newName; });
        }
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
            state.editorProfileData = { extraction_prompt: '', workflow: '', mappings: '' };
            DOM.editorProfileName.textContent = 'Select a profile';
            DOM.saveProfileBtn.disabled = true;
            DOM.duplicateProfileBtn.disabled = true;
            DOM.renameProfileBtn.disabled = true;
            DOM.deleteProfileBtn.disabled = true;
            DOM.editorTabs.style.display = 'none';
            DOM.editorContent.style.display = 'none';
            DOM.editorPlaceholder.style.display = 'block';
            DOM.extractionPromptEditor.value = '';
            DOM.workflowEditor.value = '';
            DOM.mappingsEditor.value = '';
            document.querySelectorAll('.profile-item').forEach(item => {
                item.classList.remove('selected');
            });
            window.refreshProfilesAndUI();
        }
    }
};


