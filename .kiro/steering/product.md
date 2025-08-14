# Product Overview

## SRT to VTT Converter

A Node.js web application that converts SRT subtitle files to Bunny Stream-compatible VTT format with AI-powered text correction.

### Core Features
- **Bunny Stream Compatible**: Generates VTT files meeting strict Bunny Stream format requirements
- **AI-Powered Correction**: Optional OpenAI GPT integration for spelling/grammar correction
- **Multi-Language Support**: Automatic language detection with ISO 639-1 codes
- **Encoding Handling**: Automatic detection and conversion of various text encodings
- **Web Interface**: Drag-and-drop interface with real-time progress tracking
- **API Integration**: Base64 output for direct Bunny Stream API uploads

### Target Use Cases
- Converting subtitle files for video streaming platforms
- Batch processing of subtitle files with quality improvement
- Integration with Bunny Stream video hosting service
- Automated subtitle workflow processing

### Key Quality Standards
- Strict VTT format compliance (no BOM, proper timestamps, no sequence numbers)
- UTF-8 encoding without BOM
- Comprehensive error handling and validation
- Real-time processing feedback
- Fallback modes when AI services are unavailable