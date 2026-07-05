// Centralized state management and DOM registry

// DOM Element Registry
export const DOM = {
    // Generate view
    profileSelect: document.getElementById('profileSelect'),
    profileSelectResult: document.getElementById('profileSelectResult'),
    workflowSelect: document.getElementById('workflowSelect'),
    workflowSelectResult: document.getElementById('workflowSelectResult'),
    uploadSection: document.getElementById('uploadSection'),
    fileInput: document.getElementById('fileInput'),
    cameraInput: document.getElementById('cameraInput'),
    cameraBtn: document.getElementById('cameraBtn'),
    previewImage: document.getElementById('previewImage'),
    newBtn: document.getElementById('newBtn'),
    reanalyzeBtn: document.getElementById('reanalyzeBtn'),
    regenerateBtn: document.getElementById('regenerateBtn'),
    regenerate15Btn: document.getElementById('regenerate15Btn'),
    regenerate2Btn: document.getElementById('regenerate2Btn'),
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
    saveToGalleryBtn: document.getElementById('saveToGalleryBtn'),

    // Profile editor
    profileEditorContainer: document.getElementById('profileEditorContainer'),
    profileList: document.getElementById('profileList'),
    editorProfileName: document.getElementById('editorProfileName'),
    editorTabs: document.getElementById('editorTabs'),
    editorContent: document.getElementById('editorContent'),
    editorPlaceholder: document.getElementById('editorPlaceholder'),
    extractionPromptEditor: document.getElementById('extractionPromptEditor'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    duplicateProfileBtn: document.getElementById('duplicateProfileBtn'),
    renameProfileBtn: document.getElementById('renameProfileBtn'),
    deleteProfileBtn: document.getElementById('deleteProfileBtn'),
    downloadAllProfilesBtn: document.getElementById('downloadAllProfilesBtn'),

    // Workflow editor
    workflowEditorContainer: document.getElementById('workflowEditorContainer'),
    workflowList: document.getElementById('workflowList'),
    editorWorkflowName: document.getElementById('editorWorkflowName'),
    workflowEditorTabs: document.getElementById('workflowEditorTabs'),
    workflowEditorContent: document.getElementById('workflowEditorContent'),
    workflowEditorPlaceholder: document.getElementById('workflowEditorPlaceholder'),
    workflowJsonEditor: document.getElementById('workflowJsonEditor'),
    mappingsJsonEditor: document.getElementById('mappingsJsonEditor'),
    saveWorkflowBtn: document.getElementById('saveWorkflowBtn'),
    duplicateWorkflowBtn: document.getElementById('duplicateWorkflowBtn'),
    renameWorkflowBtn: document.getElementById('renameWorkflowBtn'),
    deleteWorkflowBtn: document.getElementById('deleteWorkflowBtn'),
    downloadAllWorkflowsBtn: document.getElementById('downloadAllWorkflowsBtn'),

    // Config editor
    configEditorContainer: document.getElementById('configEditorContainer'),
    comfyuiEndpoint: document.getElementById('comfyuiEndpoint'),
    llmEndpoint: document.getElementById('llmEndpoint'),
    llmApiKey: document.getElementById('llmApiKey'),
    llmModel: document.getElementById('llmModel'),
    refreshModelsBtn: document.getElementById('refreshModelsBtn'),
    llmSystemPrompt: document.getElementById('llmSystemPrompt'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),

    // Navigation
    navGenerate: document.getElementById('navGenerate'),
    navProfiles: document.getElementById('navProfiles'),
    navWorkflows: document.getElementById('navWorkflows'),
    navGallery: document.getElementById('navGallery'),
    navConfig: document.getElementById('navConfig'),

    // Gallery
    galleryContainer: document.getElementById('galleryContainer'),
    galleryGrid: document.getElementById('galleryGrid'),
    galleryEmpty: document.getElementById('galleryEmpty'),
    refreshGalleryBtn: document.getElementById('refreshGalleryBtn'),
    deleteAllGalleryBtn: document.getElementById('deleteAllGalleryBtn'),
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

    // Workflow selection
    currentWorkflow: null,
    availableWorkflows: [],
    workflowsLoaded: false,

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
    editorProfileData: { extraction_prompt: '' },
    editorOriginalNames: new Set(),

    // Workflow editor state
    editorWorkflowData: { workflow: '', mappings: '' },
    editorOriginalWorkflowNames: new Set(),

    // Configuration
    currentConfig: null,
    availableLLMModels: [],
    modelsLoading: false,

    // Gallery
    galleryItems: [],
    downloadedGalleryFiles: new Set(),

    // Last generation parameters (for save-to-gallery re-execution)
    lastGenerationParams: null,

    // Resolution multiplier from restored history item (used by upscale button)
    historyResolutionMultiplier: null,
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
    { btn: DOM.regenerate15Btn, loading: 'Generating image (1.5x)...', complete: 'Generation complete', progress: '75%' },
    { btn: DOM.regenerate2Btn, loading: 'Generating image (2x)...', complete: 'Generation complete', progress: '75%' },
    { btn: DOM.upscaleBtn, loading: 'Upscaling image...', complete: 'Upscaling complete', progress: '75%' },
    { btn: DOM.saveToGalleryBtn, loading: 'Saving to gallery...', complete: 'Saved to gallery', progress: '75%' },
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
            window.refreshProfilesAndUI();
        }
    }
};

// Workflow operation configurations
export const WORKFLOW_OPERATIONS = {
    save: {
        endpoint: '/api/workflow-editor/workflow',
        method: 'POST',
        successMsg: 'Workflow saved successfully',
        buildPayload: (name) => ({
            name,
            workflow: DOM.workflowJsonEditor.value,
            mappings: DOM.mappingsJsonEditor.value,
        }),
        onsuccess: () => !state.editorOriginalWorkflowNames.has(state.currentWorkflow) ? window.refreshWorkflowsAndUI() : null
    },
    duplicate: {
        endpoint: '/api/workflow-editor/workflow/duplicate',
        method: 'POST',
        successMsg: 'Workflow duplicated successfully',
        prompt: (name) => `Enter new name for duplicate of "${name}":`,
        buildPayload: (name, newName) => ({ source_name: name, new_name: newName }),
        onsuccess: (newName) => window.refreshWorkflowsAndUI()
    },
    rename: {
        endpoint: '/api/workflow-editor/workflow/rename',
        method: 'POST',
        successMsg: 'Workflow renamed successfully',
        prompt: (name) => `Enter new name for "${name}":`,
        validate: (newName) => !state.editorOriginalWorkflowNames.has(newName),
        buildPayload: (name, newName) => ({ old_name: name, new_name: newName }),
        onsuccess: (newName) => {
            window.refreshWorkflowsAndUI(() => { DOM.editorWorkflowName.textContent = newName; DOM.workflowSelect.value = newName; DOM.workflowSelectResult.value = newName; });
        }
    },
    delete: {
        endpoint: (name) => `/api/workflow-editor/workflow/${encodeURIComponent(name)}`,
        method: 'DELETE',
        successMsg: 'Workflow deleted successfully',
        confirm: (name) => `Are you sure you want to delete workflow "${name}"? This action cannot be undone.`,
        buildPayload: (name) => ({ name }),
        onsuccess: () => {
            state.currentWorkflow = null;
            DOM.workflowSelect.value = '';
            DOM.workflowSelectResult.value = '';
            state.editorWorkflowData = { workflow: '', mappings: '' };
            DOM.editorWorkflowName.textContent = 'Select a workflow';
            DOM.saveWorkflowBtn.disabled = true;
            DOM.duplicateWorkflowBtn.disabled = true;
            DOM.renameWorkflowBtn.disabled = true;
            DOM.deleteWorkflowBtn.disabled = true;
            DOM.workflowEditorTabs.style.display = 'none';
            DOM.workflowEditorContent.style.display = 'none';
            DOM.workflowEditorPlaceholder.style.display = 'block';
            DOM.workflowJsonEditor.value = '';
            DOM.mappingsJsonEditor.value = '';
            document.querySelectorAll('.workflow-item').forEach(item => {
                item.classList.remove('selected');
            });
            window.refreshWorkflowsAndUI();
        }
    }
};
