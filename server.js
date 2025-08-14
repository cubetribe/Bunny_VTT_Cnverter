const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

// Import logging utility
const { logger } = require('./utils/logger');

// Import utility modules
const { detectEncoding, convertToUTF8 } = require('./utils/encoding');
const { validateSRTFormat, parseSRT } = require('./utils/srt-parser');
const { generateVTT, validateVTTFormat, validateBunnyStreamCompliance, generateBase64Output, getVTTMimeTypeConfig } = require('./utils/vtt-generator');
const { detectLanguage, getSupportedLanguages, isValidLanguageCode, getLanguageName } = require('./utils/language-detection');
const OpenAIIntegration = require('./utils/openai-integration');

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept only .srt files
    if (file.mimetype === 'application/x-subrip' || 
        file.originalname.toLowerCase().endsWith('.srt') ||
        file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only SRT files are allowed'), false);
    }
  }
});

// Initialize OpenAI integration
const openaiClient = new OpenAIIntegration();

// Middleware configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic route for health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'SRT to VTT Converter API is running' });
});

// Language detection endpoint
app.post('/detect-language', upload.single('srtFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'File Upload Error',
        message: 'No SRT file provided for language detection'
      });
    }

    // Process encoding and extract content
    const detectedEncoding = detectEncoding(req.file.buffer);
    const utf8Buffer = convertToUTF8(req.file.buffer, detectedEncoding);
    const srtContent = utf8Buffer.toString('utf8');

    // Validate SRT format
    if (!validateSRTFormat(srtContent)) {
      return res.status(400).json({
        error: 'Format Validation Error',
        message: 'Invalid SRT file format'
      });
    }

    // Detect language
    const languageResult = detectLanguage(srtContent);

    res.json({
      success: true,
      language: languageResult,
      supportedLanguages: getSupportedLanguages()
    });

  } catch (error) {
    logger.error('Language detection error', { 
      error: error.message,
      filename: req.file ? req.file.originalname : 'unknown'
    });
    res.status(500).json({
      error: 'Language Detection Error',
      message: error.message
    });
  }
});

// Supported languages endpoint
app.get('/languages', (req, res) => {
  res.json({
    success: true,
    languages: getSupportedLanguages()
  });
});

// Convert endpoint - Main processing pipeline
app.post('/convert', upload.single('srtFile'), async (req, res) => {
  let processingStage = 'upload';
  
  try {
    // Stage 1: File Upload Validation
    processingStage = 'upload';
    
    if (!req.file) {
      return res.status(400).json({
        error: 'File Upload Error',
        message: 'No SRT file provided',
        stage: processingStage
      });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        error: 'File Upload Error',
        message: 'Uploaded file is empty',
        stage: processingStage
      });
    }

    logger.logProcessing('upload', req.file.originalname, { 
      size: req.file.size,
      mimetype: req.file.mimetype 
    });

    // Stage 2: Encoding Detection and Conversion
    processingStage = 'encoding';
    
    const detectedEncoding = detectEncoding(req.file.buffer);
    logger.logProcessing('encoding', req.file.originalname, { 
      detectedEncoding 
    });
    
    const utf8Buffer = convertToUTF8(req.file.buffer, detectedEncoding);
    const srtContent = utf8Buffer.toString('utf8');

    // Stage 3: SRT Format Validation
    processingStage = 'validation';
    
    if (!validateSRTFormat(srtContent)) {
      return res.status(400).json({
        error: 'Format Validation Error',
        message: 'Invalid SRT file format. Please ensure the file follows proper SRT structure with sequence numbers, timestamps, and text.',
        stage: processingStage
      });
    }

    // Parse SRT content
    let parsedSubtitles;
    try {
      parsedSubtitles = parseSRT(srtContent);
      logger.logProcessing('parsing', req.file.originalname, { 
        subtitleCount: parsedSubtitles.length 
      });
    } catch (error) {
      return res.status(400).json({
        error: 'SRT Parsing Error',
        message: error.message,
        stage: processingStage
      });
    }

    // Stage 4: OpenAI Text Correction (optional)
    processingStage = 'correction';
    
    let correctedContent = srtContent;
    let correctionUsed = false;
    let correctionError = null;

    if (openaiClient.isAvailable()) {
      logger.logProcessing('correction', req.file.originalname, { 
        service: 'openai' 
      });
      const correctionResult = await openaiClient.correctWithFallback(srtContent);
      
      if (correctionResult.success) {
        correctedContent = correctionResult.correctedText;
        correctionUsed = !correctionResult.usedFallback;
        
        if (correctionResult.usedFallback) {
          correctionError = correctionResult.error;
          logger.logOpenAI('fallback', { error: correctionResult.error });
        } else {
          logger.logOpenAI('success', { 
            originalLength: srtContent.length,
            correctedLength: correctedContent.length 
          });
        }
      } else {
        correctionError = correctionResult.error;
        logger.logOpenAI('error', { error: correctionResult.error });
      }
    } else {
      logger.info('OpenAI not available, skipping text correction');
      correctionError = 'OpenAI API key not configured';
    }

    // Re-parse corrected content if correction was applied
    if (correctionUsed) {
      try {
        parsedSubtitles = parseSRT(correctedContent);
        logger.debug('Successfully parsed corrected content');
      } catch (error) {
        logger.warn('Failed to parse corrected content, using original', { 
          error: error.message 
        });
        parsedSubtitles = parseSRT(srtContent);
        correctionUsed = false;
        correctionError = 'Corrected content was invalid, used original';
      }
    }

    // Stage 5: Language Detection
    processingStage = 'language-detection';
    
    let languageDetection = null;
    try {
      languageDetection = detectLanguage(correctedContent);
      logger.logProcessing('language-detection', req.file.originalname, {
        detected: languageDetection.detected,
        language: languageDetection.detected ? languageDetection.language.code : null,
        confidence: languageDetection.detected ? Math.round(languageDetection.language.confidence * 100) : 0
      });
    } catch (error) {
      logger.warn('Language detection failed', { error: error.message });
      languageDetection = {
        detected: false,
        language: null,
        confidence: 0,
        suggestions: []
      };
    }

    // Stage 6: VTT Generation
    processingStage = 'conversion';
    
    let vttContent;
    let complianceResult;
    try {
      vttContent = generateVTT(parsedSubtitles);
      
      // Enhanced validation with Bunny Stream compliance
      complianceResult = validateBunnyStreamCompliance(vttContent);
      
      if (!complianceResult.isValid) {
        throw new Error(`VTT compliance validation failed: ${complianceResult.errors.join(', ')}`);
      }
      
      logger.logProcessing('vtt-generation', req.file.originalname, {
        bunnyStreamCompliant: complianceResult.isValid,
        warningCount: complianceResult.warnings.length
      });
      
      if (complianceResult.warnings.length > 0) {
        logger.warn('VTT compliance warnings', { 
          warnings: complianceResult.warnings 
        });
      }
      
    } catch (error) {
      return res.status(500).json({
        error: 'VTT Generation Error',
        message: error.message,
        stage: processingStage
      });
    }

    // Stage 7: Response Generation
    processingStage = 'complete';

    // Check if Base64 encoding is requested
    const outputFormat = req.body.format || req.query.format || 'file';
    const includeBase64 = outputFormat === 'base64' || req.body.base64 === 'true' || req.query.base64 === 'true';

    // Get MIME type configuration
    const mimeConfig = getVTTMimeTypeConfig();

    // Prepare response data
    const responseData = {
      success: true,
      message: 'Conversion completed successfully',
      stage: processingStage,
      stats: {
        originalEncoding: detectedEncoding,
        subtitleCount: parsedSubtitles.length,
        correctionApplied: correctionUsed,
        fileSize: {
          original: req.file.size,
          converted: Buffer.byteLength(vttContent, 'utf8')
        }
      },
      language: languageDetection,
      compliance: {
        bunnyStreamCompatible: complianceResult.isValid,
        checks: complianceResult.compliance,
        warnings: complianceResult.warnings
      },
      mimeType: mimeConfig.primary
    };

    // Add correction info if there were issues
    const warnings = [];
    if (correctionError) {
      warnings.push({
        type: 'correction',
        message: correctionError
      });
    }

    // Add compliance warnings
    if (complianceResult.warnings.length > 0) {
      warnings.push(...complianceResult.warnings.map(warning => ({
        type: 'compliance',
        message: warning
      })));
    }

    if (warnings.length > 0) {
      responseData.warnings = warnings;
    }

    // Add Base64 data if requested
    if (includeBase64) {
      try {
        const base64Result = generateBase64Output(vttContent);
        responseData.base64 = base64Result;
        responseData.bunnyStream = {
          ready: true,
          mimeType: base64Result.mimeType,
          charset: base64Result.charset,
          encoding: base64Result.encoding,
          languageCode: languageDetection.detected ? languageDetection.language.code : null,
          languageName: languageDetection.detected ? languageDetection.language.name : null
        };
        logger.debug('Base64 output generated successfully');
      } catch (error) {
        logger.error('Base64 generation failed', { error: error.message });
        responseData.warnings = responseData.warnings || [];
        responseData.warnings.push({
          type: 'base64',
          message: 'Base64 encoding failed: ' + error.message
        });
      }
    }

    // Generate filename for download
    const originalName = req.file.originalname || 'subtitle';
    const baseName = path.parse(originalName).name;
    const vttFilename = `${baseName}.vtt`;

    // Set response headers for file download
    res.set({
      'Content-Type': mimeConfig.bunnyStream.contentType,
      'Content-Disposition': `attachment; filename="${vttFilename}"`,
      'Content-Length': Buffer.byteLength(vttContent, 'utf8'),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });

    // Add language information to headers if detected
    if (languageDetection.detected) {
      res.set('Content-Language', languageDetection.language.code);
      res.set('X-Detected-Language', `${languageDetection.language.name} (${languageDetection.language.code})`);
      res.set('X-Language-Confidence', Math.round(languageDetection.language.confidence * 100).toString());
    }

    // If Base64 was requested, send JSON response instead of file
    if (includeBase64) {
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.json(responseData);
    } else {
      // Send the VTT file directly
      res.send(vttContent);
    }

    logger.info('Conversion completed successfully', {
      filename: vttFilename,
      originalSize: responseData.stats.fileSize.original,
      convertedSize: responseData.stats.fileSize.converted,
      correctionUsed,
      languageDetected: languageDetection.detected
    });

  } catch (error) {
    logger.error(`Error during ${processingStage} stage`, { 
      stage: processingStage,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (error.message.includes('Invalid') || error.message.includes('format')) {
      statusCode = 400;
    } else if (error.message.includes('timeout') || error.message.includes('rate limit')) {
      statusCode = 408;
    } else if (error.message.includes('API key') || error.message.includes('unauthorized')) {
      statusCode = 503; // Service Unavailable
    }

    res.status(statusCode).json({
      error: 'Processing Error',
      message: error.message,
      stage: processingStage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Multer error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('Multer error', { 
      code: err.code,
      message: err.message,
      field: err.field 
    });
    
    let statusCode = 400;
    let message = err.message;
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        statusCode = 413;
        message = 'File too large. Maximum size is 10MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        statusCode = 400;
        message = 'Too many files. Only one file is allowed.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        statusCode = 400;
        message = 'Unexpected file field. Use "srtFile" as the field name.';
        break;
      default:
        message = 'File upload error: ' + err.message;
    }
    
    return res.status(statusCode).json({
      error: 'File Upload Error',
      message: message,
      stage: 'upload'
    });
  }
  
  // Handle file filter errors
  if (err.message === 'Only SRT files are allowed') {
    return res.status(400).json({
      error: 'File Type Error',
      message: 'Only SRT files are allowed. Please upload a file with .srt extension.',
      stage: 'upload'
    });
  }
  
  // General error handling
  logger.error('Unhandled error occurred', { 
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: 'Server Error',
    message: message,
    stage: 'unknown',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('SRT to VTT Converter server started', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      openaiEnabled: !!process.env.OPENAI_API_KEY
    });
    logger.info(`Access the application at: http://localhost:${PORT}`);
    logger.info(`Health check available at: http://localhost:${PORT}/health`);
  });
}

module.exports = app;