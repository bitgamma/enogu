// Image Generator Frontend
// Handles profile selection, image upload, analysis, and generation

const uploadSection = document.getElementById('uploadSection');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const error = document.getElementById('error');
const promptDisplay = document.getElementById('promptDisplay');
const promptText = document.getElementById('promptText');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const profileSelect = document.getElementById('profileSelect');

let selectedFile = null;
let generatedPrompt = null;
let currentProfile = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadProfiles();
});

// Load available profiles from backend
async function loadProfiles() {
    try {
        const response = await fetch('/api/profiles');
        const data = await response.json();
        
        if (data.profiles && data.profiles.length > 0) {
            profileSelect.innerHTML = '<option value="">Select a profile...</option>';
            data.profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile.name;
                option.textContent = profile.name;
                profileSelect.appendChild(option);
            });
        } else {
            profileSelect.innerHTML = '<option value="">No profiles available</option>';
        }
    } catch (err) {
        console.error('Failed to load profiles:', err);
        profileSelect.innerHTML = '<option value="">Error loading profiles</option>';
    }
}

// Profile selection change handler
profileSelect.addEventListener('change', (e) => {
    currentProfile = e.target.value;
    console.log(`Selected profile: ${currentProfile}`);
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

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
    }
    
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        analyzeBtn.disabled = false;
        hideError();
    };
    reader.readAsDataURL(file);
}

async function analyzeImage() {
    if (!selectedFile) return;
    if (!currentProfile) {
        showError('Please select a profile first');
        return;
    }
    
    showLoading('Analyzing image...');
    hideError();
    promptDisplay.style.display = 'none';
    resultSection.style.display = 'none';
    
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
            throw new Error(data.detail || 'Analysis failed');
        }
        
        generatedPrompt = data.prompt;
        promptText.textContent = generatedPrompt;
        promptDisplay.style.display = 'block';
        generateBtn.disabled = false;
        
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading();
    }
}

async function generateImage() {
    if (!generatedPrompt) return;
    if (!currentProfile) {
        showError('Please select a profile first');
        return;
    }
    
    showLoading('Generating image... This may take a moment.');
    hideError();
    resultSection.style.display = 'none';
    
    try {
        const formData = new FormData();
        formData.append('prompt', generatedPrompt);
        formData.append('profile', currentProfile);
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Generation failed');
        }
        
        resultImage.src = data.image;
        resultSection.style.display = 'block';
        
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading();
    }
}

function showLoading(text) {
    loadingText.textContent = text;
    loading.classList.add('active');
    analyzeBtn.disabled = true;
    generateBtn.disabled = true;
}

function hideLoading() {
    loading.classList.remove('active');
    analyzeBtn.disabled = false;
    generateBtn.disabled = false;
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
}

function hideError() {
    error.style.display = 'none';
}

analyzeBtn.addEventListener('click', analyzeImage);
generateBtn.addEventListener('click', generateImage);
