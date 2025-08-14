/**
 * SRT Format Validation and Parsing Module
 * Handles validation and parsing of SRT subtitle files
 */

/**
 * Validates if the content follows proper SRT format structure
 * @param {string} content - The SRT file content as string
 * @returns {boolean} - True if valid SRT format, false otherwise
 */
function validateSRTFormat(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }

    try {
        // Try to parse the content - if parsing fails, it's invalid
        parseSRTInternal(content);
        return true;
    } catch (error) {
        return false;
    }
}



/**
 * Internal function to parse SRT content with detailed error checking
 * @param {string} content - The SRT file content as string
 * @returns {Array} - Array of subtitle objects
 * @throws {Error} - If content is invalid SRT format
 */
function parseSRTInternal(content) {
    // Remove BOM if present and normalize line endings
    const normalizedContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Parse line by line to handle empty lines within subtitle text properly
    const lines = normalizedContent.split('\n');
    const subtitles = [];
    let i = 0;

    while (i < lines.length) {
        // Skip empty lines
        while (i < lines.length && lines[i].trim() === '') {
            i++;
        }

        if (i >= lines.length) break;

        // Parse subtitle index
        const indexLine = lines[i].trim();
        if (!/^\d+$/.test(indexLine)) {
            throw new Error(`Invalid subtitle index "${indexLine}" at line ${i + 1} (expected number)`);
        }
        const index = parseInt(indexLine, 10);
        i++;

        // Parse timestamp
        if (i >= lines.length) {
            throw new Error(`Missing timestamp for subtitle ${index}`);
        }
        const timestampLine = lines[i].trim();
        const timestampRegex = /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/;
        if (!timestampRegex.test(timestampLine)) {
            throw new Error(`Invalid timestamp format "${timestampLine}" for subtitle ${index}`);
        }
        const [startTime, endTime] = timestampLine.split(/\s*-->\s*/);
        i++;

        // Parse text lines until we hit the next subtitle or end of content
        const textLines = [];
        while (i < lines.length) {
            const line = lines[i];
            
            // Check if this might be the start of the next subtitle
            // (empty line followed by anything that looks like it could be an index)
            if (line.trim() === '' && i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                // If the next line looks like it could be an index (even invalid), 
                // and there's a potential timestamp after it, this might be a new subtitle
                if (nextLine !== '' && i + 2 < lines.length) {
                    const potentialTimestamp = lines[i + 2].trim();
                    if (/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(potentialTimestamp)) {
                        // This looks like a new subtitle block, validate the index
                        if (!/^\d+$/.test(nextLine)) {
                            throw new Error(`Invalid subtitle index "${nextLine}" at line ${i + 2} (expected number)`);
                        }
                        // Valid next subtitle, end current one
                        break;
                    }
                }
                // If next line is just a number, it's definitely a new subtitle
                if (/^\d+$/.test(nextLine)) {
                    break;
                }
            }
            
            textLines.push(line);
            i++;
        }

        // Validate that we have text content
        const hasText = textLines.some(line => line.trim().length > 0);
        if (!hasText) {
            throw new Error(`No text content found for subtitle ${index}`);
        }

        // Join text lines and trim the result
        const text = textLines.join('\n').trim();
        
        subtitles.push({
            index,
            startTime: startTime.trim(),
            endTime: endTime.trim(),
            text
        });
    }

    if (subtitles.length === 0) {
        throw new Error('No valid subtitle blocks found');
    }

    return subtitles;
}

/**
 * Parses SRT content into structured subtitle entries
 * @param {string} content - The SRT file content as string
 * @returns {Array} - Array of subtitle objects with index, startTime, endTime, text
 * @throws {Error} - If content is invalid SRT format
 */
function parseSRT(content) {
    try {
        return parseSRTInternal(content);
    } catch (error) {
        throw new Error('Invalid SRT format: ' + error.message);
    }
}

/**
 * Validates and parses timestamp format
 * @param {string} timestamp - Timestamp in format HH:MM:SS,mmm
 * @returns {Object} - Object with hours, minutes, seconds, milliseconds
 * @throws {Error} - If timestamp format is invalid
 */
function parseTimestamp(timestamp) {
    const timestampRegex = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/;
    const match = timestamp.match(timestampRegex);
    
    if (!match) {
        throw new Error(`Invalid timestamp format: ${timestamp}. Expected format: HH:MM:SS,mmm`);
    }

    const [, hours, minutes, seconds, milliseconds] = match;
    
    return {
        hours: parseInt(hours, 10),
        minutes: parseInt(minutes, 10),
        seconds: parseInt(seconds, 10),
        milliseconds: parseInt(milliseconds, 10)
    };
}

module.exports = {
    validateSRTFormat,
    parseSRT,
    parseTimestamp
};