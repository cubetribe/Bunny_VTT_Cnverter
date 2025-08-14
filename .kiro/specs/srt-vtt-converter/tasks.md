# Implementation Plan

- [x] 1. Set up project structure and dependencies
  - Create package.json with required dependencies (express, multer, openai, dotenv, cors, iconv-lite)
  - Create directory structure (public folder for static files)
  - Set up .env file template for OpenAI API key
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 2. Implement core Express server setup
  - Create server.js with Express application initialization
  - Configure middleware for CORS, JSON parsing, and static file serving
  - Set up server to listen on port 3000
  - Add basic error handling middleware
  - _Requirements: 6.1, 6.5_

- [x] 3. Create file upload endpoint with validation
  - Implement POST /convert endpoint using multer for multipart/form-data
  - Add file type validation to accept only .srt files
  - Implement file size limits to prevent DoS attacks
  - Add error responses for invalid uploads
  - _Requirements: 1.3, 1.4, 6.3_

- [x] 4. Implement encoding detection and conversion module
  - Create utility functions to detect file encoding (UTF-8, ISO-8859-1, Windows-1252)
  - Implement conversion to UTF-8 without BOM using iconv-lite
  - Add fallback to UTF-8 when detection fails
  - Write unit tests for encoding detection and conversion
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Create SRT format validation and parsing
  - Implement SRT format validation function to check file structure
  - Create SRT parser to extract timestamps and text content
  - Add error handling for malformed SRT files
  - Write unit tests for SRT parsing with various format variations
  - _Requirements: 1.4, 2.2_

- [x] 6. Implement OpenAI API integration module
  - Create OpenAI client configuration using API key from environment
  - Implement text correction function with proper prompt for German subtitles
  - Add error handling and fallback mechanism for API failures
  - Implement retry logic with exponential backoff for rate limits
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 7. Create VTT format conversion module with Bunny Stream specifications
  - Implement timestamp conversion from comma to period format (00:00:00,000 → 00:00:00.000)
  - Create VTT generator that adds "WEBVTT" header as first line without BOM or leading spaces
  - Remove subtitle sequence numbers completely for Bunny Stream compatibility
  - Ensure proper UTF-8 encoding without BOM in output
  - Add empty line after WEBVTT header as required by Bunny Stream
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. Integrate processing pipeline in convert endpoint
  - Connect file upload, validation, encoding conversion, OpenAI correction, and VTT generation
  - Implement processing status tracking through the pipeline stages
  - Add comprehensive error handling with appropriate HTTP status codes
  - Return processed VTT file as downloadable response with correct MIME type (text/vtt)
  - Add Base64 encoding option for direct Bunny Stream API integration
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Create frontend HTML structure and styling
  - Build index.html with drag-and-drop upload area (300x200px minimum)
  - Create minimalist, centered CSS layout with responsive design
  - Style progress indicators, success/error messages with appropriate colors
  - Add visual feedback for drag-and-drop interactions
  - _Requirements: 1.1, 1.2, 5.4, 5.5, 7.1, 7.2, 7.3, 7.5_

- [x] 10. Implement frontend JavaScript functionality
  - Add drag-and-drop event handlers for file upload area
  - Implement file selection and upload using Fetch API
  - Create progress tracking UI that updates during processing stages
  - Add automatic download trigger when conversion completes
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3_

- [x] 11. Add comprehensive error handling to frontend
  - Implement user-friendly error message display for various failure scenarios
  - Add network error handling with retry options
  - Create fallback UI states for API failures
  - Display clear validation errors for invalid file uploads
  - _Requirements: 1.4, 5.4, 7.4_

- [x] 12. Write comprehensive tests for all modules
  - Create unit tests for encoding detection, SRT parsing, and VTT generation
  - Add integration tests for the complete conversion pipeline
  - Test OpenAI API integration with mocked responses
  - Create test files with various encodings and SRT format variations
  - _Requirements: All requirements validation_

- [x] 13. Add language detection and Bunny Stream integration features
  - Implement automatic language detection for ISO 639-1 code suggestions
  - Add Base64 output option for direct Bunny Stream API uploads
  - Create validation for proper WEBVTT format compliance
  - Add MIME type configuration (text/vtt) for proper browser handling
  - _Requirements: All requirements validation_

- [x] 14. Add development and production configuration
  - Create npm scripts for development (nodemon) and production
  - Add environment variable validation on startup
  - Implement proper logging for debugging and monitoring
  - Create README with setup instructions and Bunny Stream integration guide
  - _Requirements: 6.4_