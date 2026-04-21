// Image Generator Frontend
// Streamlined single-screen flow with auto-trigger analysis and generation

// DOM Element Registry
const $ = {
    profileSelect: () => document.getElementById('profileSelect'),
    profileSelectResult: () => document.getElementById('profileSelectResult'),
    uploadSection: () => document.getElementById('uploadSection'),
    fileInput: () => document.getElementById('fileInput'),
    cameraInput: () => document.getElementById('cameraInput'),
    cameraBtn: () => document.getElementById('cameraBtn'),
    previewImage: () => document.getElementById('previewImage'),
    newBtn: () => document.getElementById('newBtn'),
    reanalyzeBtn: () => document.getElementById('reanalyzeBtn'),
    regenerateBtn: () => document.getElementById('regenerateBtn'),
    upscaleBtn: () => document.getElementById('upscaleBtn'),
    promptText: () => document.getElementById('promptText'),
    resolutionSelect: () => document.getElementById('resolutionSelect'),
    upscaleResolutionSelect: () => document.getElementById('upscaleResolutionSelect'),
    errorContainer: () => document.getElementById('errorContainer'),
    errorMessage: () => document.getElementById('errorMessage'),
    errorClose: () => document.getElementById('errorClose'),
    tryAgainBtn: () => document.getElementById('tryAgainBtn'),
    cancelBtn: () => document.getElementById('cancelBtn'),
    errorActions: () => document.getElementById('errorActions'),
    downloadBtn: () => document.getElementById('downloadBtn'),
    configEditorContainer: () => document.getElementById('configEditorContainer'),
    comfyuiEndpoint: () => document.getElementById('comfyuiEndpoint'),
    llmEndpoint: () => document.getElementById('llmEndpoint'),
    llmApiKey: () => document.getElementById('llmApiKey'),
    llmModel: () => document.getElementById('llmModel'),
    refreshModelsBtn: () => document.getElementById('refreshModelsBtn'),
    saveConfigBtn: () => document.getElementById('saveConfigBtn'),
    progressFill: () => document.getElementById('progressFill'),
    stepIndicator1: () => document.getElementById('stepIndicator1'),
    stepIndicator2: () => document.getElementById('stepIndicator2'),
    stepIndicator3: () => document.getElementById('stepIndicator3'),
    processingText: () => document.getElementById('processingText'),
    screen1: () => document.getElementById('screen1'),
    screen2: () => document.getElementById('screen2'),
    screen3: () => document.getElementById('screen3'),
    historyContainer: () => document.getElementById('historyContainer'),
    resultImage: () => document.getElementById('resultImage'),
    profileEditorContainer: () => document.getElementById('profileEditorContainer'),
    profileList: () => document.getElementById('profileList'),
    editorProfileName: () => document.getElementById('editorProfileName'),
    editorTabs: () => document.getElementById('editorTabs'),
    editorContent: () => document.getElementById('editorContent'),
    editorPlaceholder: () => document.getElementById('editorPlaceholder'),
    extractionPromptEditor: () => document.getElementById('extractionPromptEditor'),
    workflowEditor: () => document.getElementById('workflowEditor'),
    mappingsEditor: () => document.getElementById('mappingsEditor'),
    saveProfileBtn: () => document.getElementById('saveProfileBtn'),
    duplicateProfileBtn: () => document.getElementById('duplicateProfileBtn'),
    renameProfileBtn: () => document.getElementById('renameProfileBtn'),
    deleteProfileBtn: () => document.getElementById('deleteProfileBtn'),
    downloadAllBtn: () => document.getElementById('downloadAllBtn'),
    navGenerate: () => document.getElementById('navGenerate'),
    navEditor: () => document.getElementById('navEditor'),
    navConfig: () => document.getElementById('navConfig'),
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
    const refreshModelsBtn = $.refreshModelsBtn();
    const saveConfigBtn = $.saveConfigBtn();
    if (refreshModelsBtn) {
        refreshModelsBtn.addEventListener('click', refreshLLMModels);
    }
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', saveConfig);
    }
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
        populateSelect(profileSelect, availableProfiles, (name) => { currentProfile = name; });
        populateSelect($.profileSelectResult(), availableProfiles);
    }
}

// Profile selection change handler
function handleProfileChange(e) {
    currentProfile = e.target.value;
}

$.profileSelect().addEventListener('change', handleProfileChange);
$.profileSelectResult().addEventListener('change', handleProfileChange);

// Upload section click
$.uploadSection().addEventListener('click', () => $.fileInput().click());

// Drag and drop
const uploadSection = $.uploadSection();
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

// File input change
const fileInput = $.fileInput();
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Camera input change handler
const cameraInput = $.cameraInput();
cameraInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Camera button click handler
const cameraBtn = $.cameraBtn();
cameraBtn.addEventListener('click', () => {
    cameraInput.click();
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
        $.previewImage().src = e.target.result;
        $.previewImage().style.display = 'block';
        startProcessing();
    };
    reader.readAsDataURL(file);
}

function resetState() {
    selectedFile = null;
    currentSeed = null;
    $.promptText().value = '';
    $.previewImage().style.display = 'none';
    $.previewImage().src = '';
    $.resultImage().style.display = 'none';
    $.resultImage().src = '';
    $.regenerateBtn().disabled = true;
    hideNotification();
    resetProgress();
    $.fileInput().value = '';
    $.cameraInput().value = '';
    $.profileSelect().value = currentProfile || '';
    $.profileSelectResult().value = currentProfile || '';
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
    historyContainer.innerHTML = '';
    
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
            const resultImage = document.getElementById('resultImage');
            resultImage.src = item.src;
            resultImage.onload = () => {
                resultImage.style.display = 'block';
                regenerateBtn.disabled = false;
            };
            
            // Restore prompt and seed if available
            if (item.prompt !== undefined) {
                promptText.value = item.prompt;
            }
            if (item.seed !== undefined) {
                currentSeed = item.seed;
            }
            
            // Update active state
            renderHistory();
        };
        
        historyContainer.appendChild(historyItem);
    });
}

function removeFromHistory(index) {
    imageHistory.splice(index, 1);
    renderHistory();
    if (index === 0) {
        $.resultImage().style.display = 'none';
        $.resultImage().src = '';
    }
}

function resetProgress() {
    $.progressFill().style.width = '0%';
    $.stepIndicator1().classList.add('active');
    $.stepIndicator1().classList.remove('completed');
    $.stepIndicator2().classList.remove('active', 'completed');
    $.stepIndicator3().classList.remove('active', 'completed');
}

// Screen navigation
function showScreen(screenNumber) {
    [$.screen1(), $.screen2(), $.screen3()].forEach((screen, index) => {
        screen.classList.toggle('active', index + 1 === screenNumber);
    });
    if (screenNumber === 3) {
        $.profileSelectResult().value = currentProfile || '';
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
        progressFill.style.width = '100%';
        stepIndicator3.classList.add('active', 'completed');
        isProcessing = false;
        
    } catch (err) {
        console.error('Processing failed:', err);
        showError(err.message || 'Processing failed. Please try again.');
        isProcessing = false;
        showErrorActions();
    }
}

async function analyzeImage() {
    processingText.textContent = 'Analyzing image with LLM...';
    progressFill.style.width = '50%';
    stepIndicator2.classList.add('active');
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('profile', currentProfile);
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Use error_reason if provided, otherwise fall back to detail
            const errorMessage = data.error_reason || data.detail || 'Analysis failed';
            throw new Error(errorMessage);
        }
        
        $.promptText().value = data.prompt;
        $.processingText().textContent = 'Generating image...';
        
    } catch (err) {
        throw err;
    }
}

function generateRandomSeed() {
    // Simple random seed generation (not cryptographically secure)
    return Math.floor(Math.random() * 4294967295);
}

async function generateImage(upscale = false) {
    $.progressFill().style.width = '75%';
    
    const formData = new FormData();
    formData.append('prompt', $.promptText().value);
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
        
        const resultImage = $.resultImage();
        resultImage.src = data.image;
        resultImage.onload = () => {
            resultImage.style.display = 'block';
            $.regenerateBtn().disabled = false;
            $.progressFill().style.width = '100%';
            addToHistory(data.image, $.promptText().value);
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
            $.processingText().textContent = loadingText;
            $.progressFill().style.width = progressWidth;
            await operation();
            $.processingText().textContent = completeText;
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
$.reanalyzeBtn().addEventListener('click', createAsyncHandler(
    $.reanalyzeBtn(),
    'Re-analyzing image with LLM...',
    'Analysis complete',
    '100%',
    async () => {
        $.stepIndicator2().classList.add('active');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('profile', currentProfile);
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            const errorMessage = data.detail || 'Analysis failed';
            throw new Error(errorMessage);
        }
        
        $.promptText().value = data.prompt;
    },
    'Re-analysis'
));

// Regenerate button handler
$.regenerateBtn().addEventListener('click', createAsyncHandler(
    $.regenerateBtn(),
    'Generating image...',
    'Generation complete',
    '75%',
    () => generateImage(false),
    'Regeneration'
));

// Upscale button handler
$.upscaleBtn().addEventListener('click', createAsyncHandler(
    $.upscaleBtn(),
    'Upscaling image...',
    'Upscaling complete',
    '75%',
    () => generateImage(true),
    'Upscaling'
));

// Upscale resolution selector change handler
$.upscaleResolutionSelect().addEventListener('change', (e) => {
    upscaleResolution = parseInt(e.target.value, 10);
});

// New button handler
$.newBtn().addEventListener('click', () => {
    resetState();
    showScreen(1);
});

// Resolution selector change handler
$.resolutionSelect().addEventListener('change', (e) => {
    const [width, height] = e.target.value.split('x').map(Number);
    currentResolution = { width, height };
});

// Download button handler
$.downloadBtn().addEventListener('click', () => {
    const resultImage = $.resultImage();
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
 * Shows a notification (error or success) with automatic dismissal
 * @param {string} message - The notification message
 * @param {boolean} isSuccess - If true, shows as success notification; otherwise shows as error
 * @param {number} duration - Auto-dismiss duration in milliseconds (0 to disable auto-dismiss)
 */
function showNotification(message, isSuccess = false, duration = 3000) {
    const errorContainer = $.errorContainer();
    const errorMessage = $.errorMessage();
    const errorClose = $.errorClose();
    
    // Clear any existing timeout
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    // Set message and styling based on type
    errorMessage.textContent = message;
    if (isSuccess) {
        errorMessage.style.color = ''; // Will use CSS class for color
        errorContainer.classList.add('notification');
        errorClose.style.color = ''; // Will use CSS class for color
    } else {
        errorMessage.style.color = ''; // Will use CSS class for color
        errorContainer.classList.remove('notification');
        errorClose.style.color = ''; // Will use CSS class for color
    }
    
    // Show the notification
    errorContainer.classList.add('show');
    
    // Auto-dismiss after duration (if specified)
    if (duration > 0) {
        window.notificationTimeout = setTimeout(() => {
            hideNotification();
        }, duration);
    }
}

/**
 * Hides the notification
 */
function hideNotification() {
    const errorContainer = $.errorContainer();
    const errorMessage = $.errorMessage();
    const errorClose = $.errorClose();
    
    // Clear any existing timeout
    if (window.notificationTimeout) {
        clearTimeout(window.notificationTimeout);
    }
    
    errorMessage.textContent = '';
    errorContainer.classList.remove('show', 'notification');
    // Remove inline color styles to let CSS classes take over
    if (errorMessage.style.color) {
        errorMessage.style.removeProperty('color');
    }
    if (errorClose.style.color) {
        errorClose.style.removeProperty('color');
    }
}

/**
 * Shows error notification (alias for showNotification with isSuccess=false)
 * @param {string} message - The error message
 * @param {number} duration - Auto-dismiss duration in milliseconds (0 to disable auto-dismiss)
 */
function showError(message, duration = 3000) {
    showNotification(message, false, duration);
}

/**
 * Shows success notification (alias for showNotification with isSuccess=true)
 * @param {string} message - The success message
 * @param {number} duration - Auto-dismiss duration in milliseconds (0 to disable auto-dismiss)
 */
function showSuccess(message, duration = 3000) {
    showNotification(message, true, duration);
}

// Close notification on X button click
$.errorClose().addEventListener('click', hideNotification);

// Close notification on click outside
document.addEventListener('click', (e) => {
    if (e.target === $.errorContainer()) {
        hideNotification();
    }
});

// Error actions (Try Again / Cancel buttons) - only shown for errors, not success
function showErrorActions() {
    $.errorActions().style.display = 'flex';
}

function hideErrorActions() {
    $.errorActions().style.display = 'none';
}

// Try again button handler
$.tryAgainBtn().addEventListener('click', () => {
    hideErrorActions();
    hideNotification();
    startProcessing();
});

// Cancel button handler
$.cancelBtn().addEventListener('click', () => {
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
    
    $.navGenerate()?.classList.toggle('active', isActiveGenerate);
    $.navEditor()?.classList.toggle('active', isActiveEditor);
    $.navConfig()?.classList.toggle('active', isActiveConfig);
    
    $.screen1().parentElement.style.display = showView === null ? 'block' : 'none';
    $.profileEditorContainer().style.display = showView === 'editor' ? 'flex' : 'none';
    $.configEditorContainer().style.display = showView === 'config' ? 'block' : 'none';
    
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
            $.comfyuiEndpoint().value = currentConfig.comfyui_endpoint || '';
            $.llmEndpoint().value = currentConfig.llm_endpoint || '';
            $.llmApiKey().value = currentConfig.llm_apikey || '';
            await refreshLLMModels();
            if (currentConfig.llm_model) {
                $.llmModel().value = currentConfig.llm_model;
            }
        }
    } catch (err) {
        console.error('Failed to load config:', err);
        showError('Failed to load configuration. Please refresh the page.');
    }
}

// Save configuration to backend
async function saveConfig() {
    const comfyuiEndpoint = $.comfyuiEndpoint().value.trim();
    const llmEndpoint = $.llmEndpoint().value.trim();
    const llmApiKey = $.llmApiKey().value.trim();
    const llmModel = $.llmModel().value;
    
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
async function refreshLLMModels() {
    const modelSelect = $.llmModel();
    modelSelect.innerHTML = '<option value="">Loading models...</option>';
    
    try {
        const response = await fetch('/api/config/models');
        
        if (response.ok) {
            const data = await response.json();
            availableLLMModels = data.models || [];
            modelSelect.innerHTML = '';
            if (availableLLMModels.length > 0) {
                availableLLMModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    modelSelect.appendChild(option);
                });
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
        $.llmModel().innerHTML = '<option value="">Failed to load models</option>';
        showError('Failed to load LLM models. Check the LLM endpoint.');
    }
}

// Populate editor profile list from already-loaded data
function populateEditorProfileList() {
    const profileList = $.profileList();
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
    $.editorProfileName().textContent = profileName;
    $.saveProfileBtn().disabled = false;
    $.duplicateProfileBtn().disabled = false;
    $.renameProfileBtn().disabled = false;
    $.deleteProfileBtn().disabled = false;
    $.editorTabs().style.display = 'flex';
    $.editorContent().style.display = 'block';
    $.editorPlaceholder().style.display = 'none';
    
    try {
        const response = await fetch(`/api/profile-editor/profile/${encodeURIComponent(profileName)}`);
        const data = await response.json();
        
        editorProfileData.extraction_prompt = data.extraction_prompt || '';
        editorProfileData.workflow = data.workflow || '{}';
        editorProfileData.mappings = data.mappings || '{}';
        
        $.extractionPromptEditor().value = editorProfileData.extraction_prompt;
        $.workflowEditor().value = editorProfileData.workflow;
        $.mappingsEditor().value = editorProfileData.mappings;
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
    
    // Map tab names to $ method names
    const methodNames = {
        extraction_prompt: 'extractionPromptEditor',
        workflow: 'workflowEditor',
        mappings: 'mappingsEditor'
    };
    
    // Hide all editors, show selected
    document.querySelectorAll('.editor-textarea').forEach(el => {
        el.style.display = 'none';
    });
    
    const methodName = methodNames[tabName];
    if (methodName && $[methodName]) {
        const editorEl = $[methodName]();
        if (editorEl) {
            editorEl.style.display = 'block';
        }
    }
}

// Setup tab button listeners
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchEditorTab(btn.dataset.tab);
        });
    });
});

// Save current profile
async function saveCurrentProfile() {
    if (!editorCurrentProfile) return;
    const payload = {
        name: editorCurrentProfile,
        extraction_prompt: $.extractionPromptEditor().value,
        workflow: $.workflowEditor().value,
        mappings: $.mappingsEditor().value
    };
    
    try {
        const response = await fetch('/api/profile-editor/profile', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Profile saved successfully');
            // Refresh profiles and update all UIs if name changed
            if (!editorOriginalNames.has(editorCurrentProfile)) {
                loadProfiles().then(() => populateAllProfileUIs());
            }
        } else {
            showError(data.detail || 'Failed to save profile');
        }
    } catch (err) {
        console.error('Failed to save profile:', err);
        showError('Failed to save profile');
    }
}

// Duplicate current profile
async function duplicateCurrentProfile() {
    if (!editorCurrentProfile) return;
    
    const newName = prompt(`Enter new name for duplicate of "${editorCurrentProfile}":`);
    if (!newName || newName === editorCurrentProfile) {
        if (newName === editorCurrentProfile) {
            showError('New name must be different from current profile');
        }
        return;
    }
    
    try {
        const response = await fetch('/api/profile-editor/profile/duplicate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                source_name: editorCurrentProfile,
                new_name: newName
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Profile duplicated successfully');
            loadProfiles().then(() => {
                populateAllProfileUIs();
                selectProfileForEdit(newName);
            });
        } else {
            showError(data.detail || 'Failed to duplicate profile');
        }
    } catch (err) {
        console.error('Failed to duplicate profile:', err);
        showError('Failed to duplicate profile');
    }
}

// Rename current profile
async function renameCurrentProfile() {
    if (!editorCurrentProfile) return;
    
    const newName = prompt(`Enter new name for "${editorCurrentProfile}":`);
    if (!newName || newName === editorCurrentProfile) {
        if (newName === editorCurrentProfile) {
            showError('New name must be different from current profile');
        }
        return;
    }
    
    // Check if name already exists
    if (editorOriginalNames.has(newName)) {
        showError('A profile with this name already exists');
        return;
    }
    
    try {
        const response = await fetch('/api/profile-editor/profile/rename', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                old_name: editorCurrentProfile,
                new_name: newName
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Profile renamed successfully');
            editorCurrentProfile = newName;
            loadProfiles().then(() => {
                populateAllProfileUIs();
                $.editorProfileName().textContent = newName;
            });
        } else {
            showError(data.detail || 'Failed to rename profile');
        }
    } catch (err) {
        console.error('Failed to rename profile:', err);
        showError('Failed to rename profile');
    }
}

// Delete current profile
async function deleteCurrentProfile() {
    if (!editorCurrentProfile) return;
    if (!confirm(`Are you sure you want to delete profile "${editorCurrentProfile}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/profile-editor/profile/${encodeURIComponent(editorCurrentProfile)}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Profile deleted successfully');
            editorCurrentProfile = null;
            editorProfileData = { extraction_prompt: '', workflow: '', mappings: '' };
            $.editorProfileName().textContent = 'Select a profile';
            $.saveProfileBtn().disabled = true;
            $.duplicateProfileBtn().disabled = true;
            $.renameProfileBtn().disabled = true;
            $.deleteProfileBtn().disabled = true;
            $.editorTabs().style.display = 'none';
            $.editorContent().style.display = 'none';
            $.editorPlaceholder().style.display = 'block';
            $.extractionPromptEditor().value = '';
            $.workflowEditor().value = '';
            $.mappingsEditor().value = '';
            document.querySelectorAll('.profile-item').forEach(item => {
                item.classList.remove('selected');
            });
            loadProfiles().then(() => populateAllProfileUIs());
        } else {
            showError(data.detail || 'Failed to delete profile');
        }
    } catch (err) {
        console.error('Failed to delete profile:', err);
        showError('Failed to delete profile');
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

