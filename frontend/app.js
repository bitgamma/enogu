// Image Generator Frontend
// Streamlined single-screen flow with auto-trigger analysis and generation

// DOM Element Registry - Direct element references for performance and simplicity
const DOM = {
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

// State
let currentProfile = null;
let selectedFile = null;
let availableProfiles = [];
let currentResolution = { width: 768, height: 1024 };
let currentSeed = null;

// Resolution configuration - maps value strings to width/height pairs
const RESOLUTIONS = {
    '1024x1024': { width: 1024, height: 1024 },
    '768x1024': { width: 768, height: 1024 },
    '1024x768': { width: 1024, height: 768 },
    '720x1280': { width: 720, height: 1280 },
    '1280x720': { width: 1280, height: 720 },
    '688x1536': { width: 688, height: 1536 },
    '1536x688': { width: 1536, height: 688 },
};
let isProcessing = false;
let imageHistory = [];
const MAX_HISTORY = 10;
let upscaleResolution = 2048;
let profilesLoaded = false;
let editorCurrentProfile = null;
let editorProfileData = { extraction_prompt: '', workflow: '', mappings: '' };
let editorOriginalNames = new Set();
let currentConfig = null;
let availableLLMModels = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadProfiles();
    populateAllProfileUIs();
    setupMobileCameraButton();
    
    DOM.profileSelect.addEventListener('change', handleProfileChange);
    DOM.profileSelectResult.addEventListener('change', handleProfileChange);
    
    DOM.navGenerate?.addEventListener('click', showGenerateView);
    DOM.navEditor?.addEventListener('click', showProfileEditor);
    DOM.navConfig?.addEventListener('click', showConfigEditor);
    DOM.refreshModelsBtn?.addEventListener('click', refreshLLMModels);
    DOM.saveConfigBtn?.addEventListener('click', saveConfig);    
    DOM.downloadAllBtn?.addEventListener('click', downloadAllProfiles);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchEditorTab(btn.dataset.tab);
        });
    });
});

// Load/refresh available profiles from backend
async function loadProfiles() {
    try {
        const response = await fetch('/api/profiles');
        const data = await response.json();
        
        if (data.profiles && data.profiles.length > 0) {
            availableProfiles = data.profiles;
            profilesLoaded = true;
        } else {
            showError('No profiles available');
        }
    } catch (err) {
        console.error('Failed to load profiles:', err);
        showError('Failed to load profiles. Please refresh the page.');
    }
}

function populateAllProfileUIs() {
    populateProfileSelects();
    populateEditorProfileList();
}

/**
 * Populate a select element with profile options.
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {Array} profiles - Array of profile objects with 'name' property
 * @param {Function} onSelect - Callback when first profile is selected (with profile name)
 */
function populateSelect(selectElement, profiles, onSelect) {
    selectElement.innerHTML = '';
    profiles.forEach((profile, index) => {
        const option = document.createElement('option');
        option.value = profile.name;
        option.textContent = profile.name;
        selectElement.appendChild(option);
        if (index === 0 && onSelect) {
            option.selected = true;
            onSelect(profile.name);
        }
    });
}

// Populate both profile selects from already-loaded data
function populateProfileSelects() {
    if (availableProfiles.length > 0) {
        populateSelect(DOM.profileSelect, availableProfiles, (name) => { currentProfile = name; });
        populateSelect(DOM.profileSelectResult, availableProfiles);
    }
}

// Populate LLM model select from already-loaded data
function populateModelSelect() {
    if (availableLLMModels.length > 0) {
        const modelOptions = availableLLMModels.map(m => ({name: m}));
        populateSelect(DOM.llmModel, modelOptions);
    }
}

// Profile selection change handler
function handleProfileChange(e) {
    currentProfile = e.target.value;
}

// Upload section click
DOM.uploadSection.addEventListener('click', () => DOM.fileInput.click());

// Drag and drop
const uploadSection = DOM.uploadSection;
uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadSection.classList.add('dragover');
});

uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('dragover');
});

uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Shared file input change handler
function handleInputChange(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

// File and camera input change handlers
DOM.fileInput.addEventListener('change', handleInputChange);
DOM.cameraInput.addEventListener('change', handleInputChange);

// Camera button click handler
DOM.cameraBtn.addEventListener('click', () => {
    DOM.cameraInput.click();
});

// Detect mobile device and show camera button
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function setupMobileCameraButton() {
    if (isMobileDevice()) {
        document.querySelector('.camera-button-container').style.display = 'flex';
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file (PNG or JPG)');
        return;
    }
    
    // Reset state
    resetState();
    
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.previewImage.src = e.target.result;
        DOM.previewImage.style.display = 'block';
        startProcessing();
    };
    reader.readAsDataURL(file);
}

function resetState() {
    selectedFile = null;
    currentSeed = null;
    DOM.promptText.value = '';
    DOM.previewImage.style.display = 'none';
    DOM.previewImage.src = '';
    DOM.resultImage.style.display = 'none';
    DOM.resultImage.src = '';
    DOM.regenerateBtn.disabled = true;
    hideNotification();
    resetProgress();
    DOM.fileInput.value = '';
    DOM.cameraInput.value = '';
    DOM.profileSelect.value = currentProfile || '';
    DOM.profileSelectResult.value = currentProfile || '';
}

// Image History Functions
function addToHistory(imageSrc, promptUsed) {
    // Check if image already exists in history
    const existingIndex = imageHistory.findIndex(item => item.src === imageSrc);
    
    if (existingIndex !== -1) {
        // Move to front if already exists
        const item = imageHistory.splice(existingIndex, 1)[0];
        imageHistory.unshift(item);
    } else {
        // Add new image to front with prompt and seed
        imageHistory.unshift({
            src: imageSrc,
            prompt: promptUsed,
            seed: currentSeed
        });
        
        // Remove oldest if exceeds max
        if (imageHistory.length > MAX_HISTORY) {
            imageHistory.pop();
        }
    }
    
    renderHistory();
}

function renderHistory() {
    DOM.historyContainer.innerHTML = '';
    
    imageHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item' + (index === 0 ? ' active' : '');
        
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = 'History image';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '✕';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeFromHistory(index);
        };
        
        historyItem.appendChild(img);
        historyItem.appendChild(removeBtn);
        
        historyItem.onclick = () => {
            // Load this image as the current result
            const resultImage = DOM.resultImage;
            resultImage.src = item.src;
            resultImage.onload = () => {
                resultImage.style.display = 'block';
                DOM.regenerateBtn.disabled = false;
            };
            
            // Restore prompt and seed if available
            if (item.prompt !== undefined) {
                DOM.promptText.value = item.prompt;
            }
            if (item.seed !== undefined) {
                currentSeed = item.seed;
            }
            
            // Update active state
            renderHistory();
        };
        
        DOM.historyContainer.appendChild(historyItem);
    });
}

function removeFromHistory(index) {
    imageHistory.splice(index, 1);
    renderHistory();
    if (index === 0) {
        DOM.resultImage.style.display = 'none';
        DOM.resultImage.src = '';
    }
}

function resetProgress() {
    DOM.progressFill.style.width = '0%';
    DOM.stepIndicator1.classList.add('active');
    DOM.stepIndicator1.classList.remove('completed');
    DOM.stepIndicator2.classList.remove('active', 'completed');
    DOM.stepIndicator3.classList.remove('active', 'completed');
}

// Screen navigation
function showScreen(screenNumber) {
    [DOM.screen1, DOM.screen2, DOM.screen3].forEach((screen, index) => {
        screen.classList.toggle('active', index + 1 === screenNumber);
    });
    if (screenNumber === 3) {
        DOM.profileSelectResult.value = currentProfile || '';
    }
}

// Start the processing flow (analyze + generate)
async function startProcessing() {
    if (!currentProfile) {
        showError('Please select a profile first');
        return;
    }
    
    if (!selectedFile) {
        showError('Please upload an image first');
        return;
    }
    
    isProcessing = true;
    showScreen(2);
    resetProgress();
    hideErrorActions();
    
    try {
        // Step 1: Analyze image
        await analyzeImage();
        
        // Step 2: Generate image
        await generateImage();
        
        // Step 3: Show result
        showScreen(3);
        DOM.progressFill.style.width = '100%';
        DOM.stepIndicator3.classList.add('active', 'completed');
        isProcessing = false;
        
    } catch (err) {
        console.error('Processing failed:', err);
        showError(err.message || 'Processing failed. Please try again.');
        isProcessing = false;
        showErrorActions();
    }
}

async function analyzeImage() {
    DOM.processingText.textContent = 'Analyzing image with LLM...';
    DOM.progressFill.style.width = '50%';
    DOM.stepIndicator2.classList.add('active');
    
    const data = await analyzeImageAPI(selectedFile, currentProfile);
    
    DOM.promptText.value = data.prompt;
    DOM.processingText.textContent = 'Generating image...';
}

/**
 * Generic API call helper with standardized error handling.
 * @param {string} endpoint - API endpoint URL
 * @param {FormData|Object} body - Request body
 * @param {Object} options - Additional fetch options
 * @param {string} errorPrefix - Prefix for error messages
 * @returns {Promise<Object>} Parsed JSON response
 */
async function apiCall(endpoint, body, options = {}, errorPrefix = 'Request') {
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
async function analyzeImageAPI(file, profile) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile', profile);
    return apiCall('/api/analyze', formData, {}, 'Analysis');
}

function generateRandomSeed() {
    // Simple random seed generation (not cryptographically secure)
    return Math.floor(Math.random() * 4294967295);
}

async function generateImage(upscale = false) {
    DOM.progressFill.style.width = '75%';
    
    const formData = new FormData();
    formData.append('prompt', DOM.promptText.value);
    formData.append('profile', currentProfile);
    formData.append('width', currentResolution.width);
    formData.append('height', currentResolution.height);
    
    if (!upscale) {
        const seed = generateRandomSeed();
        formData.append('seed', seed);
        currentSeed = seed;
    } else if (currentSeed !== null) {
        formData.append('seed', currentSeed);
    }
    
    if (upscale) {
        formData.append('upscale_switch', true);
        formData.append('upscale_resolution', upscaleResolution);
    }
    
    const data = await apiCall('/api/generate', formData, {}, 'Generation');
    
    const resultImage = DOM.resultImage;
    resultImage.src = data.image;
    resultImage.onload = () => {
        resultImage.style.display = 'block';
        DOM.regenerateBtn.disabled = false;
        DOM.progressFill.style.width = '100%';
        addToHistory(data.image, DOM.promptText.value);
    };
}

/**
 * Wrapper for async button handlers with common loading/error/disabled state management.
 * @param {HTMLElement} btn - The button element
 * @param {string} loadingText - Text to show in processing area
 * @param {string} completeText - Text to show on completion
 * @param {string} progressWidth - Progress bar width percentage
 * @param {Function} operation - Async function to execute
 * @param {string} errorMsg - Error message prefix
 */
function createAsyncHandler(btn, loadingText, completeText, progressWidth, operation, errorMsg) {
    return async () => {
        if (isProcessing) return;
        isProcessing = true;
        btn.disabled = true;
        try {
            DOM.processingText.textContent = loadingText;
            DOM.progressFill.style.width = progressWidth;
            await operation();
            DOM.processingText.textContent = completeText;
        } catch (err) {
            console.error(`${errorMsg} failed:`, err);
            showError(err.message || `${errorMsg} failed. Please try again.`);
        } finally {
            isProcessing = false;
            btn.disabled = false;
        }
    };
}

// Action button configurations - consolidated to reduce duplication
const ACTION_BUTTONS = [
    { btn: DOM.reanalyzeBtn, loading: 'Re-analyzing image with LLM...', complete: 'Analysis complete', progress: '100%', operation: async () => { DOM.stepIndicator2.classList.add('active'); const data = await analyzeImageAPI(selectedFile, currentProfile); DOM.promptText.value = data.prompt; }, error: 'Re-analysis' },
    { btn: DOM.regenerateBtn, loading: 'Generating image...', complete: 'Generation complete', progress: '75%', operation: () => generateImage(false), error: 'Regeneration' },
    { btn: DOM.upscaleBtn, loading: 'Upscaling image...', complete: 'Upscaling complete', progress: '75%', operation: () => generateImage(true), error: 'Upscaling' },
];

// Register action button event listeners
ACTION_BUTTONS.forEach(({ btn, loading, complete, progress, operation, error }) => {
    btn.addEventListener('click', createAsyncHandler(btn, loading, complete, progress, operation, error));
});

// Upscale resolution selector change handler
DOM.upscaleResolutionSelect.addEventListener('change', (e) => {
    upscaleResolution = parseInt(e.target.value, 10);
});

// New button handler
DOM.newBtn.addEventListener('click', () => {
    resetState();
    showScreen(1);
});

// Resolution selector change handler
DOM.resolutionSelect.addEventListener('change', (e) => {
    currentResolution = RESOLUTIONS[e.target.value] || { width: 768, height: 1024 };
});

// Download button handler
DOM.downloadBtn.addEventListener('click', () => {
    const resultImage = DOM.resultImage;
    if (resultImage.src) {
        const link = document.createElement('a');
        link.href = resultImage.src;
        link.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

// ============== Unified Notification System ==============

/**
 * Shows a notification (error or success) with automatic dismissal.
 * @param {string} message - The notification message
 * @param {'error'|'success'} type - Notification type
 * @param {number} duration - Auto-dismiss duration in milliseconds (0 to disable)
 */
function notify(message, type = 'error', duration = 3000) {
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    DOM.errorMessage.textContent = message;
    DOM.errorContainer.classList.add('show');
    DOM.errorContainer.classList.toggle('notification', type === 'success');
    
    if (duration > 0) {
        window.notificationTimeout = setTimeout(hideNotification, duration);
    }
}

/**
 * Hides the notification.
 */
function hideNotification() {
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    DOM.errorMessage.textContent = '';
    DOM.errorContainer.classList.remove('show', 'notification');
}

// Convenience wrappers
const showError = (msg, dur = 3000) => notify(msg, 'error', dur);
const showSuccess = (msg, dur = 3000) => notify(msg, 'success', dur);

// Error actions visibility
const showErrorActions = () => { DOM.errorActions.style.display = 'flex'; };
const hideErrorActions = () => { DOM.errorActions.style.display = 'none'; };

// Close notification handlers
DOM.errorClose.addEventListener('click', hideNotification);
document.addEventListener('click', (e) => {
    if (e.target === DOM.errorContainer) {
        hideNotification();
    }
});

// Try again button handler
DOM.tryAgainBtn.addEventListener('click', () => {
    hideErrorActions();
    hideNotification();
    startProcessing();
});

// Cancel button handler
DOM.cancelBtn.addEventListener('click', () => {
    hideErrorActions();
    hideNotification();
    resetState();
    showScreen(1);
});

// ============== Profile Editor Functions ==============

// Navigation functions
function showGenerateView() {
    switchView('generate', null, true);
}

function showProfileEditor() {
    switchView('generate', 'editor', true);
}

function showConfigEditor() {
    switchView(['generate', 'editor'], 'config', false);
    loadConfig();
}

// Navigation button event listeners (already set up above)

/**
 * Switch between main views (Generate, Profile Editor, Settings).
 * @param {string|string[]} hideViews - View(s) to hide ('generate', 'editor', 'config')
 * @param {string|null} showView - View to show ('generate', 'editor', 'config') or null for generate screen
 * @param {boolean} refreshProfiles - Whether to refresh profiles after switching
 */
function switchView(hideViews, showView, refreshProfiles) {
    const hideList = Array.isArray(hideViews) ? hideViews : [hideViews];
    
    // Update nav buttons
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
        loadProfiles().then(() => populateAllProfileUIs());
    }
}

// Load configuration from backend
async function loadConfig() {
    try {
        const response = await fetch('/api/config/providers');
        const data = await response.json();
        
        if (data.providers) {
            currentConfig = data.providers;
            DOM.comfyuiEndpoint.value = currentConfig.comfyui_endpoint || '';
            DOM.llmEndpoint.value = currentConfig.llm_endpoint || '';
            DOM.llmApiKey.value = currentConfig.llm_apikey || '';
            await refreshLLMModels();
            if (currentConfig.llm_model) {
                DOM.llmModel.value = currentConfig.llm_model;
            }
        }
    } catch (err) {
        console.error('Failed to load config:', err);
        showError('Failed to load configuration. Please refresh the page.');
    }
}

// Save configuration to backend
async function saveConfig() {
    const comfyuiEndpoint = DOM.comfyuiEndpoint.value.trim();
    const llmEndpoint = DOM.llmEndpoint.value.trim();
    const llmApiKey = DOM.llmApiKey.value.trim();
    const llmModel = DOM.llmModel.value;
    
    // Validate required fields
    if (!comfyuiEndpoint || !llmEndpoint || !llmApiKey || !llmModel) {
        showError('All fields are required');
        return;
    }
    
    const newConfig = {
        providers: {
            comfyui_endpoint: comfyuiEndpoint,
            llm_endpoint: llmEndpoint,
            llm_apikey: llmApiKey,
            llm_model: llmModel
        }
    };
    
    try {
        const response = await fetch('/api/config/providers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newConfig)
        });
        
        if (response.ok) {
            currentConfig = newConfig.providers;
            showSuccess('Configuration saved successfully!');
        } else {
            const error = await response.json();
            showError(error.detail || 'Failed to save configuration');
        }
    } catch (err) {
        console.error('Failed to save config:', err);
        showError('Failed to save configuration. Please try again.');
    }
}

// Refresh LLM models from the backend

// ============== Profile Editor Helper Functions ==============

// Profile editor button event listeners
DOM.saveProfileBtn.addEventListener('click', saveCurrentProfile);
DOM.duplicateProfileBtn.addEventListener('click', duplicateCurrentProfile);
DOM.renameProfileBtn.addEventListener('click', renameCurrentProfile);
DOM.deleteProfileBtn.addEventListener('click', deleteCurrentProfile);

/**
 * Refresh profiles and update all UIs, with optional callback.
 * @param {Function} [extraCallback] - Optional callback to run after refresh
 */
async function refreshProfilesAndUI(extraCallback = null) {
    await loadProfiles();
    populateAllProfileUIs();
    if (extraCallback) extraCallback();
}

/**
 * Handle API response for profile operations.
 * @param {Response} response - The fetch response
 * @param {string} successMessage - Message to show on success
 * @param {string} operationName - Name of the operation for error messages
 * @returns {Promise<boolean>} True if successful
 */
async function handleApiResponse(response, successMessage, operationName) {
    const data = await response.json();
    if (response.ok) {
        showSuccess(successMessage);
        return true;
    } else {
        showError(data.detail || `${operationName} failed`);
        return false;
    }
}

/**
 * Prompt user for a new name, validating it's different from current.
 * @param {string} currentName - The current profile name
 * @param {string} promptText - The prompt to display
 * @returns {string|null} The new name or null if cancelled/invalid
 */
function promptForName(currentName, promptText) {
    const newName = prompt(promptText);
    if (!newName) return null;
    if (newName === currentName) {
        showError('New name must be different from current profile');
        return null;
    }
    return newName;
}
async function refreshLLMModels() {
    const modelSelect = DOM.llmModel;
    modelSelect.innerHTML = '<option value="">Loading models...</option>';
    
    try {
        const response = await fetch('/api/config/models');
        
        if (response.ok) {
            const data = await response.json();
            availableLLMModels = data.models || [];
            modelSelect.innerHTML = '';
            if (availableLLMModels.length > 0) {
                const modelOptions = availableLLMModels.map(m => ({name: m}));
                populateSelect(modelSelect, modelOptions);
            } else {
                modelSelect.innerHTML = '<option value="">No models found</option>';
            }
        } else {
            const error = await response.json();
            modelSelect.innerHTML = '<option value="">Failed to load models</option>';
            console.error('Failed to fetch models:', error.detail);
            showError(error.detail || 'Failed to load LLM models. Check the LLM endpoint.');
        }
    } catch (err) {
        console.error('Failed to fetch LLM models:', err);
        DOM.llmModel.innerHTML = '<option value="">Failed to load models</option>';
        showError('Failed to load LLM models. Check the LLM endpoint.');
    }
}

// Populate editor profile list from already-loaded data
function populateEditorProfileList() {
    const profileList = DOM.profileList;
    profileList.innerHTML = '';
    
    if (availableProfiles.length > 0) {
        editorOriginalNames.clear();
        availableProfiles.forEach(profile => {
            editorOriginalNames.add(profile.name);
            const profileItem = document.createElement('div');
            profileItem.className = 'profile-item';
            profileItem.dataset.name = profile.name;
            profileItem.innerHTML = `
                <span class="profile-name">${profile.name}</span>
                <button class="profile-item-btn" onclick="downloadProfile('${profile.name}')">↓</button>
            `;
            profileItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('profile-item-btn')) {
                    selectProfileForEdit(profile.name);
                }
            });
            profileList.appendChild(profileItem);
        });
    }
}

// Select a profile for editing
async function selectProfileForEdit(profileName) {
    document.querySelectorAll('.profile-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.name === profileName) {
            item.classList.add('selected');
        }
    });
    
    editorCurrentProfile = profileName;
    DOM.editorProfileName.textContent = profileName;
    DOM.saveProfileBtn.disabled = false;
    DOM.duplicateProfileBtn.disabled = false;
    DOM.renameProfileBtn.disabled = false;
    DOM.deleteProfileBtn.disabled = false;
    DOM.editorTabs.style.display = 'flex';
    DOM.editorContent.style.display = 'block';
    DOM.editorPlaceholder.style.display = 'none';
    
    try {
        const response = await fetch(`/api/profile-editor/profile/${encodeURIComponent(profileName)}`);
        const data = await response.json();
        
        editorProfileData.extraction_prompt = data.extraction_prompt || '';
        editorProfileData.workflow = data.workflow || '{}';
        editorProfileData.mappings = data.mappings || '{}';
        
        DOM.extractionPromptEditor.value = editorProfileData.extraction_prompt;
        DOM.workflowEditor.value = editorProfileData.workflow;
        DOM.mappingsEditor.value = editorProfileData.mappings;
        switchEditorTab('extraction_prompt');
    } catch (err) {
        console.error('Failed to load profile content:', err);
        showError('Failed to load profile content');
    }
}

// Tab switching
function switchEditorTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Map tab names to DOM object keys
    const tabMap = {
        extraction_prompt: 'extractionPromptEditor',
        workflow: 'workflowEditor',
        mappings: 'mappingsEditor'
    };
    
    // Hide all editors, show selected
    document.querySelectorAll('.editor-textarea').forEach(el => {
        el.style.display = 'none';
    });
    
    const domKey = tabMap[tabName];
    if (domKey && DOM[domKey]) {
        DOM[domKey].style.display = 'block';
    }
}

// Setup tab button listeners (merged into main DOMContentLoaded)

// Profile operation configurations
const PROFILE_OPERATIONS = {
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
        onsuccess: () => !editorOriginalNames.has(editorCurrentProfile) ? refreshProfilesAndUI() : null
    },
    duplicate: {
        endpoint: '/api/profile-editor/profile/duplicate',
        method: 'POST',
        successMsg: 'Profile duplicated successfully',
        prompt: (name) => `Enter new name for duplicate of "${name}":`,
        buildPayload: (name, newName) => ({ source_name: name, new_name: newName }),
        onsuccess: (newName) => refreshProfilesAndUI(() => selectProfileForEdit(newName))
    },
    rename: {
        endpoint: '/api/profile-editor/profile/rename',
        method: 'POST',
        successMsg: 'Profile renamed successfully',
        prompt: (name) => `Enter new name for "${name}":`,
        validate: (newName) => {
            if (editorOriginalNames.has(newName)) {
                showError('A profile with this name already exists');
                return false;
            }
            return true;
        },
        buildPayload: (name, newName) => ({ old_name: name, new_name: newName }),
        onsuccess: (newName) => {
            editorCurrentProfile = newName;
            refreshProfilesAndUI(() => { DOM.editorProfileName.textContent = newName; });
        }
    },
    delete: {
        endpoint: (name) => `/api/profile-editor/profile/${encodeURIComponent(name)}`,
        method: 'DELETE',
        successMsg: 'Profile deleted successfully',
        confirm: (name) => `Are you sure you want to delete profile "${name}"? This action cannot be undone.`,
        buildPayload: (name) => ({ name }),
        onsuccess: () => {
            editorCurrentProfile = null;
            editorProfileData = { extraction_prompt: '', workflow: '', mappings: '' };
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
            refreshProfilesAndUI();
        }
    }
};

// Generic profile operation handler
async function executeProfileOperation(operationKey) {
    if (!editorCurrentProfile) return;
    
    const op = PROFILE_OPERATIONS[operationKey];
    
    // Handle confirmation dialog (for destructive operations like delete)
    if (op.confirm && !confirm(op.confirm(editorCurrentProfile))) {
        return;
    }
    
    // Handle name prompt (for operations that require a new name)
    const newName = op.prompt ? promptForName(editorCurrentProfile, op.prompt(editorCurrentProfile)) : null;
    if (newName === null && op.prompt) return;
    if (op.validate && newName && !op.validate(newName)) return;
    
    const payload = op.buildPayload(editorCurrentProfile, newName);
    const endpoint = typeof op.endpoint === 'function' ? op.endpoint(editorCurrentProfile) : op.endpoint;
    const response = await fetch(endpoint, {
        method: op.method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    const success = await handleApiResponse(response, op.successMsg, op.successMsg);
    if (success && op.onsuccess) {
        await op.onsuccess(newName);
    }
}

// Save current profile
async function saveCurrentProfile() {
    await executeProfileOperation('save');
}

// Duplicate current profile
async function duplicateCurrentProfile() {
    await executeProfileOperation('duplicate');
}

// Rename current profile
async function renameCurrentProfile() {
    await executeProfileOperation('rename');
}

// Delete current profile
async function deleteCurrentProfile() {
    await executeProfileOperation('delete');
}

// Download all profiles
function downloadAllProfiles() {
    window.location.href = '/api/profile-editor/download-all';
}

// Helper: Download a specific profile by name
function downloadProfile(profileName) {
    window.location.href = `/api/profile-editor/download/${encodeURIComponent(profileName)}`;
}

