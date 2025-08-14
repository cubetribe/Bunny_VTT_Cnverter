const iconv = require('iconv-lite');

/**
 * Detects the encoding of a buffer by analyzing byte patterns
 * Supports UTF-8, ISO-8859-1, and Windows-1252 detection
 * @param {Buffer} buffer - The file buffer to analyze
 * @returns {string} - Detected encoding name
 */
function detectEncoding(buffer) {
  if (!buffer || buffer.length === 0) {
    return 'utf8';
  }

  // Check for UTF-8 BOM
  if (buffer.length >= 3 && 
      buffer[0] === 0xEF && 
      buffer[1] === 0xBB && 
      buffer[2] === 0xBF) {
    return 'utf8';
  }

  // Check for UTF-16 BOMs
  if (buffer.length >= 2) {
    if ((buffer[0] === 0xFF && buffer[1] === 0xFE) ||
        (buffer[0] === 0xFE && buffer[1] === 0xFF)) {
      return 'utf8'; // We'll convert UTF-16 to UTF-8
    }
  }

  // Try to decode as UTF-8 first and check for replacement characters
  try {
    const utf8Decoded = iconv.decode(buffer, 'utf8');
    if (!utf8Decoded.includes('\uFFFD')) {
      return 'utf8';
    }
  } catch (error) {
    // UTF-8 decoding failed, continue with other checks
  }

  // Analyze byte patterns to distinguish between encodings
  let hasHighBytes = false;
  let windows1252Indicators = 0;
  let iso88591Indicators = 0;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    
    // Check for high bytes (> 127)
    if (byte > 127) {
      hasHighBytes = true;
      
      // Check for Windows-1252 specific characters (128-159 range)
      if (byte >= 128 && byte <= 159) {
        // These are printable characters in Windows-1252 but control chars in ISO-8859-1
        const win1252Chars = [0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8E, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9E, 0x9F];
        if (win1252Chars.includes(byte)) {
          windows1252Indicators++;
        }
      }
      
      // Check for common ISO-8859-1 characters (160-255 range)
      if (byte >= 160 && byte <= 255) {
        iso88591Indicators++;
      }
    }
  }

  // If no high bytes, it's ASCII (compatible with UTF-8)
  if (!hasHighBytes) {
    return 'utf8';
  }

  // If we have Windows-1252 indicators, it's likely Windows-1252
  if (windows1252Indicators > 0) {
    return 'windows-1252';
  }

  // If we have high bytes but no Windows-1252 indicators, try both encodings
  if (iso88591Indicators > 0) {
    // Test both encodings to see which produces better results
    try {
      const win1252Test = iconv.decode(buffer, 'windows-1252');
      const iso88591Test = iconv.decode(buffer, 'iso-8859-1');
      
      // If Windows-1252 produces replacement characters but ISO-8859-1 doesn't, prefer ISO-8859-1
      if (win1252Test.includes('\uFFFD') && !iso88591Test.includes('\uFFFD')) {
        return 'iso-8859-1';
      }
      
      // If both work, prefer Windows-1252 as it's more common
      if (!win1252Test.includes('\uFFFD') && !iso88591Test.includes('\uFFFD')) {
        return 'windows-1252';
      }
      
      // If ISO-8859-1 works but Windows-1252 doesn't
      if (!iso88591Test.includes('\uFFFD')) {
        return 'iso-8859-1';
      }
    } catch (error) {
      // If decoding fails, fall back to ISO-8859-1
      return 'iso-8859-1';
    }
  }

  // Default fallback
  return 'iso-8859-1';
}

/**
 * Converts a buffer from detected encoding to UTF-8 without BOM
 * @param {Buffer} buffer - The input buffer
 * @param {string} encoding - The source encoding (optional, will auto-detect if not provided)
 * @returns {Buffer} - UTF-8 encoded buffer without BOM
 */
function convertToUTF8(buffer, encoding = null) {
  if (!buffer || buffer.length === 0) {
    return Buffer.alloc(0);
  }

  try {
    const sourceEncoding = encoding || detectEncoding(buffer);
    
    let decoded = iconv.decode(buffer, sourceEncoding);
    
    // After decoding, run the fix routine to catch potential double-encoded characters.
    // This is safe to run even on correctly-encoded strings.
    decoded = fixDoubleEncodedUTF8(decoded);
    
    const utf8Buffer = iconv.encode(decoded, 'utf8');
    
    // Ensure no BOM in output
    if (utf8Buffer.length >= 3 && 
        utf8Buffer[0] === 0xEF && 
        utf8Buffer[1] === 0xBB && 
        utf8Buffer[2] === 0xBF) {
      return utf8Buffer.slice(3);
    }
    
    return utf8Buffer;
  } catch (error) {
    console.warn(`Encoding conversion failed for ${encoding || 'auto-detected'}: ${error.message}`);
    console.warn('Falling back to UTF-8 interpretation');
    
    if (buffer.length >= 3 && 
        buffer[0] === 0xEF && 
        buffer[1] === 0xBB && 
        buffer[2] === 0xBF) {
      return buffer.slice(3);
    }
    return buffer;
  }
}

/**
 * Fixes double-encoded UTF-8 text where UTF-8 bytes were misinterpreted as a single-byte encoding.
 * @param {string} text - The text with potential double-encoding issues
 * @returns {string} - Fixed text with correct UTF-8 characters
 */
function fixDoubleEncodedUTF8(text) {
  try {
    // This pattern is a strong indicator of UTF-8 bytes being misinterpreted as latin1 or similar.
    // e.g., 'ü' (UTF-8: C3 BC) becomes 'Ã¼' when decoded as latin1.
    if (!text.includes('Ã')) {
      return text;
    }

    // Reverse the incorrect decoding: encode the broken string's char codes as bytes.
    const originalBytes = iconv.encode(text, 'latin1');

    // Now, decode those bytes correctly as UTF-8.
    const fixedText = iconv.decode(originalBytes, 'utf8');

    // If the fix didn't change anything or introduced new errors, revert to the original.
    if (fixedText === text || fixedText.includes('Ã')) {
      return text;
    }

    return fixedText;
  } catch (error) {
    // If the process fails, return the original text to prevent crashes.
    return text;
  }
}

/**
 * Validates if a buffer contains valid text in the specified encoding
 * @param {Buffer} buffer - The buffer to validate
 * @param {string} encoding - The encoding to validate against
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEncoding(buffer, encoding) {
  try {
    const decoded = iconv.decode(buffer, encoding);
    // Check if decoding was successful by looking for replacement characters
    return !decoded.includes('\uFFFD');
  } catch (error) {
    return false;
  }
}

module.exports = {
  detectEncoding,
  convertToUTF8,
  isValidEncoding,
  fixDoubleEncodedUTF8
};