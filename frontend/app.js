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

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadProfiles();
    populateAllProfileUIs();
    setupMobileCameraButton();
    
    // Setup config editor event listeners
    if (DOM.refreshModelsBtn) {
        DOM.refreshModelsBtn.addEventListener('click', refreshLLMModels);
    }
    if (DOM.saveConfigBtn) {
        DOM.saveConfigBtn.addEventListener('click', saveConfig);
    }
    
    // Setup tab button listeners
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

// Populate all profile UIs from already-loaded data
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

DOM.profileSelect.addEventListener('change', handleProfileChange);
DOM.profileSelectResult.addEventListener('change', handleProfileChange);

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
 * Analyze an image via the /api/analyze endpoint.
 * @param {File} file - The image file to analyze
 * @param {string} profile - The profile name
 * @returns {Promise<{prompt: string}>}
 */
async function analyzeImageAPI(file, profile) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile', profile);
    
    const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        const errorMessage = data.error_reason || data.detail || 'Analysis failed';
        throw new Error(errorMessage);
    }
    
    return data;
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
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Generation failed');
        }
        
        const resultImage = DOM.resultImage;
        resultImage.src = data.image;
        resultImage.onload = () => {
            resultImage.style.display = 'block';
            DOM.regenerateBtn.disabled = false;
            DOM.progressFill.style.width = '100%';
            addToHistory(data.image, DOM.promptText.value);
        };
        
    } catch (err) {
        throw err;
    }
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

// Re-analyze button handler
DOM.reanalyzeBtn.addEventListener('click', createAsyncHandler(
    DOM.reanalyzeBtn,
    'Re-analyzing image with LLM...',
    'Analysis complete',
    '100%',
    async () => {
        DOM.stepIndicator2.classList.add('active');
        const data = await analyzeImageAPI(selectedFile, currentProfile);
        DOM.promptText.value = data.prompt;
    },
    'Re-analysis'
));

// Regenerate button handler
DOM.regenerateBtn.addEventListener('click', createAsyncHandler(
    DOM.regenerateBtn,
    'Generating image...',
    'Generation complete',
    '75%',
    () => generateImage(false),
    'Regeneration'
));

// Upscale button handler
DOM.upscaleBtn.addEventListener('click', createAsyncHandler(
    DOM.upscaleBtn,
    'Upscaling image...',
    'Upscaling complete',
    '75%',
    () => generateImage(true),
    'Upscaling'
));

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
    const [width, height] = e.target.value.split('x').map(Number);
    currentResolution = { width, height };
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
function showNotification(message, type = 'error', duration = 3000) {
    const container = DOM.errorContainer;
    const messageEl = DOM.errorMessage;
    
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    messageEl.textContent = message;
    container.classList.add('show');
    container.classList.toggle('notification', type === 'success');
    
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

/**
 * Shows error notification.
 * @param {string} message - The error message
 * @param {number} duration - Auto-dismiss duration in milliseconds
 */
function showError(message, duration = 3000) {
    showNotification(message, 'error', duration);
}

/**
 * Shows success notification.
 * @param {string} message - The success message
 * @param {number} duration - Auto-dismiss duration in milliseconds
 */
function showSuccess(message, duration = 3000) {
    showNotification(message, 'success', duration);
}

// Close notification on X button click
DOM.errorClose.addEventListener('click', hideNotification);

// Close notification on click outside
document.addEventListener('click', (e) => {
    if (e.target === DOM.errorContainer) {
        hideNotification();
    }
});

// Error actions (Try Again / Cancel buttons) - only shown for errors, not success
function showErrorActions() {
    DOM.errorActions.style.display = 'flex';
}

function hideErrorActions() {
    DOM.errorActions.style.display = 'none';
}

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

// Save current profile
async function saveCurrentProfile() {
    if (!editorCurrentProfile) return;
    const payload = {
        name: editorCurrentProfile,
        extraction_prompt: DOM.extractionPromptEditor.value,
        workflow: DOM.workflowEditor.value,
        mappings: DOM.mappingsEditor.value
    };
    
    const response = await fetch('/api/profile-editor/profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    const success = await handleApiResponse(response, 'Profile saved successfully', 'Save profile');
    
    if (success && !editorOriginalNames.has(editorCurrentProfile)) {
        await refreshProfilesAndUI();
    }
}

// Duplicate current profile
async function duplicateCurrentProfile() {
    if (!editorCurrentProfile) return;
    
    const newName = promptForName(editorCurrentProfile, `Enter new name for duplicate of "${editorCurrentProfile}":`);
    if (!newName) return;
    
    const response = await fetch('/api/profile-editor/profile/duplicate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            source_name: editorCurrentProfile,
            new_name: newName
        })
    });
    
    const success = await handleApiResponse(response, 'Profile duplicated successfully', 'Duplicate profile');
    
    if (success) {
        await refreshProfilesAndUI(() => selectProfileForEdit(newName));
    }
}

// Rename current profile
async function renameCurrentProfile() {
    if (!editorCurrentProfile) return;
    
    const newName = promptForName(editorCurrentProfile, `Enter new name for "${editorCurrentProfile}":`);
    if (!newName) return;
    
    // Check if name already exists
    if (editorOriginalNames.has(newName)) {
        showError('A profile with this name already exists');
        return;
    }
    
    const response = await fetch('/api/profile-editor/profile/rename', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            old_name: editorCurrentProfile,
            new_name: newName
        })
    });
    
    const success = await handleApiResponse(response, 'Profile renamed successfully', 'Rename profile');
    
    if (success) {
        editorCurrentProfile = newName;
        await refreshProfilesAndUI(() => {
            DOM.editorProfileName.textContent = newName;
        });
    }
}

// Delete current profile
async function deleteCurrentProfile() {
    if (!editorCurrentProfile) return;
    if (!confirm(`Are you sure you want to delete profile "${editorCurrentProfile}"? This action cannot be undone.`)) {
        return;
    }
    
    const response = await fetch(`/api/profile-editor/profile/${encodeURIComponent(editorCurrentProfile)}`, {
        method: 'DELETE'
    });
    
    const success = await handleApiResponse(response, 'Profile deleted successfully', 'Delete profile');
    
    if (success) {
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
        await refreshProfilesAndUI();
    }
}

// Download all profiles
function downloadAllProfiles() {
    window.location.href = '/api/profile-editor/download-all';
}

// Helper: Download a specific profile by name
function downloadProfile(profileName) {
    window.location.href = `/api/profile-editor/download/${encodeURIComponent(profileName)}`;
}

