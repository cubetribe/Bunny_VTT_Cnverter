/**
 * Test data fixtures for SRT to VTT converter tests
 * Contains various SRT formats, encodings, and edge cases
 */

const iconv = require('iconv-lite');

// Valid SRT content samples
const validSRTSamples = {
  simple: `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,000
This is a test subtitle`,

  multiLine: `1
00:00:01,000 --> 00:00:04,000
Hello world
This is line two

2
00:00:05,000 --> 00:00:08,000
Another subtitle
With multiple lines
And even more text`,

  german: `1
00:00:01,000 --> 00:00:03,000
Hällö Wörld mit Ümläüten

2
00:00:04,000 --> 00:00:06,000
Müller sagte "Guten Tag"
Größe: 42 weiß`,

  specialChars: `1
00:00:01,000 --> 00:00:03,000
Special chars: àáâãäåæçèéêë

2
00:00:04,000 --> 00:00:06,000
More special: ìíîïðñòóôõö÷øùúûüýþÿ`,

  longTimestamps: `1
01:23:45,678 --> 01:23:48,901
Long timestamp test

2
23:59:58,999 --> 23:59:59,999
Maximum timestamp test`,

  emptyLinesInText: `1
00:00:01,000 --> 00:00:04,000
Line one

Line three

2
00:00:05,000 --> 00:00:08,000
Another subtitle
With empty line above`,

  windowsLineEndings: `1\r\n00:00:01,000 --> 00:00:04,000\r\nHello world\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nTest subtitle`,

  withBOM: `\uFEFF1
00:00:01,000 --> 00:00:04,000
Content with BOM

2
00:00:05,000 --> 00:00:08,000
Second subtitle`
};

// Invalid SRT content samples
const invalidSRTSamples = {
  noIndex: `00:00:01,000 --> 00:00:04,000
Missing index`,

  invalidIndex: `abc
00:00:01,000 --> 00:00:04,000
Invalid index`,

  noTimestamp: `1
Missing timestamp
Hello world`,

  invalidTimestamp: `1
00:00:01.000 --> 00:00:04.000
Wrong separator in timestamp`,

  noArrow: `1
00:00:01,000 00:00:04,000
Missing arrow in timestamp`,

  noText: `1
00:00:01,000 --> 00:00:04,000

`,

  onlyWhitespaceText: `1
00:00:01,000 --> 00:00:04,000
   
   `,

  incompleteBlock: `1
00:00:01,000 --> 00:00:04,000`,

  mixedValidInvalid: `1
00:00:01,000 --> 00:00:04,000
Valid subtitle

invalid_index
00:00:05,000 --> 00:00:08,000
Invalid subtitle`,

  empty: '',
  
  null: null,
  
  undefined: undefined
};

// Expected VTT outputs for valid SRT samples
const expectedVTTOutputs = {
  simple: `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:04.000 --> 00:00:06.000
This is a test subtitle

`,

  multiLine: `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world
This is line two

00:00:05.000 --> 00:00:08.000
Another subtitle
With multiple lines
And even more text

`,

  german: `WEBVTT

00:00:01.000 --> 00:00:03.000
Hällö Wörld mit Ümläüten

00:00:04.000 --> 00:00:06.000
Müller sagte "Guten Tag"
Größe: 42 weiß

`
};

// Create buffers with different encodings
function createEncodedBuffers() {
  const germanText = validSRTSamples.german;
  
  return {
    utf8: Buffer.from(germanText, 'utf8'),
    utf8WithBOM: Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(germanText, 'utf8')]),
    // Only use encodings that can actually represent the German characters
    iso88591: iconv.encode(germanText, 'iso-8859-1'),
    windows1252: iconv.encode(germanText, 'windows-1252')
  };
}

// Windows-1252 specific test content
const windows1252SpecificContent = `1
00:00:01,000 --> 00:00:03,000
Smart quotes: "Hello" and 'world'

2
00:00:04,000 --> 00:00:06,000
Em dash — and ellipsis…`;

// Create test buffers for encoding detection
function createEncodingTestBuffers() {
  return {
    asciiOnly: Buffer.from('Hello World 123', 'ascii'),
    utf8MultiByte: Buffer.from('Héllo Wörld ñ', 'utf8'),
    windows1252Smart: iconv.encode(windows1252SpecificContent, 'windows-1252'),
    iso88591Accents: iconv.encode('Café résumé naïve', 'iso-8859-1'),
    invalidUTF8: Buffer.from([0xC0, 0x80]), // Overlong encoding
    emptyBuffer: Buffer.alloc(0),
    singleByte: Buffer.from([0x41]), // 'A'
    highBytesOnly: Buffer.from([0xFF, 0xFE, 0xFD, 0xFC])
  };
}

// Edge case SRT content for stress testing
const edgeCaseSRTSamples = {
  singleSubtitle: `1
00:00:01,000 --> 00:00:03,000
Single subtitle only`,

  zeroTimestamp: `1
00:00:00,000 --> 00:00:02,000
Starting at zero`,

  maxTimestamp: `1
23:59:57,000 --> 23:59:59,999
Maximum valid timestamp`,

  extraWhitespace: `  1  
  00:00:01,000   -->   00:00:03,000  
  Text with extra whitespace  

  2  
  00:00:04,000   -->   00:00:06,000  
  Another subtitle  `,

  manyEmptyLines: `1
00:00:01,000 --> 00:00:03,000
First subtitle



2
00:00:04,000 --> 00:00:06,000
Second subtitle




3
00:00:07,000 --> 00:00:09,000
Third subtitle`,

  veryLongText: `1
00:00:01,000 --> 00:00:10,000
This is a very long subtitle that spans multiple lines and contains a lot of text to test how the parser handles longer content. It should preserve all the text content exactly as it appears in the original file without any truncation or modification of the text structure.

2
00:00:11,000 --> 00:00:15,000
Another long subtitle with multiple paragraphs.

This is the second paragraph of the same subtitle.

And this is the third paragraph with even more content to ensure proper handling.`
};

// Malformed SRT samples for error testing
const malformedSRTSamples = {
  negativeTimestamp: `1
-00:00:01,000 --> 00:00:03,000
Negative timestamp`,

  invalidMilliseconds: `1
00:00:01,1000 --> 00:00:03,000
Too many millisecond digits`,

  missingMilliseconds: `1
00:00:01,00 --> 00:00:03,000
Too few millisecond digits`,

  extraTimestampParts: `1
00:00:01,000,000 --> 00:00:03,000
Extra comma in timestamp`,

  nonNumericTime: `1
aa:bb:cc,ddd --> 00:00:03,000
Non-numeric time parts`
};

module.exports = {
  validSRTSamples,
  invalidSRTSamples,
  expectedVTTOutputs,
  edgeCaseSRTSamples,
  malformedSRTSamples,
  windows1252SpecificContent,
  createEncodedBuffers,
  createEncodingTestBuffers
};