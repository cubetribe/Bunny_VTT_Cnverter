const OpenAI = require('openai');
require('dotenv').config();

class OpenAIIntegration {
  constructor() {
    this.client = null;
    this.initializeClient();
  }

  /**
   * Initialize OpenAI client with API key from environment
   */
  initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('OpenAI API key not found in environment variables. Text correction will be disabled.');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: apiKey
      });
      console.log('OpenAI client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error.message);
      this.client = null;
    }
  }

  /**
   * Check if OpenAI client is available
   * @returns {boolean} True if client is initialized and ready
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Build correction prompt for German subtitles
   * @param {string} srtContent - The SRT content to correct
   * @returns {string} The formatted prompt
   */
  buildCorrectionPrompt(srtContent) {
    return `Du bist ein Experte für deutsche Untertitel-Korrektur.

KRITISCHE KORREKTUREN - HÖCHSTE PRIORITÄT:
1. FIRMENNAME: "aiEX Academy" (NICHT "AIX Academy"!)
   - Schreibweise: klein "ai" dann groß "EX" 
   - JEDES Vorkommen von "AIX Academy" → "aiEX Academy"
   - JEDES Vorkommen von "AIX" allein → "aiEX"
   - Auch falsche Varianten wie "aix", "ax", "ix" → "aiEX"

2. SPEZIELLE RECHTSCHREIBKORREKTUREN:
   - "wendern" → "wenn andere"  
   - "Sack-Halo-Bereich" → "Sag-Hallo-Bereich"
   - "Promt" → "Prompt"

3. DEUTSCHE UMLAUTE - stelle sicher, dass alle korrekt sind:
   - ü, ö, ä, ß, Ü, Ö, Ä (keine komischen Zeichen!)

KONTEXT - KÜNSTLICHE INTELLIGENZ:
- "clod", "klod", "cloud" → "Claude" (Anthropic's AI)
- "Tschätt-GPT", "Tschet GPT", "Chat-GPT" → "ChatGPT"
- "open AI", "Open-AI", "Open AI" → "OpenAI"
- "GPT-5", "GPT5", "GPT 5" → "GPT-5" (NEU August 2025!)
- "LLM" → "LLM" (Large Language Model)
- KI-Tools: Gemini, Perplexity, Midjourney, DALL-E, Stable Diffusion

REGELN:
- Behalte Zeitstempel EXAKT bei - ändere sie NIEMALS
- Korrigiere NUR den Text zwischen den Zeitstempeln
- Behalte Zeilenumbrüche im Text bei
- Nutze korrekte deutsche Rechtschreibung

${srtContent}`;
  }

  /**
   * Implement exponential backoff delay
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateBackoffDelay(attempt) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Correct subtitle text using OpenAI API with retry logic
   * @param {string} srtContent - The SRT content to correct
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @returns {Promise<{success: boolean, correctedText?: string, error?: string}>}
   */
  async correctSubtitleText(srtContent, maxRetries = 3) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'OpenAI client not available. API key may be missing or invalid.'
      };
    }

    if (!srtContent || typeof srtContent !== 'string') {
      return {
        success: false,
        error: 'Invalid SRT content provided'
      };
    }

    const prompt = this.buildCorrectionPrompt(srtContent);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting OpenAI correction (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        const response = await this.client.chat.completions.create({
          model: 'gpt-5-mini',  // Using GPT-5-mini for cost-effective corrections
          messages: [
            {
              role: 'system',
              content: 'Du bist ein Experte für deutsche Rechtschreibung und Grammatik im Bereich KI/AI. Korrigiere Untertitel von aiEX Academy präzise und behalte dabei das Format exakt bei. WICHTIG: Der Firmenname ist "aiEX Academy" (NICHT "AIX Academy")!'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_completion_tokens: 4000,  // GPT-5 uses max_completion_tokens instead of max_tokens
          temperature: 1, // GPT-5 only supports default temperature
          // GPT-5 specific parameters (new in August 2025):
          reasoning_effort: 'minimal', // Fast answers for subtitle correction
          verbosity: 'low' // Short, precise corrections without explanations
        });

        if (response.choices && response.choices.length > 0) {
          const correctedText = response.choices[0].message.content.trim();
          
          if (correctedText) {
            console.log('OpenAI correction completed successfully');
            return {
              success: true,
              correctedText: correctedText
            };
          } else {
            throw new Error('Empty response from OpenAI API');
          }
        } else {
          throw new Error('No choices returned from OpenAI API');
        }

      } catch (error) {
        console.error(`OpenAI API attempt ${attempt + 1} failed:`, error.message);

        // Check if this is a rate limit error
        const isRateLimit = error.status === 429 || 
                           error.message.includes('rate limit') ||
                           error.message.includes('Rate limit');

        // Check if this is a retryable error
        const isRetryable = isRateLimit || 
                           error.status >= 500 || 
                           error.code === 'ECONNRESET' ||
                           error.code === 'ETIMEDOUT';

        // If this is the last attempt or error is not retryable, return error
        if (attempt === maxRetries || !isRetryable) {
          return {
            success: false,
            error: `OpenAI API failed after ${attempt + 1} attempts: ${error.message}`
          };
        }

        // Calculate backoff delay and wait before retry
        const delay = this.calculateBackoffDelay(attempt);
        console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
        await this.sleep(delay);
      }
    }

    // This should never be reached, but included for completeness
    return {
      success: false,
      error: 'Unexpected error in retry logic'
    };
  }

  /**
   * Correct subtitle text with fallback mechanism
   * @param {string} srtContent - The SRT content to correct
   * @returns {Promise<{success: boolean, correctedText: string, usedFallback: boolean, error?: string}>}
   */
  async correctWithFallback(srtContent) {
    try {
      const result = await this.correctSubtitleText(srtContent);
      
      if (result.success) {
        return {
          success: true,
          correctedText: result.correctedText,
          usedFallback: false
        };
      } else {
        console.warn('OpenAI correction failed, using fallback (original text):', result.error);
        return {
          success: true,
          correctedText: srtContent,
          usedFallback: true,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Unexpected error in correctWithFallback:', error);
      return {
        success: true,
        correctedText: srtContent,
        usedFallback: true,
        error: error.message
      };
    }
  }
}

// Export class and singleton instance
module.exports = OpenAIIntegration;
module.exports.instance = new OpenAIIntegration();