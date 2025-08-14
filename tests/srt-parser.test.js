/**
 * Unit tests for SRT format validation and parsing
 */

const { validateSRTFormat, parseSRT, parseTimestamp } = require('../utils/srt-parser');
const { 
  validSRTSamples, 
  invalidSRTSamples, 
  edgeCaseSRTSamples, 
  malformedSRTSamples 
} = require('./fixtures/test-data');

describe('SRT Format Validation', () => {
    test('should validate correct SRT format', () => {
        const validSRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,000
This is a test subtitle`;

        expect(validateSRTFormat(validSRT)).toBe(true);
    });

    test('should validate SRT with multiple text lines', () => {
        const validSRT = `1
00:00:01,000 --> 00:00:04,000
Hello world
This is line two

2
00:00:05,000 --> 00:00:08,000
Another subtitle
With multiple lines
And even more text`;

        expect(validateSRTFormat(validSRT)).toBe(true);
    });

    test('should validate SRT with Windows line endings', () => {
        const validSRT = `1\r\n00:00:01,000 --> 00:00:04,000\r\nHello world\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nTest subtitle`;

        expect(validateSRTFormat(validSRT)).toBe(true);
    });

    test('should validate SRT with BOM', () => {
        const validSRT = `\uFEFF1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,000
Test subtitle`;

        expect(validateSRTFormat(validSRT)).toBe(true);
    });

    test('should reject empty content', () => {
        expect(validateSRTFormat('')).toBe(false);
        expect(validateSRTFormat(null)).toBe(false);
        expect(validateSRTFormat(undefined)).toBe(false);
    });

    test('should reject non-string content', () => {
        expect(validateSRTFormat(123)).toBe(false);
        expect(validateSRTFormat({})).toBe(false);
        expect(validateSRTFormat([])).toBe(false);
    });

    test('should reject invalid subtitle index', () => {
        const invalidSRT = `abc
00:00:01,000 --> 00:00:04,000
Hello world`;

        expect(validateSRTFormat(invalidSRT)).toBe(false);
    });

    test('should reject invalid timestamp format', () => {
        const invalidSRT = `1
00:00:01.000 --> 00:00:04.000
Hello world`;

        expect(validateSRTFormat(invalidSRT)).toBe(false);
    });

    test('should reject missing timestamp separator', () => {
        const invalidSRT = `1
00:00:01,000 00:00:04,000
Hello world`;

        expect(validateSRTFormat(invalidSRT)).toBe(false);
    });

    test('should reject subtitle without text', () => {
        const invalidSRT = `1
00:00:01,000 --> 00:00:04,000

`;

        expect(validateSRTFormat(invalidSRT)).toBe(false);
    });

    test('should reject incomplete subtitle block', () => {
        const invalidSRT = `1
00:00:01,000 --> 00:00:04,000`;

        expect(validateSRTFormat(invalidSRT)).toBe(false);
    });
});

describe('SRT Parsing', () => {
    test('should parse simple SRT correctly', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:08,750
This is a test`;

        const result = parseSRT(srtContent);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            index: 1,
            startTime: '00:00:01,000',
            endTime: '00:00:04,000',
            text: 'Hello world'
        });
        expect(result[1]).toEqual({
            index: 2,
            startTime: '00:00:05,500',
            endTime: '00:00:08,750',
            text: 'This is a test'
        });
    });

    test('should parse SRT with multi-line text', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
Hello world
This is line two

2
00:00:05,000 --> 00:00:08,000
Another subtitle
With multiple lines`;

        const result = parseSRT(srtContent);

        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('Hello world\nThis is line two');
        expect(result[1].text).toBe('Another subtitle\nWith multiple lines');
    });

    test('should parse SRT with special characters', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
Hällö wörld with ümlaut

2
00:00:05,000 --> 00:00:08,000
Spëcial chäractërs: àáâãäåæçèéêë`;

        const result = parseSRT(srtContent);

        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('Hällö wörld with ümlaut');
        expect(result[1].text).toBe('Spëcial chäractërs: àáâãäåæçèéêë');
    });

    test('should handle different line ending formats', () => {
        const srtContent = `1\r\n00:00:01,000 --> 00:00:04,000\r\nHello world\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nTest subtitle`;

        const result = parseSRT(srtContent);

        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('Hello world');
        expect(result[1].text).toBe('Test subtitle');
    });

    test('should handle BOM in content', () => {
        const srtContent = `\uFEFF1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,000
Test subtitle`;

        const result = parseSRT(srtContent);

        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('Hello world');
    });

    test('should throw error for invalid SRT format', () => {
        const invalidSRT = `invalid
content
here`;

        expect(() => parseSRT(invalidSRT)).toThrow('Invalid SRT format');
    });

    test('should handle extra whitespace in timestamps', () => {
        const srtContent = `1
00:00:01,000   -->   00:00:04,000
Hello world`;

        const result = parseSRT(srtContent);

        expect(result).toHaveLength(1);
        expect(result[0].startTime).toBe('00:00:01,000');
        expect(result[0].endTime).toBe('00:00:04,000');
    });

    test('should preserve empty lines within subtitle text', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
Line one

Line three`;

        const result = parseSRT(srtContent);

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Line one\n\nLine three');
    });
});

describe('Timestamp Parsing', () => {
    test('should parse valid timestamp correctly', () => {
        const result = parseTimestamp('01:23:45,678');

        expect(result).toEqual({
            hours: 1,
            minutes: 23,
            seconds: 45,
            milliseconds: 678
        });
    });

    test('should parse zero timestamp', () => {
        const result = parseTimestamp('00:00:00,000');

        expect(result).toEqual({
            hours: 0,
            minutes: 0,
            seconds: 0,
            milliseconds: 0
        });
    });

    test('should parse maximum valid timestamp', () => {
        const result = parseTimestamp('23:59:59,999');

        expect(result).toEqual({
            hours: 23,
            minutes: 59,
            seconds: 59,
            milliseconds: 999
        });
    });

    test('should throw error for invalid timestamp format', () => {
        expect(() => parseTimestamp('1:23:45,678')).toThrow('Invalid timestamp format');
        expect(() => parseTimestamp('01:23:45.678')).toThrow('Invalid timestamp format');
        expect(() => parseTimestamp('01:23:45,67')).toThrow('Invalid timestamp format');
        expect(() => parseTimestamp('01:23:45,6789')).toThrow('Invalid timestamp format');
        expect(() => parseTimestamp('invalid')).toThrow('Invalid timestamp format');
    });
});

describe('Error Handling', () => {
    test('should handle malformed SRT with missing index', () => {
        const malformedSRT = `00:00:01,000 --> 00:00:04,000
Hello world`;

        expect(validateSRTFormat(malformedSRT)).toBe(false);
        expect(() => parseSRT(malformedSRT)).toThrow('Invalid SRT format');
    });

    test('should handle malformed SRT with invalid timestamp', () => {
        const malformedSRT = `1
invalid timestamp
Hello world`;

        expect(validateSRTFormat(malformedSRT)).toBe(false);
        expect(() => parseSRT(malformedSRT)).toThrow('Invalid SRT format');
    });

    test('should handle SRT with only whitespace text', () => {
        const malformedSRT = `1
00:00:01,000 --> 00:00:04,000
   
   `;

        expect(validateSRTFormat(malformedSRT)).toBe(false);
    });

    test('should handle mixed valid and invalid blocks', () => {
        const malformedSRT = `1
00:00:01,000 --> 00:00:04,000
Valid subtitle

invalid_index
00:00:05,000 --> 00:00:08,000
Invalid subtitle`;

        expect(validateSRTFormat(malformedSRT)).toBe(false);
    });
});

describe('Comprehensive Format Validation', () => {
    test('should validate all valid SRT samples', () => {
        Object.entries(validSRTSamples).forEach(([sampleName, srtContent]) => {
            expect(validateSRTFormat(srtContent)).toBe(true);
        });
    });

    test('should reject all invalid SRT samples', () => {
        Object.entries(invalidSRTSamples).forEach(([sampleName, srtContent]) => {
            if (srtContent !== null && srtContent !== undefined) {
                expect(validateSRTFormat(srtContent)).toBe(false);
            }
        });
    });

    test('should handle edge case SRT samples', () => {
        Object.entries(edgeCaseSRTSamples).forEach(([sampleName, srtContent]) => {
            expect(validateSRTFormat(srtContent)).toBe(true);
        });
    });

    test('should reject malformed SRT samples', () => {
        Object.entries(malformedSRTSamples).forEach(([sampleName, srtContent]) => {
            expect(validateSRTFormat(srtContent)).toBe(false);
        });
    });
});

describe('Comprehensive Parsing Tests', () => {
    test('should parse all valid SRT samples correctly', () => {
        Object.entries(validSRTSamples).forEach(([sampleName, srtContent]) => {
            const result = parseSRT(srtContent);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            
            result.forEach((subtitle, index) => {
                expect(subtitle).toHaveProperty('index');
                expect(subtitle).toHaveProperty('startTime');
                expect(subtitle).toHaveProperty('endTime');
                expect(subtitle).toHaveProperty('text');
                expect(typeof subtitle.index).toBe('number');
                expect(typeof subtitle.startTime).toBe('string');
                expect(typeof subtitle.endTime).toBe('string');
                expect(typeof subtitle.text).toBe('string');
                expect(subtitle.text.trim().length).toBeGreaterThan(0);
            });
        });
    });

    test('should parse edge case SRT samples correctly', () => {
        Object.entries(edgeCaseSRTSamples).forEach(([sampleName, srtContent]) => {
            const result = parseSRT(srtContent);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
    });

    test('should throw errors for all invalid SRT samples', () => {
        Object.entries(invalidSRTSamples).forEach(([sampleName, srtContent]) => {
            if (srtContent !== null && srtContent !== undefined && srtContent !== '') {
                expect(() => parseSRT(srtContent)).toThrow('Invalid SRT format');
            }
        });
    });

    test('should throw errors for all malformed SRT samples', () => {
        Object.entries(malformedSRTSamples).forEach(([sampleName, srtContent]) => {
            expect(() => parseSRT(srtContent)).toThrow('Invalid SRT format');
        });
    });
});

describe('Stress Testing', () => {
    test('should handle very long SRT content', () => {
        const result = parseSRT(edgeCaseSRTSamples.veryLongText);
        expect(result).toHaveLength(2);
        expect(result[0].text.length).toBeGreaterThan(200);
        expect(result[1].text).toContain('multiple paragraphs');
    });

    test('should handle many empty lines', () => {
        const result = parseSRT(edgeCaseSRTSamples.manyEmptyLines);
        expect(result).toHaveLength(3);
        result.forEach(subtitle => {
            expect(subtitle.text.trim().length).toBeGreaterThan(0);
        });
    });

    test('should handle extra whitespace correctly', () => {
        const result = parseSRT(edgeCaseSRTSamples.extraWhitespace);
        expect(result).toHaveLength(2);
        expect(result[0].startTime).toBe('00:00:01,000');
        expect(result[0].endTime).toBe('00:00:03,000');
        expect(result[0].text).toBe('Text with extra whitespace');
    });
});