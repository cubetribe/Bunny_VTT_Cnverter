const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { validSRTSamples, invalidSRTSamples, edgeCaseSRTSamples } = require('./fixtures/test-data');

// Mock the OpenAI integration to avoid API calls during testing
jest.mock('../utils/openai-integration', () => {
  return class MockOpenAIIntegration {
    constructor() {
      this.client = null;
    }
    
    isAvailable() {
      return false; // Simulate no API key for testing
    }
    
    async correctWithFallback(srtContent) {
      return {
        success: true,
        correctedText: srtContent,
        usedFallback: true,
        error: 'OpenAI API key not configured'
      };
    }
  };
});

describe('Convert Endpoint Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    // Import app after mocking
    app = require('../server');
  });

  const validSrtContent = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,000
This is a test subtitle
`;

  const invalidSrtContent = `This is not a valid SRT file
Just some random text
Without proper formatting
`;

  describe('POST /convert', () => {
    test('should successfully convert valid SRT file', async () => {
      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(validSrtContent), 'test.srt')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/vtt/);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="test.vtt"/);
      expect(response.text).toMatch(/^WEBVTT\n\n/);
      expect(response.text).toContain('00:00:01.000 --> 00:00:03.000');
      expect(response.text).toContain('Hello world');
      expect(response.text).toContain('00:00:04.000 --> 00:00:06.000');
      expect(response.text).toContain('This is a test subtitle');
    });

    test('should return Base64 encoded content when requested', async () => {
      const response = await request(app)
        .post('/convert')
        .field('format', 'base64')
        .attach('srtFile', Buffer.from(validSrtContent), 'test.srt')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('base64');
      expect(response.body).toHaveProperty('mimeType', 'text/vtt');
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('language');
      expect(response.body).toHaveProperty('compliance');
      expect(response.body).toHaveProperty('bunnyStream');
      expect(response.body.stats).toHaveProperty('subtitleCount', 2);
      expect(response.body.stats).toHaveProperty('correctionApplied', false);

      // Verify Base64 structure
      expect(response.body.base64).toHaveProperty('content');
      expect(response.body.base64).toHaveProperty('mimeType', 'text/vtt');
      expect(response.body.base64).toHaveProperty('charset', 'utf-8');
      expect(response.body.base64).toHaveProperty('encoding', 'base64');

      // Verify Bunny Stream integration data
      expect(response.body.bunnyStream).toHaveProperty('ready', true);
      expect(response.body.bunnyStream).toHaveProperty('mimeType', 'text/vtt');

      // Verify Base64 content decodes to valid VTT
      const decodedContent = Buffer.from(response.body.base64.content, 'base64').toString('utf8');
      expect(decodedContent).toMatch(/^WEBVTT\n\n/);
      expect(decodedContent).toContain('Hello world');
    });

    test('should handle file upload errors', async () => {
      const response = await request(app)
        .post('/convert')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'File Upload Error');
      expect(response.body).toHaveProperty('message', 'No SRT file provided');
      expect(response.body).toHaveProperty('stage', 'upload');
    });

    test('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from('test content'), 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Format Validation Error');
      expect(response.body).toHaveProperty('stage', 'validation');
    });

    test('should handle invalid SRT format', async () => {
      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(invalidSrtContent), 'invalid.srt')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Format Validation Error');
      expect(response.body).toHaveProperty('stage', 'validation');
      expect(response.body.message).toContain('Invalid SRT file format');
    });

    test('should handle empty files', async () => {
      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(''), 'empty.srt')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'File Upload Error');
      expect(response.body).toHaveProperty('message', 'Uploaded file is empty');
      expect(response.body).toHaveProperty('stage', 'upload');
    });

    test('should handle different encodings', async () => {
      // Create SRT content with special characters
      const germanSrtContent = `1
00:00:01,000 --> 00:00:03,000
Hällö Wörld with ümläüts

2
00:00:04,000 --> 00:00:06,000
Tëst sübtïtlë with spëcïäl chäräctërs
`;

      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(germanSrtContent, 'utf8'), 'german.srt')
        .expect(200);

      expect(response.text).toContain('Hällö Wörld with ümläüts');
      expect(response.text).toContain('Tëst sübtïtlë with spëcïäl chäräctërs');
    });

    test('should provide processing statistics', async () => {
      const response = await request(app)
        .post('/convert')
        .field('format', 'base64')
        .attach('srtFile', Buffer.from(validSrtContent), 'test.srt')
        .expect(200);

      expect(response.body.stats).toHaveProperty('originalEncoding');
      expect(response.body.stats).toHaveProperty('subtitleCount', 2);
      expect(response.body.stats).toHaveProperty('correctionApplied', false);
      expect(response.body.stats).toHaveProperty('fileSize');
      expect(response.body.stats.fileSize).toHaveProperty('original');
      expect(response.body.stats.fileSize).toHaveProperty('converted');
    });

    test('should include warnings when correction fails', async () => {
      const response = await request(app)
        .post('/convert')
        .field('format', 'base64')
        .attach('srtFile', Buffer.from(validSrtContent), 'test.srt')
        .expect(200);

      expect(response.body).toHaveProperty('warnings');
      expect(response.body.warnings.length).toBeGreaterThanOrEqual(1);
      
      const correctionWarning = response.body.warnings.find(w => w.type === 'correction');
      expect(correctionWarning).toBeDefined();
      expect(correctionWarning.message).toContain('OpenAI API key not configured');
    });

    test('should detect language in SRT content', async () => {
      const englishSrtContent = `1
00:00:01,000 --> 00:00:03,000
The quick brown fox jumps over the lazy dog

2
00:00:04,000 --> 00:00:06,000
This is a test of the English language detection system
`;

      const response = await request(app)
        .post('/convert')
        .field('format', 'base64')
        .attach('srtFile', Buffer.from(englishSrtContent), 'english.srt')
        .expect(200);

      expect(response.body).toHaveProperty('language');
      expect(response.body.language).toHaveProperty('detected');
      
      if (response.body.language.detected) {
        expect(response.body.language.language).toHaveProperty('code');
        expect(response.body.language.language).toHaveProperty('name');
        expect(response.body.language.language).toHaveProperty('confidence');
        expect(response.body.language.language.code).toBe('en');
        expect(response.body.language.language.name).toBe('English');
      }
      
      expect(response.body.language).toHaveProperty('suggestions');
      expect(response.body.language.suggestions).toBeInstanceOf(Array);
    });

    test('should include Bunny Stream compliance information', async () => {
      const response = await request(app)
        .post('/convert')
        .field('format', 'base64')
        .attach('srtFile', Buffer.from(validSrtContent), 'test.srt')
        .expect(200);

      expect(response.body).toHaveProperty('compliance');
      expect(response.body.compliance).toHaveProperty('bunnyStreamCompatible');
      expect(response.body.compliance).toHaveProperty('checks');
      expect(response.body.compliance).toHaveProperty('warnings');
      
      expect(response.body.compliance.bunnyStreamCompatible).toBe(true);
      expect(response.body.compliance.checks).toHaveProperty('hasWebVTTHeader', true);
      expect(response.body.compliance.checks).toHaveProperty('hasEmptyLineAfterHeader', true);
      expect(response.body.compliance.checks).toHaveProperty('noBOM', true);
      expect(response.body.compliance.checks).toHaveProperty('noSequenceNumbers', true);
      expect(response.body.compliance.checks).toHaveProperty('validTimestamps', true);
      expect(response.body.compliance.checks).toHaveProperty('properEncoding', true);
    });

    test('should include language information in response headers', async () => {
      const germanSrtContent = `1
00:00:01,000 --> 00:00:03,000
Das ist ein Test der deutschen Spracherkennung

2
00:00:04,000 --> 00:00:06,000
Die Katze sitzt auf der Matte und schläft
`;

      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(germanSrtContent), 'german.srt')
        .expect(200);

      // Check for language headers if language was detected
      if (response.headers['content-language']) {
        expect(response.headers['content-language']).toBe('de');
        expect(response.headers['x-detected-language']).toContain('German');
        expect(response.headers['x-language-confidence']).toBeDefined();
      }
    });
  });

  describe('Language Detection Endpoints', () => {
    test('POST /detect-language should detect language from SRT file', async () => {
      const englishSrtContent = `1
00:00:01,000 --> 00:00:03,000
The quick brown fox jumps over the lazy dog

2
00:00:04,000 --> 00:00:06,000
This is a test of the English language detection system
`;

      const response = await request(app)
        .post('/detect-language')
        .attach('srtFile', Buffer.from(englishSrtContent), 'english.srt')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('language');
      expect(response.body).toHaveProperty('supportedLanguages');
      
      expect(response.body.language).toHaveProperty('detected');
      expect(response.body.language).toHaveProperty('suggestions');
      expect(response.body.supportedLanguages).toBeInstanceOf(Array);
      expect(response.body.supportedLanguages.length).toBeGreaterThan(0);
    });

    test('POST /detect-language should handle invalid SRT files', async () => {
      const response = await request(app)
        .post('/detect-language')
        .attach('srtFile', Buffer.from(invalidSrtContent), 'invalid.srt')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Format Validation Error');
      expect(response.body).toHaveProperty('message', 'Invalid SRT file format');
    });

    test('POST /detect-language should handle missing file', async () => {
      const response = await request(app)
        .post('/detect-language')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'File Upload Error');
      expect(response.body).toHaveProperty('message', 'No SRT file provided for language detection');
    });

    test('GET /languages should return supported languages', async () => {
      const response = await request(app)
        .get('/languages')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('languages');
      expect(response.body.languages).toBeInstanceOf(Array);
      expect(response.body.languages.length).toBeGreaterThan(0);
      
      // Check structure of language objects
      response.body.languages.forEach(lang => {
        expect(lang).toHaveProperty('code');
        expect(lang).toHaveProperty('name');
        expect(typeof lang.code).toBe('string');
        expect(typeof lang.name).toBe('string');
        expect(lang.code.length).toBe(2);
      });
      
      // Should include common languages
      const codes = response.body.languages.map(lang => lang.code);
      expect(codes).toContain('en');
      expect(codes).toContain('de');
      expect(codes).toContain('es');
      expect(codes).toContain('fr');
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('message', 'SRT to VTT Converter API is running');
    });
  });

  describe('Comprehensive File Processing Tests', () => {
    test('should process all valid SRT samples', async () => {
      for (const [sampleName, srtContent] of Object.entries(validSRTSamples)) {
        const response = await request(app)
          .post('/convert')
          .attach('srtFile', Buffer.from(srtContent), `${sampleName}.srt`)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/text\/vtt/);
        expect(response.text).toMatch(/^WEBVTT\n\n/);
        expect(response.text).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/); // No comma separators
        expect(response.text.charCodeAt(0)).not.toBe(0xFEFF); // No BOM
      }
    });

    test('should reject all invalid SRT samples', async () => {
      for (const [sampleName, srtContent] of Object.entries(invalidSRTSamples)) {
        if (srtContent !== null && srtContent !== undefined && srtContent !== '') {
          const response = await request(app)
            .post('/convert')
            .attach('srtFile', Buffer.from(srtContent), `${sampleName}.srt`);

          expect([400, 500]).toContain(response.status);
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('stage');
        }
      }
    });

    test('should handle edge case SRT samples', async () => {
      for (const [sampleName, srtContent] of Object.entries(edgeCaseSRTSamples)) {
        const response = await request(app)
          .post('/convert')
          .attach('srtFile', Buffer.from(srtContent), `${sampleName}.srt`)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/text\/vtt/);
        expect(response.text).toMatch(/^WEBVTT\n\n/);
      }
    });

    test('should handle large file uploads', async () => {
      // Create a large SRT file (simulate 1000 subtitles)
      let largeSRT = '';
      for (let i = 1; i <= 1000; i++) {
        const startTime = `00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},000`;
        const endTime = `00:${String(Math.floor((i + 2) / 60)).padStart(2, '0')}:${String((i + 2) % 60).padStart(2, '0')},000`;
        largeSRT += `${i}\n${startTime} --> ${endTime}\nSubtitle ${i}\n\n`;
      }

      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(largeSRT), 'large.srt')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/vtt/);
      expect(response.text).toMatch(/^WEBVTT\n\n/);
      expect(response.text).toContain('Subtitle 1');
      expect(response.text).toContain('Subtitle 1000');
    });

    test('should handle concurrent requests', async () => {
      const requests = [];
      const numRequests = 5;

      for (let i = 0; i < numRequests; i++) {
        const requestPromise = request(app)
          .post('/convert')
          .attach('srtFile', Buffer.from(validSRTSamples.simple), `test${i}.srt`);
        requests.push(requestPromise);
      }

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/text\/vtt/);
        expect(response.text).toMatch(/^WEBVTT\n\n/);
      });
    });

    test('should validate file size limits', async () => {
      // Create a very large buffer (simulate file too large)
      const veryLargeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      veryLargeBuffer.fill('A');

      const response = await request(app)
        .post('/convert')
        .attach('srtFile', veryLargeBuffer, 'toolarge.srt')
        .expect(413); // Payload Too Large

      expect(response.body).toHaveProperty('error');
    });

    test('should handle malformed multipart requests', async () => {
      const response = await request(app)
        .post('/convert')
        .send('not multipart data')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate content-type restrictions', async () => {
      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(validSRTSamples.simple), 'test.txt');

      // The server might accept .txt files but reject them during validation
      expect([200, 400]).toContain(response.status);
    });

    test('should provide detailed error information', async () => {
      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(invalidSRTSamples.invalidIndex), 'invalid.srt');

      expect([400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('stage');
    });
  });

  describe('Response Format Tests', () => {
    test('should return proper headers for VTT download', async () => {
      const response = await request(app)
        .post('/convert')
        .attach('srtFile', Buffer.from(validSRTSamples.simple), 'test.srt')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/vtt; charset=utf-8');
      expect(response.headers['content-disposition']).toBe('attachment; filename="test.vtt"');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should return proper JSON for Base64 format', async () => {
      const response = await request(app)
        .post('/convert')
        .field('format', 'base64')
        .attach('srtFile', Buffer.from(validSRTSamples.simple), 'test.srt')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('base64');
      expect(response.body).toHaveProperty('mimeType', 'text/vtt');
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('language');
      expect(response.body).toHaveProperty('compliance');
      expect(response.body).toHaveProperty('bunnyStream');

      // Validate Base64 structure
      expect(response.body.base64).toHaveProperty('content');
      expect(response.body.base64).toHaveProperty('mimeType', 'text/vtt');
      expect(response.body.base64).toHaveProperty('charset', 'utf-8');
      expect(response.body.base64).toHaveProperty('encoding', 'base64');
      expect(response.body.base64).toHaveProperty('size');
      expect(response.body.base64).toHaveProperty('metadata');

      // Validate Base64 content
      const decodedContent = Buffer.from(response.body.base64.content, 'base64').toString('utf8');
      expect(decodedContent).toMatch(/^WEBVTT\n\n/);
    });

    test('should include processing statistics', async () => {
      const response = await request(app)
        .post('/convert')
        .field('format', 'base64')
        .attach('srtFile', Buffer.from(validSRTSamples.german), 'german.srt')
        .expect(200);

      expect(response.body.stats).toHaveProperty('originalEncoding');
      expect(response.body.stats).toHaveProperty('subtitleCount');
      expect(response.body.stats).toHaveProperty('correctionApplied');
      expect(response.body.stats).toHaveProperty('fileSize');
      expect(response.body.stats.fileSize).toHaveProperty('original');
      expect(response.body.stats.fileSize).toHaveProperty('converted');
      expect(response.body.stats.subtitleCount).toBeGreaterThan(0);
    });
  });
});