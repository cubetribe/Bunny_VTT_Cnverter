// Mock OpenAI module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

const OpenAI = require('openai');
const OpenAIIntegration = require('../utils/openai-integration');
const { validSRTSamples } = require('./fixtures/test-data');

describe('OpenAI Integration', () => {
  let mockOpenAIInstance;
  let originalEnv;
  let integration;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.OPENAI_API_KEY;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock OpenAI instance
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    
    OpenAI.mockImplementation(() => mockOpenAIInstance);
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.OPENAI_API_KEY = originalEnv;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  describe('Client Initialization', () => {
    test('should initialize client when API key is present', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      // Create new instance to test initialization
      integration = new OpenAIIntegration();
      
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key'
      });
      expect(integration.isAvailable()).toBe(true);
    });

    test('should not initialize client when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      
      // Create new instance to test initialization
      integration = new OpenAIIntegration();
      
      expect(integration.isAvailable()).toBe(false);
    });
  });

  describe('Prompt Building', () => {
    test('should build correct prompt for German subtitles', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      integration = new OpenAIIntegration();
      
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
Hallo Welt

2
00:00:04,000 --> 00:00:06,000
Wie geht es dir?`;

      const prompt = integration.buildCorrectionPrompt(srtContent);
      
      expect(prompt).toContain('Korrigiere Rechtschreibung und Grammatik');
      expect(prompt).toContain('Behalte Zeitstempel und Struktur exakt bei');
      expect(prompt).toContain('deutsche Rechtschreibung (ü, ö, ä, ß)');
      expect(prompt).toContain(srtContent);
    });
  });

  describe('Backoff Calculation', () => {
    test('should calculate exponential backoff correctly', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      integration = new OpenAIIntegration();
      
      const delay0 = integration.calculateBackoffDelay(0);
      const delay1 = integration.calculateBackoffDelay(1);
      const delay2 = integration.calculateBackoffDelay(2);
      
      // Base delay is 1000ms, should roughly double each time
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThan(1500); // With jitter
      
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThan(2500);
      
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThan(4500);
    });

    test('should cap delay at maximum value', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      integration = new OpenAIIntegration();
      
      const delay = integration.calculateBackoffDelay(10);
      expect(delay).toBeLessThanOrEqual(33000); // 30000 + 10% jitter
    });
  });

  describe('Text Correction', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      integration = new OpenAIIntegration();
      // Mock the client property to use our mock
      integration.client = mockOpenAIInstance;
    });

    test('should successfully correct text', async () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
Halo Welt`;

      const mockResponse = {
        choices: [{
          message: {
            content: `1
00:00:01,000 --> 00:00:03,000
Hallo Welt`
          }
        }]
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await integration.correctSubtitleText(srtContent);

      expect(result.success).toBe(true);
      expect(result.correctedText).toContain('Hallo Welt');
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: expect.stringContaining(srtContent)
        }],
        max_tokens: 4000,
        temperature: 0.1
      });
    });

    test('should return error when client is not available', async () => {
      delete process.env.OPENAI_API_KEY;
      const testIntegration = new OpenAIIntegration();
      
      const result = await testIntegration.correctSubtitleText('test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI client not available');
    });

    test('should return error for invalid input', async () => {
      const result = await integration.correctSubtitleText(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid SRT content');
    });

    test('should retry on rate limit error', async () => {
      const srtContent = 'test content';
      
      // Mock rate limit error on first call, success on second
      mockOpenAIInstance.chat.completions.create
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          choices: [{
            message: { content: 'corrected content' }
          }]
        });

      // Mock sleep to avoid actual delays in tests
      jest.spyOn(integration, 'sleep').mockResolvedValue();

      const result = await integration.correctSubtitleText(srtContent);

      expect(result.success).toBe(true);
      expect(result.correctedText).toBe('corrected content');
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    test('should fail after max retries', async () => {
      const srtContent = 'test content';
      
      // Mock consistent failures with retryable error (500 status)
      const serverError = new Error('Server error');
      serverError.status = 500;
      mockOpenAIInstance.chat.completions.create
        .mockRejectedValue(serverError);

      // Mock sleep to avoid actual delays in tests
      jest.spyOn(integration, 'sleep').mockResolvedValue();

      const result = await integration.correctSubtitleText(srtContent, 2);

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API failed after 3 attempts');
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    test('should not retry on non-retryable errors', async () => {
      const srtContent = 'test content';
      
      // Mock authentication error (non-retryable)
      const authError = new Error('Invalid API key');
      authError.status = 401;
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(authError);

      const result = await integration.correctSubtitleText(srtContent);

      expect(result.success).toBe(false);
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fallback Mechanism', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      integration = new OpenAIIntegration();
      // Mock the client property to use our mock
      integration.client = mockOpenAIInstance;
    });

    test('should return corrected text when API succeeds', async () => {
      const srtContent = 'original content';
      const correctedContent = 'corrected content';

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: correctedContent }
        }]
      });

      const result = await integration.correctWithFallback(srtContent);

      expect(result.success).toBe(true);
      expect(result.correctedText).toBe(correctedContent);
      expect(result.usedFallback).toBe(false);
    });

    test('should fallback to original text when API fails', async () => {
      const srtContent = 'original content';

      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('API error')
      );

      // Mock sleep to avoid actual delays in tests
      jest.spyOn(integration, 'sleep').mockResolvedValue();

      const result = await integration.correctWithFallback(srtContent);

      expect(result.success).toBe(true);
      expect(result.correctedText).toBe(srtContent);
      expect(result.usedFallback).toBe(true);
      expect(result.error).toContain('API error');
    });

    test('should handle unexpected errors gracefully', async () => {
      const srtContent = 'original content';

      // Mock an unexpected error in the correction process
      jest.spyOn(integration, 'correctSubtitleText')
        .mockRejectedValue(new Error('Unexpected error'));

      const result = await integration.correctWithFallback(srtContent);

      expect(result.success).toBe(true);
      expect(result.correctedText).toBe(srtContent);
      expect(result.usedFallback).toBe(true);
      expect(result.error).toContain('Unexpected error');
    });
  });

  describe('Comprehensive Integration Tests', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      integration = new OpenAIIntegration();
      integration.client = mockOpenAIInstance;
    });

    test('should handle all valid SRT samples', async () => {
      // Mock successful correction for all samples
      mockOpenAIInstance.chat.completions.create.mockImplementation(async (params) => {
        const content = params.messages[0].content;
        // Extract SRT content from prompt and return it as "corrected"
        const srtMatch = content.match(/(\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n[\s\S]*?)$/);
        const correctedContent = srtMatch ? srtMatch[1] : 'corrected content';
        
        return {
          choices: [{
            message: { content: correctedContent }
          }]
        };
      });

      for (const [sampleName, srtContent] of Object.entries(validSRTSamples)) {
        const result = await integration.correctSubtitleText(srtContent);
        expect(result.success).toBe(true);
        expect(result.correctedText).toBeDefined();
        expect(typeof result.correctedText).toBe('string');
      }
    });

    test('should handle various error scenarios', async () => {
      const testErrors = [
        { status: 400, message: 'Bad Request' },
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 429, message: 'Rate limit exceeded' },
        { status: 500, message: 'Internal Server Error' },
        { status: 502, message: 'Bad Gateway' },
        { status: 503, message: 'Service Unavailable' }
      ];

      for (const errorInfo of testErrors) {
        // Reset mocks for each test
        jest.clearAllMocks();
        
        const error = new Error(errorInfo.message);
        error.status = errorInfo.status;
        
        mockOpenAIInstance.chat.completions.create.mockRejectedValue(error);
        jest.spyOn(integration, 'sleep').mockResolvedValue();

        const result = await integration.correctSubtitleText('test content', 1); // Limit retries for faster tests
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('OpenAI API failed after');
      }
    });

    test('should handle network timeouts and connection errors', async () => {
      const networkErrors = [
        { code: 'ECONNRESET', message: 'Connection reset' },
        { code: 'ETIMEDOUT', message: 'Connection timeout' },
        { code: 'ENOTFOUND', message: 'DNS lookup failed' },
        { code: 'ECONNREFUSED', message: 'Connection refused' }
      ];

      for (const errorInfo of networkErrors) {
        const error = new Error(errorInfo.message);
        error.code = errorInfo.code;
        
        mockOpenAIInstance.chat.completions.create.mockRejectedValue(error);
        jest.spyOn(integration, 'sleep').mockResolvedValue();

        const result = await integration.correctSubtitleText('test content', 1);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain(errorInfo.message);
      }
    });

    test('should validate prompt building for different content types', () => {
      Object.entries(validSRTSamples).forEach(([sampleName, srtContent]) => {
        const prompt = integration.buildCorrectionPrompt(srtContent);
        
        expect(prompt).toContain('Korrigiere Rechtschreibung und Grammatik');
        expect(prompt).toContain('deutsche Rechtschreibung (ü, ö, ä, ß)');
        expect(prompt).toContain(srtContent);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(srtContent.length);
      });
    });

    test('should handle malformed API responses', async () => {
      const malformedResponses = [
        { choices: [] }, // Empty choices
        { choices: [{ message: { content: '' } }] }, // Empty content
        { choices: [{ message: {} }] }, // Missing content
        { choices: [{}] }, // Missing message
        {}, // Missing choices
        null, // Null response
        undefined // Undefined response
      ];

      for (const response of malformedResponses) {
        mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(response);
        
        const result = await integration.correctSubtitleText('test content');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    test('should respect rate limiting with proper backoff', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      
      // Mock rate limit on first two calls, success on third
      mockOpenAIInstance.chat.completions.create
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'corrected content' } }]
        });

      const sleepSpy = jest.spyOn(integration, 'sleep').mockResolvedValue();
      
      const result = await integration.correctSubtitleText('test content', 2);
      
      expect(result.success).toBe(true);
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(3);
    });
  });
});