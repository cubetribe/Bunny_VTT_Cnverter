# 🎬 Bunny VTT Converter

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/yourusername/bunny-vtt-converter)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://goaiex.com)

> Enterprise-grade SRT to VTT subtitle converter with AI-powered text correction, specifically designed for seamless Bunny Stream integration.

## 🌟 Overview

Bunny VTT Converter is a professional Node.js application that transforms SRT subtitle files into Bunny Stream-compliant VTT format. It features automatic language detection, intelligent text correction using OpenAI GPT, and ensures 100% compatibility with Bunny Stream's strict format requirements.

## ✨ Key Features

- **🎯 Bunny Stream Optimized**: Generates VTT files that meet Bunny Stream's exact specifications
- **🤖 AI-Powered Enhancement**: Automatic spelling and grammar correction using OpenAI GPT-4
- **🌍 Multi-Language Support**: Automatic language detection with ISO 639-1 code mapping
- **🔄 Smart Encoding**: Automatic detection and conversion of various text encodings
- **📊 Real-Time Processing**: Web interface with live conversion progress tracking
- **🔐 Enterprise Ready**: Comprehensive error handling and logging
- **✅ Fully Tested**: 80%+ code coverage with unit and integration tests
- **🚀 High Performance**: Optimized for processing large subtitle files

## 🖼️ Screenshots

<details>
<summary>View Interface Screenshots</summary>

### Web Interface
The modern, intuitive drag-and-drop interface makes subtitle conversion effortless.

### Processing Pipeline
Real-time progress tracking through each conversion stage.

</details>

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16.0.0 or higher
- **npm** 8.0.0 or higher
- **OpenAI API Key** (optional, for AI text correction)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/bunny-vtt-converter.git
   cd bunny-vtt-converter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.template .env
   # Edit .env and add your OpenAI API key (optional)
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

5. **Access the application**
   
   Open your browser and navigate to `http://localhost:3000`

## 📖 Documentation

### API Endpoints

#### **POST** `/convert`
Convert SRT file to VTT format.

```bash
curl -X POST \
  -F "srtFile=@subtitle.srt" \
  -F "format=base64" \
  http://localhost:3000/convert
```

**Parameters:**
- `srtFile` (required): SRT file to convert
- `format` (optional): `file` or `base64` output format
- `base64` (optional): Include Base64 encoded output

**Response:**
```json
{
  "success": true,
  "message": "Conversion completed successfully",
  "stats": {
    "originalEncoding": "UTF-8",
    "subtitleCount": 42,
    "correctionApplied": true
  },
  "language": {
    "code": "en",
    "name": "English",
    "confidence": 0.95
  },
  "compliance": {
    "bunnyStreamCompatible": true
  }
}
```

#### **POST** `/detect-language`
Detect language of SRT file content.

#### **GET** `/health`
Health check endpoint.

#### **GET** `/languages`
Get list of supported languages.

### Bunny Stream Integration

The converter provides direct integration with Bunny Stream API:

```javascript
// Example: Upload to Bunny Stream
const formData = new FormData();
formData.append('srtFile', file);
formData.append('format', 'base64');

const response = await fetch('http://localhost:3000/convert', {
  method: 'POST',
  body: formData
});

const result = await response.json();

// Use with Bunny Stream API
await fetch('https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}/captions/{lang}', {
  method: 'POST',
  headers: {
    'AccessKey': 'your-bunny-access-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    captionsFile: result.base64.data
  })
});
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch
```

## 🏗️ Architecture

```
bunny-vtt-converter/
├── 📁 public/              # Web interface (HTML, CSS, JS)
├── 📁 utils/               # Core utilities
│   ├── encoding.js         # Encoding detection & conversion
│   ├── srt-parser.js       # SRT parsing engine
│   ├── vtt-generator.js    # VTT generation & validation
│   ├── openai-integration.js # AI text correction
│   ├── language-detection.js # Language identification
│   └── logger.js           # Structured logging
├── 📁 tests/               # Test suite
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data
├── 📁 scripts/             # Utility scripts
├── 📄 server.js            # Express server
├── 📄 package.json         # Dependencies
└── 📄 .env.template        # Environment template
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.template`:

```env
# OpenAI Configuration (Optional)
OPENAI_API_KEY=sk-your-api-key

# Server Configuration
PORT=3000

# Application Settings
MAX_FILE_SIZE=10485760  # 10MB in bytes
LOG_LEVEL=INFO          # ERROR | WARN | INFO | DEBUG
```

## 🛠️ Development

### Available Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start development server with hot reload |
| `npm run dev:debug` | Development mode with debug logging |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run test:coverage` | Generate coverage report |
| `npm run validate-env` | Validate environment configuration |

### Code Style

This project follows JavaScript Standard Style with the following conventions:
- ES6+ features
- Async/await for asynchronous operations
- Comprehensive error handling
- JSDoc comments for documentation

## 📊 Performance

- Processes files up to 10MB
- Average conversion time: <2 seconds for 1000 subtitles
- Memory efficient stream processing
- Automatic encoding detection supports 20+ character sets

## 🔐 Security

- Input validation and sanitization
- Rate limiting on API endpoints
- Secure file upload handling
- No sensitive data logging
- Environment variable protection

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Changelog

### Version 0.1.0 (2025-01-14)
- 🎉 Initial release
- ✨ SRT to VTT conversion
- 🤖 OpenAI GPT integration
- 🌍 Language detection
- 🎯 Bunny Stream compliance
- 🧪 Comprehensive test suite

## 📄 License

Copyright © 2025 Dennis Westermann @ aiEX Academy. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

## 👨‍💻 Author

**Dennis Westermann**  
*aiEX Academy*

- 🌐 Website: [goaiex.com](https://goaiex.com)
- 📧 Email: mail@goaiex.com
- 💼 LinkedIn: [Dennis Westermann](https://www.linkedin.com/in/dennis-westermann-6b0577168/)

## 🙏 Acknowledgments

- [Bunny Stream](https://bunny.net) for excellent video streaming infrastructure
- [OpenAI](https://openai.com) for GPT API
- The open-source community for amazing Node.js packages

## 📞 Support

For support, issues, or feature requests:
- 📧 Email: mail@goaiex.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/bunny-vtt-converter/issues)
- 📖 Documentation: [Wiki](https://github.com/yourusername/bunny-vtt-converter/wiki)

---

<div align="center">
  <strong>Built with ❤️ by aiEX Academy</strong>
  <br>
  <sub>Empowering content creators with intelligent subtitle solutions</sub>
</div>