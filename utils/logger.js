/**
 * Logging Utility for SRT-VTT Converter
 * Provides structured logging with different levels and environments
 */

const fs = require('fs');
const path = require('path');

/**
 * Log levels with numeric values for filtering
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[90m', // Gray
  RESET: '\x1b[0m'   // Reset
};

class Logger {
  constructor(options = {}) {
    this.level = this.parseLogLevel(options.level || process.env.LOG_LEVEL || 'INFO');
    this.enableConsole = options.console !== false;
    this.enableFile = options.file === true;
    this.logDir = options.logDir || 'logs';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    
    // Create logs directory if file logging is enabled
    if (this.enableFile) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Parse log level from string to numeric value
   * @param {string} level - Log level string
   * @returns {number} Numeric log level
   */
  parseLogLevel(level) {
    const upperLevel = level.toString().toUpperCase();
    return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Format timestamp for logs
   * @returns {string} Formatted timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted log entry
   */
  formatMessage(level, message, meta = {}) {
    return {
      timestamp: this.getTimestamp(),
      level: level,
      message: message,
      pid: process.pid,
      ...meta
    };
  }

  /**
   * Write log to console with colors
   * @param {Object} logEntry - Formatted log entry
   */
  writeToConsole(logEntry) {
    if (!this.enableConsole) return;

    const color = COLORS[logEntry.level] || COLORS.INFO;
    const reset = COLORS.RESET;
    const timestamp = logEntry.timestamp.substring(11, 19); // Extract time part
    
    let output = `${color}[${timestamp}] ${logEntry.level}${reset}: ${logEntry.message}`;
    
    // Add metadata if present (excluding standard fields)
    const metaKeys = Object.keys(logEntry).filter(key => 
      !['timestamp', 'level', 'message', 'pid'].includes(key)
    );
    
    if (metaKeys.length > 0) {
      const metaStr = metaKeys.map(key => `${key}=${logEntry[key]}`).join(' ');
      output += ` ${color}[${metaStr}]${reset}`;
    }

    console.log(output);
  }

  /**
   * Write log to file
   * @param {Object} logEntry - Formatted log entry
   */
  writeToFile(logEntry) {
    if (!this.enableFile) return;

    try {
      const logFile = path.join(this.logDir, 'app.log');
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Check file size and rotate if necessary
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFile(logFile);
        }
      }
      
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Rotate log file when it gets too large
   * @param {string} logFile - Path to current log file
   */
  rotateLogFile(logFile) {
    try {
      // Move existing log files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = `${logFile}.${i}`;
        const newFile = `${logFile}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest file
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Move current log to .1
      if (fs.existsSync(logFile)) {
        fs.renameSync(logFile, `${logFile}.1`);
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  /**
   * Log a message at the specified level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    const levelValue = LOG_LEVELS[level.toUpperCase()];
    
    // Skip if log level is below threshold
    if (levelValue > this.level) return;
    
    const logEntry = this.formatMessage(level.toUpperCase(), message, meta);
    
    this.writeToConsole(logEntry);
    this.writeToFile(logEntry);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  /**
   * Log HTTP request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  logRequest(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };

    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    this.log(level, `${req.method} ${req.url} ${res.statusCode}`, meta);
  }

  /**
   * Log processing stage
   * @param {string} stage - Processing stage name
   * @param {string} filename - File being processed
   * @param {Object} details - Additional details
   */
  logProcessing(stage, filename, details = {}) {
    this.info(`Processing stage: ${stage}`, {
      stage,
      filename,
      ...details
    });
  }

  /**
   * Log OpenAI API interaction
   * @param {string} action - API action (request, response, error)
   * @param {Object} details - API interaction details
   */
  logOpenAI(action, details = {}) {
    const level = action === 'error' ? 'ERROR' : 'DEBUG';
    this.log(level, `OpenAI API ${action}`, {
      service: 'openai',
      action,
      ...details
    });
  }
}

// Create default logger instance
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO'),
  console: true,
  file: process.env.NODE_ENV === 'production'
});

// Export both the class and default instance
module.exports = {
  Logger,
  logger: defaultLogger,
  LOG_LEVELS
};