/**
 * Tests for VTT Format Generation Module
 * Validates Bunny Stream compatibility and proper format conversion
 */

const { convertTimestamp, generateVTT, validateVTTFormat, validateBunnyStreamCompliance, generateBase64Output, getVTTMimeTypeConfig } = require('../utils/vtt-generator');
const { parseSRT } = require('../utils/srt-parser');
const { validSRTSamples, expectedVTTOutputs, edgeCaseSRTSamples } = require('./fixtures/test-data');

describe('VTT Generator Module', () => {
    describe('convertTimestamp', () => {
        test('should convert SRT timestamp to VTT format', () => {
            expect(convertTimestamp('00:00:01,500')).toBe('00:00:01.500');
            expect(convertTimestamp('01:23:45,123')).toBe('01:23:45.123');
            expect(convertTimestamp('23:59:59,999')).toBe('23:59:59.999');
        });

        test('should handle edge cases', () => {
            expect(convertTimestamp('00:00:00,000')).toBe('00:00:00.000');
            expect(convertTimestamp('12:34:56,789')).toBe('12:34:56.789');
        });

        test('should throw error for invalid timestamp format', () => {
            expect(() => convertTimestamp('invalid')).toThrow('Invalid SRT timestamp format');
            expect(() => convertTimestamp('1:23:45,123')).toThrow('Invalid SRT timestamp format');
            expect(() => convertTimestamp('01:23:45.123')).toThrow('Invalid SRT timestamp format');
            expect(() => convertTimestamp('01:23:45,12')).toThrow('Invalid SRT timestamp format');
            expect(() => convertTimestamp('01:60:00,000')).toThrow('Invalid SRT timestamp format'); // Invalid minutes
            expect(() => convertTimestamp('01:23:60,000')).toThrow('Invalid SRT timestamp format'); // Invalid seconds
        });

        test('should throw error for invalid input types', () => {
            expect(() => convertTimestamp(null)).toThrow('Invalid timestamp: must be a non-empty string');
            expect(() => convertTimestamp(undefined)).toThrow('Invalid timestamp: must be a non-empty string');
            expect(() => convertTimestamp('')).toThrow('Invalid timestamp: must be a non-empty string');
            expect(() => convertTimestamp(123)).toThrow('Invalid timestamp: must be a non-empty string');
        });
    });

    describe('generateVTT', () => {
        const sampleSubtitles = [
            {
                index: 1,
                startTime: '00:00:01,000',
                endTime: '00:00:03,000',
                text: 'Hello, world!'
            },
            {
                index: 2,
                startTime: '00:00:04,500',
                endTime: '00:00:07,200',
                text: 'This is a test subtitle.'
            }
        ];

        test('should generate valid VTT format with WEBVTT header', () => {
            const result = generateVTT(sampleSubtitles);
            
            expect(result).toMatch(/^WEBVTT\n\n/);
            expect(result).toContain('00:00:01.000 --> 00:00:03.000');
            expect(result).toContain('Hello, world!');
            expect(result).toContain('00:00:04.500 --> 00:00:07.200');
            expect(result).toContain('This is a test subtitle.');
        });

        test('should not include subtitle sequence numbers', () => {
            const result = generateVTT(sampleSubtitles);
            
            // Should not contain standalone numbers that would be sequence numbers
            const lines = result.split('\n');
            let foundSequenceNumber = false;
            
            for (let i = 2; i < lines.length; i++) { // Skip WEBVTT header and empty line
                const line = lines[i].trim();
                if (/^\d+$/.test(line)) {
                    // Check if this number is followed by a timestamp
                    if (i + 1 < lines.length && /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/.test(lines[i + 1])) {
                        foundSequenceNumber = true;
                        break;
                    }
                }
            }
            
            expect(foundSequenceNumber).toBe(false);
        });

        test('should convert all timestamps from comma to period format', () => {
            const result = generateVTT(sampleSubtitles);
            
            // Check that timestamps use periods, not commas
            expect(result).toContain('00:00:01.000 --> 00:00:03.000');
            expect(result).toContain('00:00:04.500 --> 00:00:07.200');
            
            // Ensure no comma-separated timestamps remain
            expect(result).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);
        });

        test('should include empty line after WEBVTT header', () => {
            const result = generateVTT(sampleSubtitles);
            
            expect(result.startsWith('WEBVTT\n\n')).toBe(true);
        });

        test('should preserve text content and line breaks', () => {
            const subtitlesWithLineBreaks = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    endTime: '00:00:03,000',
                    text: 'Line 1\nLine 2\nLine 3'
                }
            ];
            
            const result = generateVTT(subtitlesWithLineBreaks);
            
            expect(result).toContain('Line 1\nLine 2\nLine 3');
        });

        test('should handle single subtitle', () => {
            const singleSubtitle = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    endTime: '00:00:03,000',
                    text: 'Single subtitle'
                }
            ];
            
            const result = generateVTT(singleSubtitle);
            
            expect(result).toMatch(/^WEBVTT\n\n/);
            expect(result).toContain('00:00:01.000 --> 00:00:03.000');
            expect(result).toContain('Single subtitle');
        });

        test('should handle special characters and umlauts', () => {
            const germanSubtitles = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    endTime: '00:00:03,000',
                    text: 'Hällö Wörld! Tschüß!'
                }
            ];
            
            const result = generateVTT(germanSubtitles);
            
            expect(result).toContain('Hällö Wörld! Tschüß!');
        });

        test('should throw error for invalid input', () => {
            expect(() => generateVTT(null)).toThrow('Invalid input: subtitles must be an array');
            expect(() => generateVTT(undefined)).toThrow('Invalid input: subtitles must be an array');
            expect(() => generateVTT('not an array')).toThrow('Invalid input: subtitles must be an array');
        });

        test('should throw error for empty subtitles array', () => {
            expect(() => generateVTT([])).toThrow('No subtitles provided for VTT generation');
        });

        test('should throw error for invalid subtitle objects', () => {
            const invalidSubtitles = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    // Missing endTime and text
                }
            ];
            
            expect(() => generateVTT(invalidSubtitles)).toThrow('Missing required fields in subtitle at index 0');
        });

        test('should throw error for invalid timestamps in subtitles', () => {
            const invalidTimestampSubtitles = [
                {
                    index: 1,
                    startTime: 'invalid',
                    endTime: '00:00:03,000',
                    text: 'Test'
                }
            ];
            
            expect(() => generateVTT(invalidTimestampSubtitles)).toThrow('Error processing subtitle at index 0');
        });
    });

    describe('validateVTTFormat', () => {
        const validVTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';

        test('should validate correct VTT format', () => {
            expect(validateVTTFormat(validVTT)).toBe(true);
        });

        test('should reject VTT without WEBVTT header', () => {
            const invalidVTT = '00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';
            
            expect(() => validateVTTFormat(invalidVTT)).toThrow('VTT content must start with "WEBVTT" header');
        });

        test('should reject VTT without empty line after header', () => {
            const invalidVTT = 'WEBVTT\n00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';
            
            expect(() => validateVTTFormat(invalidVTT)).toThrow('VTT content must have empty line after WEBVTT header');
        });

        test('should reject VTT with BOM', () => {
            const vttWithBOM = '\uFEFF' + validVTT;
            
            expect(() => validateVTTFormat(vttWithBOM)).toThrow('VTT content must not contain BOM');
        });

        test('should reject VTT with subtitle sequence numbers', () => {
            const vttWithSequenceNumbers = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';
            
            expect(() => validateVTTFormat(vttWithSequenceNumbers)).toThrow('VTT content must not contain subtitle sequence numbers');
        });

        test('should reject VTT without valid timestamps', () => {
            const invalidVTT = 'WEBVTT\n\nHello, world!\n\n';
            
            expect(() => validateVTTFormat(invalidVTT)).toThrow('No valid VTT timestamps found in content');
        });

        test('should reject invalid input types', () => {
            expect(() => validateVTTFormat(null)).toThrow('Invalid VTT content: must be a non-empty string');
            expect(() => validateVTTFormat(undefined)).toThrow('Invalid VTT content: must be a non-empty string');
            expect(() => validateVTTFormat('')).toThrow('Invalid VTT content: must be a non-empty string');
        });

        test('should validate complex VTT with multiple subtitles', () => {
            const complexVTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
First subtitle

00:00:04.500 --> 00:00:07.200
Second subtitle
with multiple lines

00:00:08.000 --> 00:00:10.000
Third subtitle with special chars: äöü

`;
            
            expect(validateVTTFormat(complexVTT)).toBe(true);
        });
    });

    describe('Integration tests', () => {
        test('should generate and validate VTT from SRT-like data', () => {
            const srtData = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    endTime: '00:00:03,500',
                    text: 'Welcome to the test!'
                },
                {
                    index: 2,
                    startTime: '00:00:04,000',
                    endTime: '00:00:07,200',
                    text: 'This is a multi-line\nsubtitle with German text: Hällö!'
                }
            ];

            const vttContent = generateVTT(srtData);
            
            // Should generate valid VTT
            expect(validateVTTFormat(vttContent)).toBe(true);
            
            // Should meet all Bunny Stream requirements
            expect(vttContent.startsWith('WEBVTT\n\n')).toBe(true);
            expect(vttContent).toContain('00:00:01.000 --> 00:00:03.500');
            expect(vttContent).toContain('00:00:04.000 --> 00:00:07.200');
            expect(vttContent).toContain('Welcome to the test!');
            expect(vttContent).toContain('This is a multi-line\nsubtitle with German text: Hällö!');
            expect(vttContent).not.toContain(','); // No comma separators
            expect(vttContent.charCodeAt(0)).not.toBe(0xFEFF); // No BOM
        });

        test('should convert all valid SRT samples to valid VTT', () => {
            Object.entries(validSRTSamples).forEach(([sampleName, srtContent]) => {
                const parsedSRT = parseSRT(srtContent);
                const vttContent = generateVTT(parsedSRT);
                
                // Should generate valid VTT
                expect(validateVTTFormat(vttContent)).toBe(true);
                
                // Should meet Bunny Stream requirements
                expect(vttContent.startsWith('WEBVTT\n\n')).toBe(true);
                expect(vttContent.charCodeAt(0)).not.toBe(0xFEFF); // No BOM
                expect(vttContent).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/); // No comma separators
                
                // Should not contain sequence numbers
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

        test('should match expected VTT outputs for known samples', () => {
            Object.entries(expectedVTTOutputs).forEach(([sampleName, expectedVTT]) => {
                if (validSRTSamples[sampleName]) {
                    const parsedSRT = parseSRT(validSRTSamples[sampleName]);
                    const generatedVTT = generateVTT(parsedSRT);
                    expect(generatedVTT).toBe(expectedVTT);
                }
            });
        });

        test('should handle edge case SRT samples', () => {
            Object.entries(edgeCaseSRTSamples).forEach(([sampleName, srtContent]) => {
                const parsedSRT = parseSRT(srtContent);
                const vttContent = generateVTT(parsedSRT);
                
                expect(validateVTTFormat(vttContent)).toBe(true);
                expect(vttContent.startsWith('WEBVTT\n\n')).toBe(true);
            });
        });

        test('should preserve text content integrity', () => {
            const srtContent = validSRTSamples.german;
            const parsedSRT = parseSRT(srtContent);
            const vttContent = generateVTT(parsedSRT);
            
            // Should contain all original text
            expect(vttContent).toContain('Hällö Wörld mit Ümläüten');
            expect(vttContent).toContain('Müller sagte "Guten Tag"');
            expect(vttContent).toContain('Größe: 42 weiß');
            
            // Should have correct timestamp conversion
            expect(vttContent).toContain('00:00:01.000 --> 00:00:03.000');
            expect(vttContent).toContain('00:00:04.000 --> 00:00:06.000');
        });

        test('should handle very long content', () => {
            const parsedSRT = parseSRT(edgeCaseSRTSamples.veryLongText);
            const vttContent = generateVTT(parsedSRT);
            
            expect(validateVTTFormat(vttContent)).toBe(true);
            expect(vttContent).toContain('This is a very long subtitle');
            expect(vttContent).toContain('multiple paragraphs');
        });
    });

    describe('validateBunnyStreamCompliance', () => {
        const validVTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';

        test('should validate compliant VTT content', () => {
            const result = validateBunnyStreamCompliance(validVTT);
            
            expect(result.isValid).toBe(true);
            expect(result.compliance.hasWebVTTHeader).toBe(true);
            expect(result.compliance.hasEmptyLineAfterHeader).toBe(true);
            expect(result.compliance.noBOM).toBe(true);
            expect(result.compliance.noSequenceNumbers).toBe(true);
            expect(result.compliance.validTimestamps).toBe(true);
            expect(result.compliance.properEncoding).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect BOM in content', () => {
            const vttWithBOM = '\uFEFF' + validVTT;
            const result = validateBunnyStreamCompliance(vttWithBOM);
            
            expect(result.isValid).toBe(false);
            expect(result.compliance.noBOM).toBe(false);
            expect(result.errors).toContain('VTT content must not contain BOM (Byte Order Mark)');
        });

        test('should detect missing WEBVTT header', () => {
            const invalidVTT = '00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';
            const result = validateBunnyStreamCompliance(invalidVTT);
            
            expect(result.isValid).toBe(false);
            expect(result.compliance.hasWebVTTHeader).toBe(false);
            expect(result.errors).toContain('VTT content must start with "WEBVTT" header followed by newline');
        });

        test('should detect sequence numbers', () => {
            const vttWithSequenceNumbers = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';
            const result = validateBunnyStreamCompliance(vttWithSequenceNumbers);
            
            expect(result.isValid).toBe(false);
            expect(result.compliance.noSequenceNumbers).toBe(false);
            expect(result.errors).toContain('VTT content must not contain subtitle sequence numbers for Bunny Stream compatibility');
        });

        test('should detect Windows line endings as warning', () => {
            const vttWithCRLF = validVTT.replace(/\n/g, '\r\n');
            const result = validateBunnyStreamCompliance(vttWithCRLF);
            
            expect(result.warnings).toContain('Content contains Windows line endings (CRLF). Unix line endings (LF) are recommended.');
        });

        test('should detect tab characters as warning', () => {
            const vttWithTabs = validVTT.replace(' ', '\t');
            const result = validateBunnyStreamCompliance(vttWithTabs);
            
            expect(result.warnings).toContain('Content contains tab characters. Spaces are recommended for indentation.');
        });

        test('should detect whitespace in WEBVTT header as warning', () => {
            const vttWithWhitespace = ' WEBVTT \n\n00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';
            const result = validateBunnyStreamCompliance(vttWithWhitespace);
            
            expect(result.warnings).toContain('WEBVTT header should not have leading or trailing whitespace.');
        });

        test('should handle invalid VTT content', () => {
            const result = validateBunnyStreamCompliance('invalid content');
            
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should return detailed compliance information', () => {
            const result = validateBunnyStreamCompliance(validVTT);
            
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('compliance');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('warnings');
            
            expect(result.compliance).toHaveProperty('hasWebVTTHeader');
            expect(result.compliance).toHaveProperty('hasEmptyLineAfterHeader');
            expect(result.compliance).toHaveProperty('noBOM');
            expect(result.compliance).toHaveProperty('noSequenceNumbers');
            expect(result.compliance).toHaveProperty('validTimestamps');
            expect(result.compliance).toHaveProperty('properEncoding');
        });
    });

    describe('generateBase64Output', () => {
        const validVTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello, world!\n\n';

        test('should generate Base64 encoded VTT content', () => {
            const result = generateBase64Output(validVTT);
            
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('mimeType');
            expect(result).toHaveProperty('charset');
            expect(result).toHaveProperty('encoding');
            expect(result).toHaveProperty('size');
            expect(result).toHaveProperty('metadata');
            
            expect(result.mimeType).toBe('text/vtt');
            expect(result.charset).toBe('utf-8');
            expect(result.encoding).toBe('base64');
            expect(result.metadata.bunnyStreamCompatible).toBe(true);
        });

        test('should produce valid Base64 encoding', () => {
            const result = generateBase64Output(validVTT);
            
            // Should be valid Base64
            expect(result.content).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
            
            // Should decode back to original content
            const decoded = Buffer.from(result.content, 'base64').toString('utf8');
            expect(decoded).toBe(validVTT);
        });

        test('should include size information', () => {
            const result = generateBase64Output(validVTT);
            
            expect(result.size.original).toBe(Buffer.byteLength(validVTT, 'utf8'));
            expect(result.size.encoded).toBe(result.content.length);
            expect(result.size.encoded).toBeGreaterThan(result.size.original); // Base64 is larger
        });

        test('should validate VTT content before encoding', () => {
            const invalidVTT = 'invalid content';
            
            expect(() => generateBase64Output(invalidVTT)).toThrow();
        });

        test('should handle empty or invalid input', () => {
            expect(() => generateBase64Output('')).toThrow('Invalid VTT content for Base64 encoding');
            expect(() => generateBase64Output(null)).toThrow('Invalid VTT content for Base64 encoding');
            expect(() => generateBase64Output(undefined)).toThrow('Invalid VTT content for Base64 encoding');
        });

        test('should include proper metadata for Bunny Stream', () => {
            const result = generateBase64Output(validVTT);
            
            expect(result.metadata.format).toBe('WebVTT');
            expect(result.metadata.bunnyStreamCompatible).toBe(true);
            expect(result.metadata.encoding).toBe('UTF-8 without BOM');
        });

        test('should handle special characters correctly', () => {
            const vttWithSpecialChars = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHällö Wörld! 🌍\n\n';
            const result = generateBase64Output(vttWithSpecialChars);
            
            // Should decode back to original with special characters intact
            const decoded = Buffer.from(result.content, 'base64').toString('utf8');
            expect(decoded).toBe(vttWithSpecialChars);
            expect(decoded).toContain('Hällö Wörld! 🌍');
        });
    });

    describe('getVTTMimeTypeConfig', () => {
        test('should return proper MIME type configuration', () => {
            const config = getVTTMimeTypeConfig();
            
            expect(config).toHaveProperty('primary');
            expect(config).toHaveProperty('alternatives');
            expect(config).toHaveProperty('fileExtension');
            expect(config).toHaveProperty('bunnyStream');
            expect(config).toHaveProperty('browser');
            
            expect(config.primary).toBe('text/vtt');
            expect(config.fileExtension).toBe('.vtt');
        });

        test('should include Bunny Stream specific configuration', () => {
            const config = getVTTMimeTypeConfig();
            
            expect(config.bunnyStream.mimeType).toBe('text/vtt');
            expect(config.bunnyStream.charset).toBe('utf-8');
            expect(config.bunnyStream.contentType).toBe('text/vtt; charset=utf-8');
        });

        test('should include browser compatibility configuration', () => {
            const config = getVTTMimeTypeConfig();
            
            expect(config.browser.download).toBe('text/vtt; charset=utf-8');
            expect(config.browser.display).toBe('text/plain; charset=utf-8');
        });

        test('should include alternative MIME types', () => {
            const config = getVTTMimeTypeConfig();
            
            expect(config.alternatives).toBeInstanceOf(Array);
            expect(config.alternatives).toContain('text/vtt; charset=utf-8');
        });
    });

    describe('Enhanced integration tests', () => {
        test('should generate Bunny Stream compliant VTT with Base64 output', () => {
            const srtData = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    endTime: '00:00:03,500',
                    text: 'Welcome to Bunny Stream!'
                },
                {
                    index: 2,
                    startTime: '00:00:04,000',
                    endTime: '00:00:07,200',
                    text: 'German text: Hällö Wörld!'
                }
            ];

            const vttContent = generateVTT(srtData);
            
            // Should be Bunny Stream compliant
            const complianceResult = validateBunnyStreamCompliance(vttContent);
            expect(complianceResult.isValid).toBe(true);
            expect(complianceResult.errors).toHaveLength(0);
            
            // Should generate valid Base64
            const base64Result = generateBase64Output(vttContent);
            expect(base64Result.metadata.bunnyStreamCompatible).toBe(true);
            
            // Should have proper MIME type configuration
            const mimeConfig = getVTTMimeTypeConfig();
            expect(base64Result.mimeType).toBe(mimeConfig.primary);
        });

        test('should handle complex VTT with all features', () => {
            const complexSrtData = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    endTime: '00:00:03,500',
                    text: 'Multi-line subtitle\nwith line breaks'
                },
                {
                    index: 2,
                    startTime: '00:00:04,000',
                    endTime: '00:00:07,200',
                    text: 'Special chars: äöüß €'
                },
                {
                    index: 3,
                    startTime: '00:00:08,000',
                    endTime: '00:00:10,500',
                    text: 'Emoji test: 🎬 🎭 🎪'
                }
            ];

            const vttContent = generateVTT(complexSrtData);
            
            // Validate compliance
            const complianceResult = validateBunnyStreamCompliance(vttContent);
            expect(complianceResult.isValid).toBe(true);
            
            // Generate Base64
            const base64Result = generateBase64Output(vttContent);
            
            // Verify content integrity through Base64 round-trip
            const decoded = Buffer.from(base64Result.content, 'base64').toString('utf8');
            expect(decoded).toBe(vttContent);
            expect(decoded).toContain('Multi-line subtitle\nwith line breaks');
            expect(decoded).toContain('Special chars: äöüß €');
            expect(decoded).toContain('Emoji test: 🎬 🎭 🎪');
        });

        test('should maintain all Bunny Stream requirements through full pipeline', () => {
            const testData = [
                {
                    index: 1,
                    startTime: '00:00:01,000',
                    endTime: '00:00:03,000',
                    text: 'Test subtitle'
                }
            ];

            const vttContent = generateVTT(testData);
            
            // Check all Bunny Stream requirements
            expect(vttContent.startsWith('WEBVTT\n\n')).toBe(true);
            expect(vttContent.charCodeAt(0)).not.toBe(0xFEFF); // No BOM
            expect(vttContent).toContain('00:00:01.000 --> 00:00:03.000'); // Period format
            expect(vttContent).not.toMatch(/^\d+$/m); // No sequence numbers
            
            // Validate compliance
            const complianceResult = validateBunnyStreamCompliance(vttContent);
            expect(complianceResult.isValid).toBe(true);
            expect(Object.values(complianceResult.compliance).every(check => check === true)).toBe(true);
            
            // Generate Base64 for API integration
            const base64Result = generateBase64Output(vttContent);
            expect(base64Result.metadata.bunnyStreamCompatible).toBe(true);
            
            // Verify MIME type configuration
            const mimeConfig = getVTTMimeTypeConfig();
            expect(base64Result.mimeType).toBe(mimeConfig.bunnyStream.mimeType);
        });
    });
});