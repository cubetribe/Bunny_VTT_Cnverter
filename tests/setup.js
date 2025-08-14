/**
 * Jest setup file for SRT to VTT converter tests
 * Configures global test environment and utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Suppress console output during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Only show console output if VERBOSE_TESTS is set
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Global test utilities
global.testUtils = {
  // Restore console for debugging specific tests
  enableConsole: () => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  },
  
  // Disable console again
  disableConsole: () => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  },
  
  // Create a test buffer with specific encoding
  createTestBuffer: (content, encoding = 'utf8') => {
    const iconv = require('iconv-lite');
    return iconv.encode(content, encoding);
  },
  
  // Validate VTT format quickly
  isValidVTT: (content) => {
    return content.startsWith('WEBVTT\n\n') && 
           !content.includes(',') && 
           content.charCodeAt(0) !== 0xFEFF;
  },
  
  // Generate random SRT content for stress testing
  generateRandomSRT: (count = 10) => {
    let srt = '';
    for (let i = 1; i <= count; i++) {
      const startMin = Math.floor(i / 60);
      const startSec = i % 60;
      const endMin = Math.floor((i + 2) / 60);
      const endSec = (i + 2) % 60;
      
      srt += `${i}\n`;
      srt += `00:${String(startMin).padStart(2, '0')}:${String(startSec).padStart(2, '0')},000 --> `;
      srt += `00:${String(endMin).padStart(2, '0')}:${String(endSec).padStart(2, '0')},000\n`;
      srt += `Random subtitle ${i}\n\n`;
    }
    return srt;
  }
};

// Global test timeout for async operations
jest.setTimeout(30000);

// Clean up after all tests
afterAll(() => {
  // Restore original console functions
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});