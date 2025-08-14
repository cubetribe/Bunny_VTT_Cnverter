/**
 * VTT Format Generation Module for Bunny Stream Compatibility
 * Converts SRT subtitle data to Bunny Stream-compatible VTT format
 */

/**
 * Converts SRT timestamp format to VTT format
 * Changes comma separator to period (00:00:00,000 → 00:00:00.000)
 * @param {string} srtTimestamp - Timestamp in SRT format (HH:MM:SS,mmm)
 * @returns {string} - Timestamp in VTT format (HH:MM:SS.mmm)
 */
function convertTimestamp(srtTimestamp) {
    if (!srtTimestamp || typeof srtTimestamp !== 'string') {
        throw new Error('Invalid timestamp: must be a non-empty string');
    }

    // Validate SRT timestamp format (allow hours up to 99 for long content)
    const timestampRegex = /^(\d{2}):([0-5]\d):([0-5]\d),(\d{3})$/;
    const match = srtTimestamp.match(timestampRegex);
    
    if (!match) {
        throw new Error(`Invalid SRT timestamp format: ${srtTimestamp}. Expected format: HH:MM:SS,mmm`);
    }

    // Convert comma to period for VTT format
    return srtTimestamp.replace(',', '.');
}

/**
 * Generates VTT format content from parsed SRT subtitle data
 * Creates Bunny Stream-compatible VTT with proper header and formatting
 * @param {Array} subtitles - Array of subtitle objects from SRT parser
 * @returns {string} - Complete VTT format content as UTF-8 string without BOM
 */
function generateVTT(subtitles) {
    if (!Array.isArray(subtitles)) {
        throw new Error('Invalid input: subtitles must be an array');
    }

    if (subtitles.length === 0) {
        throw new Error('No subtitles provided for VTT generation');
    }

    // Start with WEBVTT header (no BOM, no leading spaces)
    let vttContent = 'WEBVTT\n\n';

    // Process each subtitle entry
    subtitles.forEach((subtitle, index) => {
        // Validate subtitle object structure
        if (!subtitle || typeof subtitle !== 'object') {
            throw new Error(`Invalid subtitle object at index ${index}`);
        }

        const { startTime, endTime, text } = subtitle;

        if (!startTime || !endTime || text === undefined) {
            throw new Error(`Missing required fields in subtitle at index ${index}. Required: startTime, endTime, text`);
        }

        try {
            // Convert timestamps from SRT to VTT format
            const vttStartTime = convertTimestamp(startTime);
            const vttEndTime = convertTimestamp(endTime);

            // Add timestamp line (no subtitle sequence numbers for Bunny Stream)
            vttContent += `${vttStartTime} --> ${vttEndTime}\n`;

            // Add subtitle text (preserve line breaks within text)
            vttContent += `${text}\n\n`;

        } catch (error) {
            throw new Error(`Error processing subtitle at index ${index}: ${error.message}`);
        }
    });

    return vttContent;
}

/**
 * Validates that the generated VTT content meets Bunny Stream specifications
 * @param {string} vttContent - The generated VTT content
 * @returns {boolean} - True if valid, throws error if invalid
 */
function validateVTTFormat(vttContent) {
    if (!vttContent || typeof vttContent !== 'string') {
        throw new Error('Invalid VTT content: must be a non-empty string');
    }

    // Check for BOM (should not be present) - must be checked first
    if (vttContent.charCodeAt(0) === 0xFEFF) {
        throw new Error('VTT content must not contain BOM (Byte Order Mark)');
    }

    // Check for WEBVTT header as first line
    if (!vttContent.startsWith('WEBVTT\n')) {
        throw new Error('VTT content must start with "WEBVTT" header followed by newline');
    }

    // Check for empty line after WEBVTT header
    if (!vttContent.startsWith('WEBVTT\n\n')) {
        throw new Error('VTT content must have empty line after WEBVTT header');
    }

    // Validate timestamp format in content
    const timestampRegex = /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g;
    const timestamps = vttContent.match(timestampRegex);
    
    if (!timestamps || timestamps.length === 0) {
        throw new Error('No valid VTT timestamps found in content');
    }

    // Check that no subtitle sequence numbers are present
    // Look for lines that are just numbers (which would be sequence numbers)
    const lines = vttContent.split('\n');
    for (let i = 2; i < lines.length; i++) { // Skip WEBVTT header and empty line
        const line = lines[i].trim();
        if (/^\d+$/.test(line)) {
            // Check if this number is followed by a timestamp (which would indicate it's a sequence number)
            if (i + 1 < lines.length && timestampRegex.test(lines[i + 1])) {
                throw new Error('VTT content must not contain subtitle sequence numbers for Bunny Stream compatibility');
            }
        }
    }

    return true;
}

/**
 * Enhanced VTT format validation with comprehensive Bunny Stream compliance checks
 * @param {string} vttContent - The VTT content to validate
 * @returns {Object} - Validation result with detailed compliance information
 */
function validateBunnyStreamCompliance(vttContent) {
    const result = {
        isValid: false,
        compliance: {
            hasWebVTTHeader: false,
            hasEmptyLineAfterHeader: false,
            noBOM: false,
            noSequenceNumbers: false,
            validTimestamps: false,
            properEncoding: false
        },
        errors: [],
        warnings: []
    };

    try {
        // Detailed compliance checks (don't fail on basic validation for warnings)
        result.compliance.noBOM = vttContent.charCodeAt(0) !== 0xFEFF;
        result.compliance.hasWebVTTHeader = vttContent.startsWith('WEBVTT\n') || vttContent.startsWith('WEBVTT\r\n');
        result.compliance.hasEmptyLineAfterHeader = vttContent.startsWith('WEBVTT\n\n') || vttContent.startsWith('WEBVTT\r\n\r\n');
        
        // Check for proper UTF-8 encoding
        try {
            const buffer = Buffer.from(vttContent, 'utf8');
            const decoded = buffer.toString('utf8');
            result.compliance.properEncoding = decoded === vttContent;
        } catch (error) {
            result.compliance.properEncoding = false;
            result.errors.push('Content is not valid UTF-8');
        }

        // Validate timestamps
        const timestampRegex = /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g;
        const timestamps = vttContent.match(timestampRegex);
        result.compliance.validTimestamps = timestamps && timestamps.length > 0;

        // Check for sequence numbers (handle both LF and CRLF)
        const lines = vttContent.split(/\r?\n/);
        let hasSequenceNumbers = false;
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (/^\d+$/.test(line) && i + 1 < lines.length && timestampRegex.test(lines[i + 1])) {
                hasSequenceNumbers = true;
                break;
            }
        }
        result.compliance.noSequenceNumbers = !hasSequenceNumbers;

        // Additional Bunny Stream specific checks
        if (vttContent.includes('\r\n')) {
            result.warnings.push('Content contains Windows line endings (CRLF). Unix line endings (LF) are recommended.');
        }

        if (vttContent.includes('\t')) {
            result.warnings.push('Content contains tab characters. Spaces are recommended for indentation.');
        }

        // Check for leading/trailing whitespace in header
        const headerLines = vttContent.split(/\r?\n/);
        if (headerLines.length > 0 && headerLines[0] !== 'WEBVTT') {
            result.warnings.push('WEBVTT header should not have leading or trailing whitespace.');
        }

        // Try basic validation for errors (but don't let it stop warnings)
        try {
            validateVTTFormat(vttContent);
        } catch (error) {
            result.errors.push(error.message);
        }

        // All compliance checks passed
        result.isValid = Object.values(result.compliance).every(check => check === true) && result.errors.length === 0;

    } catch (error) {
        result.errors.push(error.message);
        result.isValid = false;
    }

    return result;
}

/**
 * Generates Base64 encoded VTT content for direct API uploads
 * @param {string} vttContent - The VTT content to encode
 * @returns {Object} - Base64 data with metadata for API integration
 */
function generateBase64Output(vttContent) {
    if (!vttContent || typeof vttContent !== 'string') {
        throw new Error('Invalid VTT content for Base64 encoding');
    }

    // Validate content before encoding
    validateVTTFormat(vttContent);

    // Generate Base64 encoding
    const buffer = Buffer.from(vttContent, 'utf8');
    const base64Content = buffer.toString('base64');

    return {
        content: base64Content,
        mimeType: 'text/vtt',
        charset: 'utf-8',
        encoding: 'base64',
        size: {
            original: buffer.length,
            encoded: base64Content.length
        },
        metadata: {
            format: 'WebVTT',
            bunnyStreamCompatible: true,
            encoding: 'UTF-8 without BOM'
        }
    };
}

/**
 * Gets the proper MIME type configuration for VTT files
 * @returns {Object} - MIME type configuration for different contexts
 */
function getVTTMimeTypeConfig() {
    return {
        primary: 'text/vtt',
        alternatives: ['text/vtt; charset=utf-8'],
        fileExtension: '.vtt',
        bunnyStream: {
            mimeType: 'text/vtt',
            charset: 'utf-8',
            contentType: 'text/vtt; charset=utf-8'
        },
        browser: {
            download: 'text/vtt; charset=utf-8',
            display: 'text/plain; charset=utf-8' // Fallback for browsers that don't support text/vtt
        }
    };
}

module.exports = {
    convertTimestamp,
    generateVTT,
    validateVTTFormat,
    validateBunnyStreamCompliance,
    generateBase64Output,
    getVTTMimeTypeConfig
};