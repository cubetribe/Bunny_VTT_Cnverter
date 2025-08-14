// Complete frontend JavaScript functionality for SRT to VTT converter
// Implements drag-and-drop, file upload, progress tracking, and download

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const includeBase64Checkbox = document.getElementById('includeBase64');
    const enableAiCorrectionCheckbox = document.getElementById('enableAiCorrection');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const messageSection = document.getElementById('messageSection');
    const messageContent = document.getElementById('messageContent');
    const resultSection = document.getElementById('resultSection');
    const downloadBtn = document.getElementById('downloadBtn');
    const copyBase64Btn = document.getElementById('copyBase64Btn');
    const base64Section = document.getElementById('base64Section');
    const base64Content = document.getElementById('base64Content');
    const copyBase64TextBtn = document.getElementById('copyBase64TextBtn');
    const languageInfo = document.getElementById('languageInfo');
    const detectedLanguage = document.getElementById('detectedLanguage');
    const languageConfidence = document.getElementById('languageConfidence');

    // State management
    let currentFile = null;
    let downloadUrl = null;
    let currentResponseData = null;

    // Processing stages for progress tracking
    const STAGES = {
        UPLOAD: { text: 'Uploading file...', progress: 20 },
        CORRECTION: { text: 'Correcting text with AI...', progress: 40 },
        LANGUAGE_DETECTION: { text: 'Detecting language...', progress: 60 },
        CONVERSION: { text: 'Converting to VTT format...', progress: 80 },
        COMPLETE: { text: 'Conversion complete!', progress: 100 }
    };

    // Initialize event listeners
    initializeDragAndDrop();
    initializeFileHandlers();
    initializeDownloadHandler();
    initializeBase64Handlers();

    function initializeDragAndDrop() {
        // Prevent default drag behaviors on document and drop zone
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Visual feedback for drag over
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        // Handle file drop
        dropZone.addEventListener('drop', handleFileDrop);
    }

    function initializeFileHandlers() {
        // Browse button click
        browseBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // Drop zone click
        dropZone.addEventListener('click', (e) => {
            // Don't trigger if clicking the browse button
            if (e.target !== browseBtn) {
                fileInput.click();
            }
        });

        // File input change
        fileInput.addEventListener('change', handleFileSelect);
    }

    function initializeDownloadHandler() {
        downloadBtn.addEventListener('click', triggerDownload);
    }

    function initializeBase64Handlers() {
        copyBase64Btn.addEventListener('click', toggleBase64Section);
        copyBase64TextBtn.addEventListener('click', copyBase64ToClipboard);
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.classList.add('drag-over');
    }

    function unhighlight(e) {
        dropZone.classList.remove('drag-over');
    }

    function handleFileDrop(e) {
        const files = e.dataTransfer.files;
        
        if (files.length === 0) {
            showError('No files detected. Please try dragging and dropping your SRT file again.');
            return;
        }
        
        if (files.length > 1) {
            showError('Multiple files detected. Please upload only one SRT file at a time.');
            return;
        }
        
        processFile(files[0]);
    }

    function handleFileSelect(e) {
        if (e.target.files.length === 0) {
            return; // User cancelled file selection
        }
        
        if (e.target.files.length > 1) {
            showError('Multiple files selected. Please choose only one SRT file at a time.');
            return;
        }
        
        processFile(e.target.files[0]);
    }

    function processFile(file) {
        // Enhanced file validation with detailed error messages
        
        // Check if file exists
        if (!file) {
            showError('No file selected. Please choose a file to upload.');
            return;
        }
        
        // Validate file type with detailed message
        if (!file.name.toLowerCase().endsWith('.srt')) {
            const fileExtension = file.name.split('.').pop() || 'unknown';
            showError(`Invalid file type: .${fileExtension}. Please select a valid SRT subtitle file (.srt extension required).`);
            return;
        }

        // Validate file size with detailed message
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
            showError(`File too large: ${fileSizeMB}MB. Maximum file size is 10MB. Please compress your SRT file or split it into smaller parts.`);
            return;
        }
        
        // Check for empty files
        if (file.size === 0) {
            showError('Empty file detected. Please select a valid SRT file with content.');
            return;
        }

        currentFile = file;
        uploadFile(file);
    }

    async function uploadFile(file) {
        let retryCount = 0;
        const maxRetries = 3;
        
        async function attemptUpload() {
            try {
                // Reset UI state
                hideAllSections();
                showProgressSection();
                updateProgress(STAGES.UPLOAD);

                // Create FormData for file upload
                const formData = new FormData();
                formData.append('srtFile', file);
                
                // Add Base64 option if requested
                if (includeBase64Checkbox.checked) {
                    formData.append('base64', 'true');
                }

                // Add AI correction option
                formData.append('enableAiCorrection', enableAiCorrectionCheckbox.checked);

                // Upload file with timeout and retry logic
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                const response = await fetch('/convert', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
                    handleServerError(response.status, errorData.error);
                    return;
                }

                // Simulate progress stages (since we can't track real server progress)
                await simulateProgressStages();

                // Handle successful response
                if (includeBase64Checkbox.checked) {
                    // Handle JSON response with Base64 data
                    currentResponseData = await response.json();
                    
                    // Show completion
                    updateProgress(STAGES.COMPLETE);
                    setTimeout(() => {
                        showSuccessWithData(currentResponseData);
                    }, 500);
                } else {
                    // Handle file download response
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    downloadUrl = url;

                    // Try to extract language info from headers
                    const languageCode = response.headers.get('Content-Language');
                    const detectedLang = response.headers.get('X-Detected-Language');
                    const confidence = response.headers.get('X-Language-Confidence');
                    
                    if (languageCode && detectedLang) {
                        currentResponseData = {
                            language: {
                                detected: true,
                                language: {
                                    code: languageCode,
                                    name: detectedLang.split(' (')[0],
                                    confidence: confidence ? parseInt(confidence) / 100 : 0
                                }
                            }
                        };
                    }

                    // Show completion
                    updateProgress(STAGES.COMPLETE);
                    setTimeout(() => {
                        showSuccess();
                        triggerDownload(); // Automatic download
                    }, 500);
                }

            } catch (error) {
                console.error('Upload error:', error);
                handleUploadError(error, retryCount < maxRetries);
            }
        }
        
        function handleServerError(status, errorMessage) {
            let userMessage = '';
            let showRetry = false;
            
            switch (status) {
                case 400:
                    userMessage = `Invalid file format: ${errorMessage || 'The uploaded file is not a valid SRT file. Please check the file format and try again.'}`;
                    break;
                case 413:
                    userMessage = 'File too large: The uploaded file exceeds the maximum size limit. Please compress your SRT file or split it into smaller parts.';
                    break;
                case 429:
                    userMessage = 'Too many requests: The server is currently busy. Please wait a moment and try again.';
                    showRetry = true;
                    break;
                case 500:
                    userMessage = `Server error: ${errorMessage || 'An internal server error occurred. This might be a temporary issue with the AI correction service.'}`;
                    showRetry = true;
                    break;
                case 503:
                    userMessage = 'Service unavailable: The conversion service is temporarily unavailable. Please try again in a few minutes.';
                    showRetry = true;
                    break;
                default:
                    userMessage = `Server error (${status}): ${errorMessage || 'An unexpected error occurred. Please try again.'}`;
                    showRetry = status >= 500; // Retry for server errors
            }
            
            showError(userMessage, showRetry, showRetry ? () => {
                retryCount++;
                attemptUpload();
            } : null);
        }
        
        function handleUploadError(error, canRetry) {
            let userMessage = '';
            let showRetry = canRetry;
            
            if (error.name === 'AbortError') {
                userMessage = 'Upload timeout: The file upload took too long. This might be due to a slow internet connection or server issues.';
                showRetry = true;
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                userMessage = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
                showRetry = true;
            } else if (error.message.includes('TypeError')) {
                userMessage = 'Connection error: There was a problem communicating with the server. Please refresh the page and try again.';
                showRetry = true;
            } else {
                userMessage = error.message || 'An unexpected error occurred during file upload. Please try again.';
            }
            
            showError(userMessage, showRetry, showRetry ? () => {
                retryCount++;
                attemptUpload();
            } : null);
        }
        
        // Start the upload attempt
        await attemptUpload();
    }

    async function simulateProgressStages() {
        // Simulate processing stages with delays
        await delay(600);
        updateProgress(STAGES.CORRECTION);
        
        await delay(1000);
        updateProgress(STAGES.LANGUAGE_DETECTION);
        
        await delay(800);
        updateProgress(STAGES.CONVERSION);
        
        await delay(600);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function updateProgress(stage) {
        progressFill.style.width = `${stage.progress}%`;
        progressText.textContent = stage.text;
    }

    function showProgressSection() {
        progressSection.classList.remove('hidden');
        progressFill.style.width = '0%';
    }

    function showSuccess() {
        hideAllSections();
        resultSection.classList.remove('hidden');
        
        // Show language information if available
        if (currentResponseData && currentResponseData.language && currentResponseData.language.detected) {
            displayLanguageInfo(currentResponseData.language.language);
        }
    }

    function showSuccessWithData(responseData) {
        hideAllSections();
        resultSection.classList.remove('hidden');
        
        // Show language information
        if (responseData.language && responseData.language.detected) {
            displayLanguageInfo(responseData.language.language);
        }
        
        // Show Base64 option if available
        if (responseData.base64) {
            copyBase64Btn.classList.remove('hidden');
            base64Content.value = responseData.base64.content;
        }
        
        // Create download URL from Base64 if needed
        if (responseData.base64 && responseData.base64.content) {
            const binaryString = atob(responseData.base64.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'text/vtt; charset=utf-8' });
            downloadUrl = window.URL.createObjectURL(blob);
        }
    }

    function displayLanguageInfo(language) {
        if (language && language.name) {
            languageInfo.classList.remove('hidden');
            detectedLanguage.textContent = `${language.name} (${language.code.toUpperCase()})`;
            languageConfidence.textContent = `${Math.round(language.confidence * 100)}% confidence`;
        }
    }

    function toggleBase64Section() {
        if (base64Section.classList.contains('hidden')) {
            base64Section.classList.remove('hidden');
            copyBase64Btn.textContent = 'Hide Base64 Content';
        } else {
            base64Section.classList.add('hidden');
            copyBase64Btn.textContent = 'Copy Base64 for Bunny Stream';
        }
    }

    async function copyBase64ToClipboard() {
        try {
            await navigator.clipboard.writeText(base64Content.value);
            
            // Visual feedback
            const originalText = copyBase64TextBtn.textContent;
            copyBase64TextBtn.textContent = 'Copied!';
            copyBase64TextBtn.classList.add('success');
            
            setTimeout(() => {
                copyBase64TextBtn.textContent = originalText;
                copyBase64TextBtn.classList.remove('success');
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            
            // Fallback: select the text
            base64Content.select();
            base64Content.setSelectionRange(0, 99999);
            
            // Visual feedback for fallback
            const originalText = copyBase64TextBtn.textContent;
            copyBase64TextBtn.textContent = 'Text Selected';
            setTimeout(() => {
                copyBase64TextBtn.textContent = originalText;
            }, 2000);
        }
    }
    
    function showWarning(message, showContinue = false, continueCallback = null) {
        hideAllSections();
        messageSection.classList.remove('hidden');
        
        // Clear previous content
        messageContent.innerHTML = '';
        messageContent.className = 'message warning';
        
        // Create warning message
        const warningText = document.createElement('div');
        warningText.className = 'warning-text';
        warningText.textContent = message;
        messageContent.appendChild(warningText);
        
        // Add continue button if requested
        if (showContinue && continueCallback) {
            const continueBtn = document.createElement('button');
            continueBtn.className = 'continue-btn';
            continueBtn.textContent = 'Continue Without Correction';
            continueBtn.onclick = continueCallback;
            messageContent.appendChild(continueBtn);
        }
        
        // Add reset button for new upload
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-btn';
        resetBtn.textContent = 'Upload New File';
        resetBtn.onclick = resetUploader;
        messageContent.appendChild(resetBtn);
    }

    function showError(message, showRetry = false, retryCallback = null) {
        hideAllSections();
        messageSection.classList.remove('hidden');
        
        // Clear previous content
        messageContent.innerHTML = '';
        messageContent.className = 'message error';
        
        // Create error message
        const errorText = document.createElement('div');
        errorText.className = 'error-text';
        errorText.textContent = message;
        messageContent.appendChild(errorText);
        
        // Add retry button if requested
        if (showRetry && retryCallback) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'retry-btn';
            retryBtn.textContent = 'Try Again';
            retryBtn.onclick = retryCallback;
            messageContent.appendChild(retryBtn);
        }
        
        // Add reset button for new upload
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-btn';
        resetBtn.textContent = 'Upload New File';
        resetBtn.onclick = resetUploader;
        messageContent.appendChild(resetBtn);
    }

    function hideAllSections() {
        progressSection.classList.add('hidden');
        messageSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        languageInfo.classList.add('hidden');
        base64Section.classList.add('hidden');
        copyBase64Btn.classList.add('hidden');
    }

    function triggerDownload() {
        if (downloadUrl && currentFile) {
            // Create download link
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = currentFile.name.replace(/\.srt$/i, '.vtt');
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            setTimeout(() => {
                window.URL.revokeObjectURL(downloadUrl);
                downloadUrl = null;
            }, 1000);
        }
    }

    // Reset functionality for new uploads
    function resetUploader() {
        currentFile = null;
        downloadUrl = null;
        currentResponseData = null;
        fileInput.value = '';
        includeBase64Checkbox.checked = false;
        base64Content.value = '';
        hideAllSections();
        
        // Clean up any existing object URLs
        if (downloadUrl) {
            window.URL.revokeObjectURL(downloadUrl);
        }
    }
    
    // Check server connectivity
    async function checkServerConnection() {
        try {
            const response = await fetch('/', { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    // Enhanced error handling for different scenarios
    function getErrorContext(error) {
        const context = {
            isNetworkError: false,
            isServerError: false,
            isClientError: false,
            canRetry: false
        };
        
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            context.isNetworkError = true;
            context.canRetry = true;
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            context.isNetworkError = true;
            context.canRetry = true;
        } else if (error.message.includes('500') || error.message.includes('503')) {
            context.isServerError = true;
            context.canRetry = true;
        } else if (error.message.includes('400') || error.message.includes('413')) {
            context.isClientError = true;
            context.canRetry = false;
        }
        
        return context;
    }

    // Add reset capability when clicking on upload area after completion
    dropZone.addEventListener('click', (e) => {
        if (resultSection.classList.contains('hidden') === false) {
            resetUploader();
        }
    });
    
    // Global error handler for unhandled errors
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        if (!messageSection.classList.contains('hidden') || !resultSection.classList.contains('hidden')) {
            // Don't override existing error messages
            return;
        }
        showError('An unexpected error occurred. Please refresh the page and try again.');
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        if (!messageSection.classList.contains('hidden') || !resultSection.classList.contains('hidden')) {
            // Don't override existing error messages
            return;
        }
        showError('An unexpected error occurred during processing. Please try again.');
        event.preventDefault();
    });
    
    // Check initial server connectivity
    checkServerConnection().then(isConnected => {
        if (!isConnected) {
            showError('Unable to connect to the conversion server. Please check your internet connection and refresh the page.');
        }
    }).catch(() => {
        // Silently fail - don't show error on page load unless there's a real issue
    });
});