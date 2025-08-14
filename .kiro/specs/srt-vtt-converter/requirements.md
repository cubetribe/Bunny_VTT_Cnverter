# Requirements Document

## Introduction

This feature involves creating a local web application that converts SRT subtitle files to Bunny Stream-compatible VTT format with automatic spelling and grammar correction using OpenAI's GPT API. The application will handle encoding issues automatically and provide a simple drag-and-drop interface for users to upload SRT files and download corrected VTT files.

## Requirements

### Requirement 1

**User Story:** As a content creator, I want to upload SRT subtitle files through a web interface, so that I can easily convert them without using command-line tools.

#### Acceptance Criteria

1. WHEN a user accesses the web application THEN the system SHALL display a drag-and-drop upload area of at least 300x200px
2. WHEN a user drags an SRT file over the drop zone THEN the system SHALL provide visual feedback indicating the file can be dropped
3. WHEN a user drops or selects an SRT file THEN the system SHALL accept the file and begin processing
4. IF the uploaded file is not an SRT format THEN the system SHALL display an error message and reject the file

### Requirement 2

**User Story:** As a content creator, I want my SRT files automatically corrected for spelling and grammar, so that my subtitles are professional and error-free.

#### Acceptance Criteria

1. WHEN an SRT file is uploaded THEN the system SHALL send the subtitle text to OpenAI API for correction
2. WHEN sending to OpenAI THEN the system SHALL use a prompt that preserves timestamps and structure while correcting only the text content
3. WHEN OpenAI returns corrected text THEN the system SHALL maintain exact timestamp formatting and line breaks
4. IF the OpenAI API fails THEN the system SHALL provide a fallback option to convert without correction
5. WHEN correcting German text THEN the system SHALL ensure proper use of umlauts (ü, ö, ä, ß)

### Requirement 3

**User Story:** As a Bunny Stream user, I want my VTT files to be fully compatible with Bunny Stream, so that they work without additional formatting.

#### Acceptance Criteria

1. WHEN converting SRT to VTT THEN the system SHALL add "WEBVTT" header as the first line without BOM
2. WHEN converting timestamps THEN the system SHALL change comma separators to periods (00:00:00,000 → 00:00:00.000)
3. WHEN creating VTT output THEN the system SHALL remove subtitle sequence numbers
4. WHEN generating VTT THEN the system SHALL include an empty line after the WEBVTT header
5. WHEN outputting the file THEN the system SHALL ensure UTF-8 encoding without BOM

### Requirement 4

**User Story:** As a user with files in different encodings, I want the system to handle encoding automatically, so that I don't need to worry about character encoding issues.

#### Acceptance Criteria

1. WHEN processing an uploaded file THEN the system SHALL automatically detect the input encoding (ISO-8859-1, Windows-1252, UTF-8)
2. WHEN any encoding is detected THEN the system SHALL convert it to UTF-8 without BOM
3. WHEN special characters are present THEN the system SHALL preserve them correctly in the output
4. IF encoding detection fails THEN the system SHALL default to UTF-8 and log the issue

### Requirement 5

**User Story:** As a user, I want to see the progress of my file conversion, so that I know the system is working and when it's complete.

#### Acceptance Criteria

1. WHEN file processing begins THEN the system SHALL display a progress indicator showing current stage
2. WHEN processing stages change THEN the system SHALL update the status (Upload → Correction → Conversion → Download)
3. WHEN processing is complete THEN the system SHALL automatically trigger download of the VTT file
4. IF any error occurs THEN the system SHALL display a clear error message in red
5. WHEN processing succeeds THEN the system SHALL display a success message in green

### Requirement 6

**User Story:** As a developer, I want the system to be configurable and maintainable, so that I can easily deploy and modify it.

#### Acceptance Criteria

1. WHEN starting the application THEN the system SHALL run on port 3000
2. WHEN configuring OpenAI THEN the system SHALL read the API key from environment variables
3. WHEN handling file uploads THEN the system SHALL use multipart/form-data via a /convert endpoint
4. WHEN errors occur THEN the system SHALL log them appropriately for debugging
5. WHEN the server starts THEN the system SHALL serve static files from the public directory

### Requirement 7

**User Story:** As a user, I want the interface to be simple and intuitive, so that I can use it without instructions.

#### Acceptance Criteria

1. WHEN the page loads THEN the system SHALL display a minimalist, centered design
2. WHEN processing files THEN the system SHALL show a progress bar during conversion
3. WHEN operations complete THEN the system SHALL provide clear visual feedback
4. WHEN errors occur THEN the system SHALL display user-friendly error messages
5. WHEN the interface is displayed THEN the system SHALL be responsive and work on different screen sizes

### Requirement 8

**User Story:** As a Bunny Stream user, I want additional integration features, so that I can easily upload subtitles to Bunny Stream without manual conversion.

#### Acceptance Criteria

1. WHEN processing completes THEN the system SHALL offer Base64 encoded output for direct API upload
2. WHEN detecting subtitle language THEN the system SHALL suggest appropriate ISO 639-1 language codes
3. WHEN generating VTT files THEN the system SHALL ensure strict WEBVTT format compliance for Bunny Stream
4. WHEN serving files THEN the system SHALL use correct MIME type (text/vtt) for browser compatibility
5. WHEN outputting VTT THEN the system SHALL ensure no BOM or leading spaces before WEBVTT header