const { detectEncoding, convertToUTF8, isValidEncoding } = require('../utils/encoding');
const iconv = require('iconv-lite');
const { createEncodedBuffers, createEncodingTestBuffers, validSRTSamples } = require('./fixtures/test-data');

describe('Encoding Detection and Conversion', () => {
  describe('detectEncoding', () => {
    test('should detect UTF-8 with BOM', () => {
      const bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello" with BOM
      expect(detectEncoding(bomBuffer)).toBe('utf8');
    });

    test('should detect UTF-8 without BOM', () => {
      const utf8Buffer = Buffer.from('Hello World', 'utf8');
      expect(detectEncoding(utf8Buffer)).toBe('utf8');
    });

    test('should detect UTF-8 with multi-byte characters', () => {
      const utf8Buffer = Buffer.from('Héllo Wörld ñ', 'utf8');
      expect(detectEncoding(utf8Buffer)).toBe('utf8');
    });

    test('should detect Windows-1252 encoding', () => {
      // Create buffer with Windows-1252 specific characters
      const win1252Buffer = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0x93, 0x94]); // Hello with smart quotes
      expect(detectEncoding(win1252Buffer)).toBe('windows-1252');
    });

    test('should detect non-UTF-8 encoding for high bytes', () => {
      // Create buffer that's invalid UTF-8 but valid in other encodings
      // Using bytes that would be invalid in UTF-8 but valid in ISO-8859-1/Windows-1252
      const nonUtf8Buffer = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0xC0, 0xE9]); // Hello Àé
      const detected = detectEncoding(nonUtf8Buffer);
      expect(['iso-8859-1', 'windows-1252']).toContain(detected);
    });

    test('should handle empty buffer', () => {
      expect(detectEncoding(Buffer.alloc(0))).toBe('utf8');
    });

    test('should handle null/undefined input', () => {
      expect(detectEncoding(null)).toBe('utf8');
      expect(detectEncoding(undefined)).toBe('utf8');
    });

    test('should detect ASCII as UTF-8', () => {
      const asciiBuffer = Buffer.from('Hello World 123', 'ascii');
      expect(detectEncoding(asciiBuffer)).toBe('utf8');
    });

    test('should handle UTF-16 BOM and return utf8', () => {
      const utf16LEBuffer = Buffer.from([0xFF, 0xFE, 0x48, 0x00, 0x65, 0x00]); // UTF-16 LE BOM + "He"
      expect(detectEncoding(utf16LEBuffer)).toBe('utf8');
      
      const utf16BEBuffer = Buffer.from([0xFE, 0xFF, 0x00, 0x48, 0x00, 0x65]); // UTF-16 BE BOM + "He"
      expect(detectEncoding(utf16BEBuffer)).toBe('utf8');
    });
  });

  describe('convertToUTF8', () => {
    test('should convert UTF-8 with BOM to UTF-8 without BOM', () => {
      const bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello" with BOM
      const result = convertToUTF8(bomBuffer);
      expect(result.toString('utf8')).toBe('Hello');
      // Ensure no BOM in result
      expect(result[0]).not.toBe(0xEF);
    });

    test('should preserve UTF-8 without BOM', () => {
      const utf8Buffer = Buffer.from('Hello World', 'utf8');
      const result = convertToUTF8(utf8Buffer);
      expect(result.toString('utf8')).toBe('Hello World');
      expect(result).toEqual(utf8Buffer);
    });

    test('should convert Windows-1252 to UTF-8', () => {
      const originalText = 'Hello "smart quotes"';
      const win1252Buffer = iconv.encode(originalText, 'windows-1252');
      const result = convertToUTF8(win1252Buffer, 'windows-1252');
      expect(result.toString('utf8')).toBe(originalText);
    });

    test('should convert ISO-8859-1 to UTF-8', () => {
      const originalText = 'Héllo Wörld';
      const iso88591Buffer = iconv.encode(originalText, 'iso-8859-1');
      const result = convertToUTF8(iso88591Buffer, 'iso-8859-1');
      expect(result.toString('utf8')).toBe(originalText);
    });

    test('should auto-detect encoding when not specified', () => {
      const originalText = 'Hello World';
      const utf8Buffer = Buffer.from(originalText, 'utf8');
      const result = convertToUTF8(utf8Buffer);
      expect(result.toString('utf8')).toBe(originalText);
    });

    test('should handle empty buffer', () => {
      const result = convertToUTF8(Buffer.alloc(0));
      expect(result.length).toBe(0);
    });

    test('should handle null/undefined input', () => {
      expect(convertToUTF8(null).length).toBe(0);
      expect(convertToUTF8(undefined).length).toBe(0);
    });

    test('should fallback to UTF-8 on conversion error', () => {
      // Create a buffer that might cause conversion issues
      const problematicBuffer = Buffer.from([0xFF, 0xFE, 0x00, 0x00]); // Invalid sequence
      const result = convertToUTF8(problematicBuffer, 'invalid-encoding');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    test('should preserve German umlauts correctly', () => {
      const germanText = 'Müller, Größe, weiß';
      const iso88591Buffer = iconv.encode(germanText, 'iso-8859-1');
      const result = convertToUTF8(iso88591Buffer, 'iso-8859-1');
      expect(result.toString('utf8')).toBe(germanText);
    });

    test('should handle special characters from Windows-1252', () => {
      // Test with characters that are different between Windows-1252 and ISO-8859-1
      const win1252Text = 'Hello—world'; // em dash (0x97 in Windows-1252)
      const win1252Buffer = iconv.encode(win1252Text, 'windows-1252');
      const result = convertToUTF8(win1252Buffer, 'windows-1252');
      expect(result.toString('utf8')).toBe(win1252Text);
    });
  });

  describe('isValidEncoding', () => {
    test('should validate UTF-8 encoding', () => {
      const utf8Buffer = Buffer.from('Hello Wörld', 'utf8');
      expect(isValidEncoding(utf8Buffer, 'utf8')).toBe(true);
    });

    test('should validate Windows-1252 encoding', () => {
      const win1252Buffer = iconv.encode('Hello "world"', 'windows-1252');
      expect(isValidEncoding(win1252Buffer, 'windows-1252')).toBe(true);
    });

    test('should validate ISO-8859-1 encoding', () => {
      const iso88591Buffer = iconv.encode('Héllo', 'iso-8859-1');
      expect(isValidEncoding(iso88591Buffer, 'iso-8859-1')).toBe(true);
    });

    test('should return false for invalid encoding', () => {
      const buffer = Buffer.from('Hello', 'utf8');
      expect(isValidEncoding(buffer, 'invalid-encoding')).toBe(false);
    });

    test('should detect invalid UTF-8 sequences', () => {
      // Create an invalid UTF-8 sequence
      const invalidUTF8Buffer = Buffer.from([0xC0, 0x80]); // Overlong encoding
      expect(isValidEncoding(invalidUTF8Buffer, 'utf8')).toBe(false);
    });
  });

  describe('Integration tests', () => {
    test('should handle complete workflow: detect -> convert', () => {
      const originalText = 'SRT Subtitle: Müller sagte "Hallo Welt"';
      
      // Test with different source encodings
      const encodings = ['utf8', 'iso-8859-1', 'windows-1252'];
      
      encodings.forEach(encoding => {
        const sourceBuffer = iconv.encode(originalText, encoding);
        const detectedEncoding = detectEncoding(sourceBuffer);
        const convertedBuffer = convertToUTF8(sourceBuffer, detectedEncoding);
        const resultText = convertedBuffer.toString('utf8');
        
        expect(resultText).toBe(originalText);
      });
    });

    test('should handle SRT-like content with timestamps', () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
Héllo Wörld

2
00:00:04,000 --> 00:00:06,000
Müller sagte "Hallo"`;

      const iso88591Buffer = iconv.encode(srtContent, 'iso-8859-1');
      const detectedEncoding = detectEncoding(iso88591Buffer);
      const convertedBuffer = convertToUTF8(iso88591Buffer, detectedEncoding);
      const resultText = convertedBuffer.toString('utf8');
      
      expect(resultText).toBe(srtContent);
      expect(resultText).toContain('Héllo Wörld');
      expect(resultText).toContain('Müller');
    });

    test('should handle real SRT content with various encodings', () => {
      const encodedBuffers = createEncodedBuffers();
      
      Object.entries(encodedBuffers).forEach(([encodingName, buffer]) => {
        const detectedEncoding = detectEncoding(buffer);
        const convertedBuffer = convertToUTF8(buffer, detectedEncoding);
        const resultText = convertedBuffer.toString('utf8');
        
        // Should contain German text regardless of source encoding
        expect(resultText).toContain('Hällö Wörld mit Ümläüten');
        expect(resultText).toContain('Müller sagte "Guten Tag"');
        expect(resultText).toContain('Größe: 42 weiß');
        
        // Should not contain BOM
        expect(resultText.charCodeAt(0)).not.toBe(0xFEFF);
      });
    });

    test('should handle edge case buffers', () => {
      const testBuffers = createEncodingTestBuffers();
      
      Object.entries(testBuffers).forEach(([testName, buffer]) => {
        // Should not throw errors
        expect(() => {
          const encoding = detectEncoding(buffer);
          const converted = convertToUTF8(buffer, encoding);
          expect(Buffer.isBuffer(converted)).toBe(true);
        }).not.toThrow();
      });
    });

    test('should preserve content integrity through multiple conversions', () => {
      const originalContent = validSRTSamples.german;
      
      // Convert through multiple encodings
      const utf8Buffer = Buffer.from(originalContent, 'utf8');
      const iso88591Buffer = iconv.encode(iconv.decode(utf8Buffer, 'utf8'), 'iso-8859-1');
      const win1252Buffer = iconv.encode(iconv.decode(iso88591Buffer, 'iso-8859-1'), 'windows-1252');
      
      // Convert back to UTF-8
      const finalBuffer = convertToUTF8(win1252Buffer);
      const finalText = finalBuffer.toString('utf8');
      
      expect(finalText).toBe(originalContent);
    });
  });
});