// Configuration editor logic

import { DOM, state } from './state.js';
import { saveConfig, refreshLLMModels as fetchModels } from './api.js';
import { showSuccess, showError, populateSelect } from './ui.js';

/**
 * Load configuration for the config editor view.
 */
export async function loadConfigView() {
    try {
        const response = await fetch('/api/config/providers');
        const data = await response.json();
        
        if (data.providers) {
            state.currentConfig = data.providers;
            DOM.comfyuiEndpoint.value = state.currentConfig.comfyui_endpoint || '';
            DOM.llmEndpoint.value = state.currentConfig.llm_endpoint || '';
            DOM.llmApiKey.value = state.currentConfig.llm_apikey || '';
            await refreshLLMModels();
            if (state.currentConfig.llm_model) {
                DOM.llmModel.value = state.currentConfig.llm_model;
            }
        }
    } catch (err) {
        console.error('Failed to load config:', err);
        showError('Failed to load configuration. Please refresh the page.');
    }
}

/**
 * Save configuration from the config editor.
 */
export async function saveConfigView() {
    const comfyuiEndpoint = DOM.comfyuiEndpoint.value.trim();
    const llmEndpoint = DOM.llmEndpoint.value.trim();
    const llmApiKey = DOM.llmApiKey.value.trim();
    const llmModel = DOM.llmModel.value;
    
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
        const response = await saveConfig(newConfig);
        
        if (response.ok) {
            state.currentConfig = newConfig.providers;
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

/**
 * Refresh LLM models and update the model select.
 * @returns {Promise<void>}
 */
export async function refreshLLMModels() {
    const modelSelect = DOM.llmModel;
    
    if (state.modelsLoading) return;
    state.modelsLoading = true;
    modelSelect.innerHTML = '<option value="">Loading models...</option>';
    DOM.refreshModelsBtn.disabled = true;
    DOM.refreshModelsBtn.textContent = 'Loading...';
    
    try {
        const models = await fetchModels();
        state.availableLLMModels.length = 0;
        state.availableLLMModels.push(...models);
        modelSelect.innerHTML = '';
        if (state.availableLLMModels.length > 0) {
            const modelOptions = state.availableLLMModels.map(m => ({name: m}));
            populateSelect(modelSelect, modelOptions);
        } else {
            modelSelect.innerHTML = '<option value="">No models found</option>';
        }
    } catch (err) {
        console.error('Failed to fetch LLM models:', err);
        DOM.llmModel.innerHTML = '<option value="">Failed to load models</option>';
        showError('Failed to load LLM models. Check the LLM endpoint.');
    } finally {
        state.modelsLoading = false;
        DOM.refreshModelsBtn.disabled = false;
        DOM.refreshModelsBtn.textContent = 'Refresh Models';
    }
}

/**
 * Populate LLM model select from already-loaded data.
 */
export function populateModelSelect() {
    if (state.availableLLMModels.length > 0) {
        const modelOptions = state.availableLLMModels.map(m => ({name: m}));
        populateSelect(DOM.llmModel, modelOptions);
    }
}
