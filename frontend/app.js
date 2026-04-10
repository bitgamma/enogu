// Image Generator Frontend
// Streamlined single-screen flow with auto-trigger analysis and generation

// DOM Elements
const profileSelect = document.getElementById('profileSelect');
const profileSelectResult = document.getElementById('profileSelectResult');
const uploadSection = document.getElementById('uploadSection');
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const cameraBtn = document.getElementById('cameraBtn');
const previewImage = document.getElementById('previewImage');
const newBtn = document.getElementById('newBtn');
const reanalyzeBtn = document.getElementById('reanalyzeBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const upscaleBtn = document.getElementById('upscaleBtn');
const promptText = document.getElementById('promptText');
const resolutionSelect = document.getElementById('resolutionSelect');
const upscaleResolutionSelect = document.getElementById('upscaleResolutionSelect');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');
const errorClose = document.getElementById('errorClose');
const tryAgainBtn = document.getElementById('tryAgainBtn');
const cancelBtn = document.getElementById('cancelBtn');
const errorActions = document.getElementById('errorActions');
const downloadBtn = document.getElementById('downloadBtn');

// Configuration Editor DOM Elements
const configEditorContainer = document.getElementById('configEditorContainer');
const comfyuiEndpointInput = document.getElementById('comfyuiEndpoint');
const llmEndpointInput = document.getElementById('llmEndpoint');
const llmApiKeyInput = document.getElementById('llmApiKey');
const llmModelSelect = document.getElementById('llmModel');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');

// Processing Elements
const progressFill = document.getElementById('progressFill');
const stepIndicator1 = document.getElementById('stepIndicator1');
const stepIndicator2 = document.getElementById('stepIndicator2');
const stepIndicator3 = document.getElementById('stepIndicator3');
const processingText = document.getElementById('processingText');

// Screens
const screen1 = document.getElementById('screen1');
const screen2 = document.getElementById('screen2');
const screen3 = document.getElementById('screen3');

// State
let currentProfile = null;
let selectedFile = null;
let availableProfiles = [];
let currentResolution = { width: 1024, height: 1024 };
let currentSeed = null;
let isProcessing = false;
let imageHistory = [];
const MAX_HISTORY = 10;
let upscaleResolution = 1024;

// Shared profile state - fetch once, sync all
let profilesLoaded = false;

// DOM Elements for history
const historyContainer = document.getElementById('historyContainer');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadProfiles();
    populateAllProfileUIs();
    setupMobileCameraButton();
    
    // Setup config editor event listeners
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

// Populate both profile selects from already-loaded data
function populateProfileSelects() {
    if (availableProfiles.length > 0) {
        // Populate screen 1 profile select
        profileSelect.innerHTML = '';
        availableProfiles.forEach((profile, index) => {
            const option = document.createElement('option');
            option.value = profile.name;
            option.textContent = profile.name;
            profileSelect.appendChild(option);
            
            if (index === 0) {
                option.selected = true;
                currentProfile = profile.name;
            }
        });
        
        // Populate screen 3 profile select
        profileSelectResult.innerHTML = '';
        availableProfiles.forEach((profile, index) => {
            const option = document.createElement('option');
            option.value = profile.name;
            option.textContent = profile.name;
            profileSelectResult.appendChild(option);
            
            if (index === 0) {
                option.selected = true;
            }
        });
    }
}

// Profile selection change handler
profileSelect.addEventListener('change', (e) => {
    currentProfile = e.target.value;
    console.log(`Selected profile: ${currentProfile}`);
});

// Profile selection change handler for screen 3
profileSelectResult.addEventListener('change', (e) => {
    currentProfile = e.target.value;
    console.log(`Selected profile (screen 3): ${currentProfile}`);
});

// Upload section click
uploadSection.addEventListener('click', () => fileInput.click());

// Drag and drop
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
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Camera input change handler
cameraInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Camera button click handler
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
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        
        // Auto-start analysis and generation
        startProcessing();
    };
    reader.readAsDataURL(file);
}

function resetState() {
    selectedFile = null;
    currentSeed = null;
    promptText.value = '';
    previewImage.style.display = 'none';
    previewImage.src = '';
    document.getElementById('resultImage').style.display = 'none';
    document.getElementById('resultImage').src = '';
    regenerateBtn.disabled = true;
    hideError();
    resetProgress();
    // Reset file inputs to allow re-selecting the same file
    fileInput.value = '';
    cameraInput.value = '';
    // Reset profile selections to match screen 1
    profileSelect.value = currentProfile || '';
    profileSelectResult.value = currentProfile || '';
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
    
    // If we removed the current result, clear it
    if (index === 0) {
        const resultImage = document.getElementById('resultImage');
        resultImage.style.display = 'none';
        resultImage.src = '';
    }
}

function resetProgress() {
    progressFill.style.width = '0%';
    stepIndicator1.classList.add('active');
    stepIndicator1.classList.remove('completed');
    stepIndicator2.classList.remove('active', 'completed');
    stepIndicator3.classList.remove('active', 'completed');
}

// Screen navigation
function showScreen(screenNumber) {
    [screen1, screen2, screen3].forEach((screen, index) => {
        screen.classList.toggle('active', index + 1 === screenNumber);
    });
    
    // Sync profile selection when moving to screen 3
    if (screenNumber === 3) {
        profileSelectResult.value = currentProfile || '';
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
        
        promptText.value = data.prompt;
        
        // Move to generation
        processingText.textContent = 'Generating image...';
        
    } catch (err) {
        throw err;
    }
}

function generateRandomSeed() {
    // Simple random seed generation (not cryptographically secure)
    return Math.floor(Math.random() * 2147483647);
}

async function generateImage(upscale = false) {
    progressFill.style.width = '75%';
    
    const formData = new FormData();
    formData.append('prompt', promptText.value);
    formData.append('profile', currentProfile);
    formData.append('width', currentResolution.width);
    formData.append('height', currentResolution.height);
    
    // Generate new seed only for plain generation, not for upscaling
    if (!upscale) {
        const seed = generateRandomSeed();
        formData.append('seed', seed);
        currentSeed = seed;
    } else if (currentSeed !== null) {
        // Use existing seed for upscaling
        formData.append('seed', currentSeed);
    }
    
    // Add upscale parameters if upscaling
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
        
        const resultImage = document.getElementById('resultImage');
        resultImage.src = data.image;
        resultImage.onload = () => {
            resultImage.style.display = 'block';
            regenerateBtn.disabled = false;
            progressFill.style.width = '100%';
            // Add to history with the actual prompt used for generation
            addToHistory(data.image, promptText.value);
        };
        
    } catch (err) {
        throw err;
    }
}

// Re-analyze button handler - only re-analyze, don't regenerate
reanalyzeBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    
    isProcessing = true;
    reanalyzeBtn.disabled = true;
    
    try {
        processingText.textContent = 'Re-analyzing image with LLM...';
        progressFill.style.width = '50%';
        stepIndicator2.classList.add('active');
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('profile', currentProfile);
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Use error_reason if provided, otherwise fall back to detail
            const errorMessage = data.detail || 'Analysis failed';
            throw new Error(errorMessage);
        }
        
        promptText.value = data.prompt;
        
        processingText.textContent = 'Analysis complete';
        progressFill.style.width = '100%';
        
    } catch (err) {
        console.error('Re-analysis failed:', err);
        showError(err.message || 'Re-analysis failed. Please try again.');
    } finally {
        isProcessing = false;
        reanalyzeBtn.disabled = false;
    }
});

// Regenerate button handler - only regenerate, don't re-analyze
regenerateBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    
    isProcessing = true;
    regenerateBtn.disabled = true;
    
    try {
        processingText.textContent = 'Generating image...';
        progressFill.style.width = '75%';
        
        await generateImage(false);
        
        processingText.textContent = 'Generation complete';
        
    } catch (err) {
        console.error('Regeneration failed:', err);
        showError(err.message || 'Regeneration failed. Please try again.');
    } finally {
        isProcessing = false;
        regenerateBtn.disabled = false;
    }
});

// Upscale button handler
upscaleBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    
    isProcessing = true;
    upscaleBtn.disabled = true;
    
    try {
        processingText.textContent = 'Upscaling image...';
        progressFill.style.width = '75%';
        
        await generateImage(true);
        
        processingText.textContent = 'Upscaling complete';
        
    } catch (err) {
        console.error('Upscaling failed:', err);
        showError(err.message || 'Upscaling failed. Please try again.');
    } finally {
        isProcessing = false;
        upscaleBtn.disabled = false;
    }
});

// Upscale resolution selector change handler
upscaleResolutionSelect.addEventListener('change', (e) => {
    upscaleResolution = parseInt(e.target.value, 10);
});

// New button handler - go back to first screen
newBtn.addEventListener('click', () => {
    resetState();
    showScreen(1);
});

// Resolution selector change handler
resolutionSelect.addEventListener('change', (e) => {
    const [width, height] = e.target.value.split('x').map(Number);
    currentResolution = { width, height };
});

// Download button handler
downloadBtn.addEventListener('click', () => {
    const resultImage = document.getElementById('resultImage');
    if (resultImage.src) {
        const link = document.createElement('a');
        link.href = resultImage.src;
        link.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

// Error handling
function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.add('show');
}

function hideError() {
    errorMessage.textContent = "";
    errorContainer.classList.remove('show');
}

errorClose.addEventListener('click', hideError);

// Close error on click outside
document.addEventListener('click', (e) => {
    if (e.target === errorContainer) {
        hideError();
    }
});

// Try again button handler
tryAgainBtn.addEventListener('click', () => {
    hideErrorActions();
    startProcessing();
});

// Cancel button handler
cancelBtn.addEventListener('click', () => {
    hideErrorActions();
    resetState();
    showScreen(1);
});

function showErrorActions() {
    errorActions.style.display = 'flex';
}

function hideErrorActions() {
    errorActions.style.display = 'none';
}

// ============== Profile Editor Functions ==============

// Profile Editor State
let editorCurrentProfile = null;
let editorProfileData = {
    extraction_prompt: '',
    workflow: '',
    mappings: ''
};
let editorOriginalNames = new Set(); // Track original names for rename detection

// Navigation functions
function showGenerateView() {
    document.getElementById('navGenerate').classList.add('active');
    document.getElementById('navEditor').classList.remove('active');
    document.getElementById('navConfig').classList.remove('active');
    document.getElementById('screen1').parentElement.style.display = 'block';
    document.getElementById('profileEditorContainer').style.display = 'none';
    document.getElementById('configEditorContainer').style.display = 'none';
    // Refresh profiles and update all UIs
    loadProfiles().then(() => populateAllProfileUIs());
}

function showProfileEditor() {
    document.getElementById('navGenerate').classList.remove('active');
    document.getElementById('navEditor').classList.add('active');
    document.getElementById('navConfig').classList.remove('active');
    document.getElementById('screen1').parentElement.style.display = 'none';
    document.getElementById('profileEditorContainer').style.display = 'flex';
    document.getElementById('configEditorContainer').style.display = 'none';
    // Refresh profiles and update all UIs
    loadProfiles().then(() => populateAllProfileUIs());
}

function showConfigEditor() {
    document.getElementById('navGenerate').classList.remove('active');
    document.getElementById('navEditor').classList.remove('active');
    document.getElementById('navConfig').classList.add('active');
    document.getElementById('screen1').parentElement.style.display = 'none';
    document.getElementById('profileEditorContainer').style.display = 'none';
    document.getElementById('configEditorContainer').style.display = 'block';
    // Load configuration
    loadConfig();
}

// Configuration editor functions
let currentConfig = null;
let availableLLMModels = [];

// Load configuration from backend
async function loadConfig() {
    try {
        const response = await fetch('/api/config/providers');
        const data = await response.json();
        
        if (data.providers) {
            currentConfig = data.providers;
            
            // Populate form fields
            document.getElementById('comfyuiEndpoint').value = currentConfig.comfyui_endpoint || '';
            document.getElementById('llmEndpoint').value = currentConfig.llm_endpoint || '';
            document.getElementById('llmApiKey').value = currentConfig.llm_apikey || '';
            
            // Load LLM models from the endpoint
            await refreshLLMModels();
            
            // Set the current model if it exists in the list
            if (currentConfig.llm_model) {
                const modelSelect = document.getElementById('llmModel');
                modelSelect.value = currentConfig.llm_model;
            }
        }
    } catch (err) {
        console.error('Failed to load config:', err);
        showError('Failed to load configuration. Please refresh the page.');
    }
}

// Save configuration to backend
async function saveConfig() {
    const comfyuiEndpoint = document.getElementById('comfyuiEndpoint').value.trim();
    const llmEndpoint = document.getElementById('llmEndpoint').value.trim();
    const llmApiKey = document.getElementById('llmApiKey').value.trim();
    const llmModel = document.getElementById('llmModel').value;
    
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
            showError('Configuration saved successfully!', true);
        } else {
            const error = await response.json();
            showError(error.detail || 'Failed to save configuration');
        }
    } catch (err) {
        console.error('Failed to save config:', err);
        showError('Failed to save configuration. Please try again.');
    }
}

// Refresh LLM models from the LLM endpoint
async function refreshLLMModels() {
    const llmEndpoint = document.getElementById('llmEndpoint').value.trim();
    const llmApiKey = document.getElementById('llmApiKey').value.trim();
    const modelSelect = document.getElementById('llmModel');
    
    if (!llmEndpoint) {
        modelSelect.innerHTML = '<option value="">Enter LLM endpoint first</option>';
        return;
    }
    
    modelSelect.innerHTML = '<option value="">Loading models...</option>';
    
    // Build headers with optional Bearer authentication
    const headers = {};
    if (llmApiKey) {
        headers['Authorization'] = `Bearer ${llmApiKey}`;
    }
    
    try {
        // Try common endpoints for listing models
        let modelsEndpoint = `${llmEndpoint}/models`;
        if (!llmEndpoint.endsWith('/api/v1')) {
            // If endpoint doesn't end with /api/v1, try appending /models directly
            modelsEndpoint = llmEndpoint.endsWith('/') ? `${llmEndpoint}models` : `${llmEndpoint}/models`;
        }
        
        const response = await fetch(modelsEndpoint, { headers });
        
        if (response.ok) {
            const data = await response.json();
            
            // Handle different response formats
            let models = [];
            if (Array.isArray(data)) {
                models = data;
            } else if (data.models && Array.isArray(data.models)) {
                models = data.models;
            } else if (data.data && Array.isArray(data.data)) {
                models = data.data;
            }
            
            // Extract model names/IDs
            availableLLMModels = models.map(model => {
                if (typeof model === 'string') {
                    return model;
                }
                return model.id || model.name || model.model;
            }).filter(Boolean);
            
            // Populate the select dropdown
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
            // Try alternative endpoint format
            const altEndpoint = `${llmEndpoint.replace('/api/v1', '')}/models`;
            const altResponse = await fetch(altEndpoint, { headers });
            
            if (altResponse.ok) {
                const data = await altResponse.json();
                availableLLMModels = data.models || data.data || [];
                
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
                modelSelect.innerHTML = '<option value="">Failed to load models</option>';
                console.error('Failed to fetch models:', await response.text());
            }
        }
    } catch (err) {
        console.error('Failed to fetch LLM models:', err);
        modelSelect.innerHTML = '<option value="">Failed to load models</option>';
        showError('Failed to load LLM models. Check the LLM endpoint.');
    }
}

// Populate editor profile list from already-loaded data
function populateEditorProfileList() {
    const profileList = document.getElementById('profileList');
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
    // Highlight selected profile
    document.querySelectorAll('.profile-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.name === profileName) {
            item.classList.add('selected');
        }
    });
    
    editorCurrentProfile = profileName;
    document.getElementById('editorProfileName').textContent = profileName;
    
    // Enable action buttons
    document.getElementById('saveProfileBtn').disabled = false;
    document.getElementById('duplicateProfileBtn').disabled = false;
    document.getElementById('renameProfileBtn').disabled = false;
    document.getElementById('deleteProfileBtn').disabled = false;
    document.getElementById('downloadProfileBtn').disabled = false;
    
    // Show editor UI
    document.getElementById('editorTabs').style.display = 'flex';
    document.getElementById('editorContent').style.display = 'block';
    document.getElementById('editorPlaceholder').style.display = 'none';
    
    // Load profile content
    try {
        const response = await fetch(`/api/profile-editor/profile/${encodeURIComponent(profileName)}`);
        const data = await response.json();
        
        editorProfileData.extraction_prompt = data.extraction_prompt || '';
        editorProfileData.workflow = data.workflow || '{}';
        editorProfileData.mappings = data.mappings || '{}';
        
        document.getElementById('extractionPromptEditor').value = editorProfileData.extraction_prompt;
        document.getElementById('workflowEditor').value = editorProfileData.workflow;
        document.getElementById('mappingsEditor').value = editorProfileData.mappings;
        
        // Reset to first tab
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
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Show corresponding textarea
    document.getElementById('extractionPromptEditor').style.display = 'none';
    document.getElementById('workflowEditor').style.display = 'none';
    document.getElementById('mappingsEditor').style.display = 'none';
    
    if (tabName === 'extraction_prompt') {
        document.getElementById('extractionPromptEditor').style.display = 'block';
    } else if (tabName === 'workflow') {
        document.getElementById('workflowEditor').style.display = 'block';
    } else if (tabName === 'mappings') {
        document.getElementById('mappingsEditor').style.display = 'block';
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
        extraction_prompt: document.getElementById('extractionPromptEditor').value,
        workflow: document.getElementById('workflowEditor').value,
        mappings: document.getElementById('mappingsEditor').value
    };
    
    try {
        const response = await fetch('/api/profile-editor/profile', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Profile saved successfully');
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
            showNotification('Profile duplicated successfully');
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
            showNotification('Profile renamed successfully');
            editorCurrentProfile = newName;
            loadProfiles().then(() => {
                populateAllProfileUIs();
                document.getElementById('editorProfileName').textContent = newName;
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
            showNotification('Profile deleted successfully');
            editorCurrentProfile = null;
            editorProfileData = { extraction_prompt: '', workflow: '', mappings: '' };
            
            // Reset editor UI
            document.getElementById('editorProfileName').textContent = 'Select a profile';
            document.getElementById('saveProfileBtn').disabled = true;
            document.getElementById('duplicateProfileBtn').disabled = true;
            document.getElementById('renameProfileBtn').disabled = true;
            document.getElementById('deleteProfileBtn').disabled = true;
            document.getElementById('downloadProfileBtn').disabled = true;
            document.getElementById('editorTabs').style.display = 'none';
            document.getElementById('editorContent').style.display = 'none';
            document.getElementById('editorPlaceholder').style.display = 'block';
            document.getElementById('extractionPromptEditor').value = '';
            document.getElementById('workflowEditor').value = '';
            document.getElementById('mappingsEditor').value = '';
            
            // Remove selected from list
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

// Download current profile
function downloadCurrentProfile() {
    if (!editorCurrentProfile) return;
    window.location.href = `/api/profile-editor/download/${encodeURIComponent(editorCurrentProfile)}`;
}

// Download all profiles
function downloadAllProfiles() {
    window.location.href = '/api/profile-editor/download-all';
}

// Helper: Download a specific profile by name
function downloadProfile(profileName) {
    window.location.href = `/api/profile-editor/download/${encodeURIComponent(profileName)}`;
}

// Show notification
function showNotification(message) {
    // Reuse error container for notifications with green color
    errorMessage.style.color = '#4caf50';
    errorMessage.textContent = message;
    errorContainer.classList.add('show');
    errorContainer.classList.add('notification');
    
    setTimeout(() => {
        errorContainer.classList.remove('show');
        errorContainer.classList.remove('notification');
        errorMessage.style.color = '';
    }, 3000);
}
