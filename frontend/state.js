// Centralized state management and DOM registry

// DOM Element Registry
export const DOM = {
    // Generate view
    profileSelect: document.getElementById('profileSelect'),
    profileSelectResult: document.getElementById('profileSelectResult'),
    presetSelect: document.getElementById('presetSelect'),
    presetSelectResult: document.getElementById('presetSelectResult'),
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

    // Preset editor
    presetEditorContainer: document.getElementById('presetEditorContainer'),
    presetList: document.getElementById('presetList'),
    editorPresetName: document.getElementById('editorPresetName'),
    presetEditorContent: document.getElementById('presetEditorContent'),
    presetEditorPlaceholder: document.getElementById('presetEditorPlaceholder'),
    settingsJsonEditor: document.getElementById('settingsJsonEditor'),
    savePresetBtn: document.getElementById('savePresetBtn'),
    duplicatePresetBtn: document.getElementById('duplicatePresetBtn'),
    renamePresetBtn: document.getElementById('renamePresetBtn'),
    deletePresetBtn: document.getElementById('deletePresetBtn'),
    downloadAllPresetsBtn: document.getElementById('downloadAllPresetsBtn'),

    // Config editor
    configEditorContainer: document.getElementById('configEditorContainer'),
    llmEndpoint: document.getElementById('llmEndpoint'),
    llmApiKey: document.getElementById('llmApiKey'),
    llmModel: document.getElementById('llmModel'),
    refreshModelsBtn: document.getElementById('refreshModelsBtn'),
    llmSystemPrompt: document.getElementById('llmSystemPrompt'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),

    // Navigation
    navGenerate: document.getElementById('navGenerate'),
    navProfiles: document.getElementById('navProfiles'),
    navPresets: document.getElementById('navPresets'),
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

    // Preset selection
    currentPreset: null,
    availablePresets: [],
    presetsLoaded: false,

    // Image handling
    selectedFile: null,
    currentResolution: { width: 768, height: 1024 },
    currentSeed: null,

    // Processing state
    isProcessing: false,

    // Image history
    imageHistory: [],
    // Profile editor state
    editorProfileData: { extraction_prompt: '' },
    editorOriginalNames: new Set(),

    // Preset editor state
    editorPresetData: { settings: '' },
    editorOriginalPresetNames: new Set(),

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

// Action button configurations (keyed by name; operations are wired in main.js)
export const ACTION_BUTTONS = [
    { key: 'reanalyze', btn: DOM.reanalyzeBtn, loading: 'Re-analyzing image with LLM...', complete: 'Analysis complete', progress: '100%', error: 'Analysis' },
    { key: 'regenerate', btn: DOM.regenerateBtn, loading: 'Generating image...', complete: 'Generation complete', progress: '75%', error: 'Generation' },
    { key: 'regenerate15', btn: DOM.regenerate15Btn, loading: 'Generating image (1.5x)...', complete: 'Generation complete', progress: '75%', error: 'Generation' },
    { key: 'regenerate2', btn: DOM.regenerate2Btn, loading: 'Generating image (2x)...', complete: 'Generation complete', progress: '75%', error: 'Generation' },
    { key: 'upscale', btn: DOM.upscaleBtn, loading: 'Upscaling image...', complete: 'Upscaling complete', progress: '75%', error: 'Upscaling' },
    { key: 'saveToGallery', btn: DOM.saveToGalleryBtn, loading: 'Saving to gallery...', complete: 'Saved to gallery', progress: '75%', error: 'Save to gallery' },
];
