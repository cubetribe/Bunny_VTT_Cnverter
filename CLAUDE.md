# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js web application that converts SRT subtitle files to Bunny Stream-compatible VTT format with automatic spelling and grammar correction using OpenAI's GPT API. The application ensures strict compliance with Bunny Stream's VTT format requirements.

## Essential Commands

### Development
```bash
npm run dev              # Start with nodemon and auto-reload
npm run dev:debug        # Start with debug logging (DEBUG=*)
```

### Testing
```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:unit        # Run unit tests only (encoding, srt-parser, vtt-generator, openai-integration)
npm run test:integration # Run integration tests only (convert-endpoint, integration-pipeline)
npm run test:verbose     # Run tests with verbose output
```

### Production
```bash
npm start                # Start production server with environment validation
npm run validate-env     # Validate environment configuration
```

## Architecture

### Core Processing Pipeline
The application follows a multi-stage conversion pipeline:

1. **File Upload & Validation** (`server.js`)
   - Multer middleware handles file uploads (10MB limit)
   - Validates SRT file format

2. **Encoding Detection & Conversion** (`utils/encoding.js`)
   - Detects various text encodings using iconv-lite
   - Converts to UTF-8 for processing

3. **SRT Parsing** (`utils/srt-parser.js`)
   - Parses SRT format into structured subtitle objects
   - Validates subtitle structure and timestamps

4. **OpenAI Text Correction** (`utils/openai-integration.js`)
   - Optional spelling/grammar correction via OpenAI GPT
   - Fallback mode when API key not configured
   - Preserves subtitle timing and structure

5. **VTT Generation** (`utils/vtt-generator.js`)
   - Generates Bunny Stream-compliant VTT format
   - Ensures strict format compliance (WEBVTT header, timestamp format, no sequence numbers)
   - Provides Base64 output for direct API integration

6. **Language Detection** (`utils/language-detection.js`)
   - Automatic language detection with ISO 639-1 codes
   - Required for Bunny Stream API integration

### API Endpoints
- `POST /convert` - Main conversion endpoint (multipart/form-data)
- `POST /detect-language` - Language detection endpoint
- `GET /health` - Health check endpoint
- `GET /languages` - List supported languages

### Frontend
- Single-page application in `public/` directory
- Drag-and-drop interface with real-time progress tracking
- Direct download and Base64 output options

## Critical Bunny Stream Compliance Rules

The VTT output must strictly adhere to these requirements:
- First line must be exactly `WEBVTT` (no BOM)
- Empty line after header is mandatory
- Timestamp format: `HH:MM:SS.mmm` (periods, not commas)
- No subtitle sequence numbers allowed
- UTF-8 encoding without BOM
- Proper line endings and spacing

## Environment Configuration

Required environment variables (create `.env` from `.env.template`):
- `OPENAI_API_KEY` - Optional, for text correction
- `PORT` - Server port (default: 3000)
- `MAX_FILE_SIZE` - Max upload size in bytes (default: 10485760)
- `LOG_LEVEL` - Logging level (ERROR, WARN, INFO, DEBUG)

## Testing Strategy

The project maintains >80% test coverage with:
- **Unit tests** for individual utility modules
- **Integration tests** for API endpoints and full pipeline
- Test fixtures in `tests/fixtures/test-data.js`
- Mock OpenAI responses for consistent testing
- Environment isolation via NODE_ENV=test

## Error Handling

The application implements comprehensive error handling:
- Encoding detection fallbacks
- OpenAI API failure graceful degradation
- Detailed logging with structured format
- Client-friendly error messages with processing stages