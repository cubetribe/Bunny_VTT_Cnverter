/**
 * Integration tests for the complete SRT to VTT conversion pipeline
 * Tests the entire workflow from file upload to VTT generation
 */

const { detectEncoding, convertToUTF8 } = require('../utils/encoding');
const { validateSRTFormat, parseSRT } = require('../utils/srt-parser');
const { generateVTT, validateVTTFormat } = require('../utils/vtt-generator');
const OpenAIIntegration = require('../utils/openai-integration');
const { 
  validSRTSamples, 
  createEncodedBuffers, 
  expectedVTTOutputs 
} = require('./fixtures/test-data');
const iconv = require('iconv-lite');

describe('Complete Conversion Pipeline Integration', () => {
  let openaiIntegration;

  beforeEach(() => {
    // Mock OpenAI for consistent testing
    openaiIntegration = new OpenAIIntegration();
    openaiIntegration.client = null; // Disable OpenAI for pipeline tests
  });

  describe('End-to-End Conversion Workflow', () => {
    test('should complete full pipeline for UTF-8 content', async () => {
      const srtContent = validSRTSamples.german;
      const buffer = Buffer.from(srtContent, 'utf8');

      // Step 1: Encoding detection and conversion
      const detectedEncoding = detectEncoding(buffer);
      expect(detectedEncoding).toBe('utf8');

      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');

      // Step 2: SRT validation and parsing
      expect(validateSRTFormat(convertedContent)).toBe(true);
      const parsedSubtitles = parseSRT(convertedContent);
      expect(parsedSubtitles).toHaveLength(2);

      // Step 3: OpenAI correction (fallback)
      const correctionResult = await openaiIntegration.correctWithFallback(convertedContent);
      expect(correctionResult.success).toBe(true);
      expect(correctionResult.usedFallback).toBe(true);

      // Step 4: VTT generation
      const vttContent = generateVTT(parsedSubtitles);
      expect(validateVTTFormat(vttContent)).toBe(true);

      // Verify final output
      expect(vttContent).toMatch(/^WEBVTT\n\n/);
      expect(vttContent).toContain('Hällö Wörld mit Ümläüten');
      expect(vttContent).toContain('00:00:01.000 --> 00:00:03.000');
      expect(vttContent.charCodeAt(0)).not.toBe(0xFEFF); // No BOM
    });

    test('should complete full pipeline for ISO-8859-1 content', async () => {
      const srtContent = validSRTSamples.german;
      const buffer = iconv.encode(srtContent, 'iso-8859-1');

      // Step 1: Encoding detection and conversion
      const detectedEncoding = detectEncoding(buffer);
      expect(['iso-8859-1', 'windows-1252']).toContain(detectedEncoding);

      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');

      // Step 2: SRT validation and parsing
      expect(validateSRTFormat(convertedContent)).toBe(true);
      const parsedSubtitles = parseSRT(convertedContent);
      expect(parsedSubtitles).toHaveLength(2);

      // Step 3: VTT generation
      const vttContent = generateVTT(parsedSubtitles);
      expect(validateVTTFormat(vttContent)).toBe(true);

      // Verify content preservation
      expect(vttContent).toContain('Hällö Wörld mit Ümläüten');
      expect(vttContent).toContain('Müller sagte "Guten Tag"');
    });

    test('should complete full pipeline for Windows-1252 content', async () => {
      const srtContent = validSRTSamples.german;
      const buffer = iconv.encode(srtContent, 'windows-1252');

      // Complete pipeline
      const detectedEncoding = detectEncoding(buffer);
      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');
      
      expect(validateSRTFormat(convertedContent)).toBe(true);
      const parsedSubtitles = parseSRT(convertedContent);
      const vttContent = generateVTT(parsedSubtitles);
      
      expect(validateVTTFormat(vttContent)).toBe(true);
      expect(vttContent).toContain('Größe: 42 weiß');
    });

    test('should handle all valid SRT samples through complete pipeline', async () => {
      for (const [sampleName, srtContent] of Object.entries(validSRTSamples)) {
        const buffer = Buffer.from(srtContent, 'utf8');

        // Complete pipeline
        const detectedEncoding = detectEncoding(buffer);
        const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
        const convertedContent = utf8Buffer.toString('utf8');
        
        expect(validateSRTFormat(convertedContent)).toBe(true);
        const parsedSubtitles = parseSRT(convertedContent);
        expect(parsedSubtitles.length).toBeGreaterThan(0);
        
        const vttContent = generateVTT(parsedSubtitles);
        expect(validateVTTFormat(vttContent)).toBe(true);
        
        // Verify Bunny Stream compatibility
        expect(vttContent.startsWith('WEBVTT\n\n')).toBe(true);
        expect(vttContent).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/); // No comma separators
        expect(vttContent.charCodeAt(0)).not.toBe(0xFEFF); // No BOM
      }
    });
  });

  describe('Error Handling in Pipeline', () => {
    test('should handle encoding detection failures gracefully', () => {
      const problematicBuffer = Buffer.from([0xFF, 0xFE, 0x00, 0x00]);
      
      // Should not throw
      expect(() => {
        const encoding = detectEncoding(problematicBuffer);
        const converted = convertToUTF8(problematicBuffer, encoding);
        expect(Buffer.isBuffer(converted)).toBe(true);
      }).not.toThrow();
    });

    test('should handle SRT parsing failures in pipeline', () => {
      const invalidSRT = 'This is not valid SRT content';
      const buffer = Buffer.from(invalidSRT, 'utf8');
      
      const detectedEncoding = detectEncoding(buffer);
      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');
      
      expect(validateSRTFormat(convertedContent)).toBe(false);
      expect(() => parseSRT(convertedContent)).toThrow('Invalid SRT format');
    });

    test('should handle VTT generation failures in pipeline', () => {
      const invalidSubtitles = [
        {
          index: 1,
          startTime: 'invalid-timestamp',
          endTime: '00:00:03,000',
          text: 'Test'
        }
      ];
      
      expect(() => generateVTT(invalidSubtitles)).toThrow();
    });
  });

  describe('Performance and Stress Testing', () => {
    test('should handle large files efficiently', async () => {
      // Generate large SRT content
      let largeSRT = '';
      for (let i = 1; i <= 500; i++) {
        const startTime = `00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},000`;
        const endTime = `00:${String(Math.floor((i + 2) / 60)).padStart(2, '0')}:${String((i + 2) % 60).padStart(2, '0')},000`;
        largeSRT += `${i}\n${startTime} --> ${endTime}\nSubtitle ${i} with some longer text content\n\n`;
      }

      const startTime = Date.now();
      
      const buffer = Buffer.from(largeSRT, 'utf8');
      const detectedEncoding = detectEncoding(buffer);
      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');
      
      expect(validateSRTFormat(convertedContent)).toBe(true);
      const parsedSubtitles = parseSRT(convertedContent);
      expect(parsedSubtitles).toHaveLength(500);
      
      const vttContent = generateVTT(parsedSubtitles);
      expect(validateVTTFormat(vttContent)).toBe(true);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000); // 5 seconds
      
      // Verify content integrity
      expect(vttContent).toContain('Subtitle 1');
      expect(vttContent).toContain('Subtitle 500');
    });

    test('should handle multiple encodings consistently', () => {
      const encodedBuffers = createEncodedBuffers();
      const results = [];
      
      Object.entries(encodedBuffers).forEach(([encodingName, buffer]) => {
        const detectedEncoding = detectEncoding(buffer);
        const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
        const convertedContent = utf8Buffer.toString('utf8');
        
        expect(validateSRTFormat(convertedContent)).toBe(true);
        const parsedSubtitles = parseSRT(convertedContent);
        const vttContent = generateVTT(parsedSubtitles);
        
        results.push(vttContent);
      });
      
      // All results should be identical (same content, different source encodings)
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toBe(firstResult);
      });
    });
  });

  describe('Content Integrity Verification', () => {
    test('should preserve all subtitle content through pipeline', () => {
      const srtContent = validSRTSamples.multiLine;
      const buffer = Buffer.from(srtContent, 'utf8');
      
      const detectedEncoding = detectEncoding(buffer);
      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');
      const parsedSubtitles = parseSRT(convertedContent);
      const vttContent = generateVTT(parsedSubtitles);
      
      // Verify all text content is preserved
      expect(vttContent).toContain('Hello world');
      expect(vttContent).toContain('This is line two');
      expect(vttContent).toContain('Another subtitle');
      expect(vttContent).toContain('With multiple lines');
      expect(vttContent).toContain('And even more text');
      
      // Verify line breaks are preserved
      expect(vttContent).toContain('Hello world\nThis is line two');
      expect(vttContent).toContain('Another subtitle\nWith multiple lines\nAnd even more text');
    });

    test('should preserve special characters through pipeline', () => {
      const srtContent = validSRTSamples.specialChars;
      const buffer = Buffer.from(srtContent, 'utf8');
      
      const detectedEncoding = detectEncoding(buffer);
      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');
      const parsedSubtitles = parseSRT(convertedContent);
      const vttContent = generateVTT(parsedSubtitles);
      
      // Verify special characters are preserved
      expect(vttContent).toContain('àáâãäåæçèéêë');
      expect(vttContent).toContain('ìíîïðñòóôõö÷øùúûüýþÿ');
    });

    test('should correctly convert timestamps through pipeline', () => {
      const srtContent = validSRTSamples.longTimestamps;
      const buffer = Buffer.from(srtContent, 'utf8');
      
      const detectedEncoding = detectEncoding(buffer);
      const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
      const convertedContent = utf8Buffer.toString('utf8');
      const parsedSubtitles = parseSRT(convertedContent);
      const vttContent = generateVTT(parsedSubtitles);
      
      // Verify timestamp conversion (comma to period)
      expect(vttContent).toContain('01:23:45.678 --> 01:23:48.901');
      expect(vttContent).toContain('23:59:58.999 --> 23:59:59.999');
      expect(vttContent).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/); // No comma separators
    });
  });

  describe('Bunny Stream Compatibility Verification', () => {
    test('should generate Bunny Stream compatible VTT for all samples', () => {
      Object.entries(validSRTSamples).forEach(([sampleName, srtContent]) => {
        const buffer = Buffer.from(srtContent, 'utf8');
        
        const detectedEncoding = detectEncoding(buffer);
        const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
        const convertedContent = utf8Buffer.toString('utf8');
        const parsedSubtitles = parseSRT(convertedContent);
        const vttContent = generateVTT(parsedSubtitles);
        
        // Bunny Stream requirements
        expect(vttContent.startsWith('WEBVTT\n\n')).toBe(true); // Correct header
        expect(vttContent.charCodeAt(0)).not.toBe(0xFEFF); // No BOM
        expect(vttContent).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/); // No comma separators
        
        // No sequence numbers
        const lines = vttContent.split('\n');
        let hasSequenceNumbers = false;
        for (let i = 2; i < lines.length; i++) {
          const line = lines[i].trim();
          if (/^\d+$/.test(line) && i + 1 < lines.length && 
              /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/.test(lines[i + 1])) {
            hasSequenceNumbers = true;
            break;
          }
        }
        expect(hasSequenceNumbers).toBe(false);
      });
    });

    test('should match expected VTT outputs exactly', () => {
      Object.entries(expectedVTTOutputs).forEach(([sampleName, expectedVTT]) => {
        if (validSRTSamples[sampleName]) {
          const srtContent = validSRTSamples[sampleName];
          const buffer = Buffer.from(srtContent, 'utf8');
          
          const detectedEncoding = detectEncoding(buffer);
          const utf8Buffer = convertToUTF8(buffer, detectedEncoding);
          const convertedContent = utf8Buffer.toString('utf8');
          const parsedSubtitles = parseSRT(convertedContent);
          const vttContent = generateVTT(parsedSubtitles);
          
          expect(vttContent).toBe(expectedVTT);
        }
      });
    });
  });
});