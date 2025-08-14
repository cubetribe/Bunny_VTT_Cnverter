const { detectEncoding, convertToUTF8 } = require('../utils/encoding');
const iconv = require('iconv-lite');

// Example usage of the encoding detection and conversion module

console.log('=== Encoding Detection and Conversion Examples ===\n');

// Example 1: UTF-8 with BOM
console.log('1. UTF-8 with BOM:');
const utf8WithBOM = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
console.log('   Detected:', detectEncoding(utf8WithBOM));
console.log('   Converted:', convertToUTF8(utf8WithBOM).toString('utf8'));
console.log();

// Example 2: German text in ISO-8859-1
console.log('2. German text in ISO-8859-1:');
const germanText = 'Müller sagte "Hallo Welt"';
const iso88591Buffer = iconv.encode(germanText, 'iso-8859-1');
console.log('   Original text:', germanText);
console.log('   Detected:', detectEncoding(iso88591Buffer));
console.log('   Converted:', convertToUTF8(iso88591Buffer).toString('utf8'));
console.log();

// Example 3: Windows-1252 with smart quotes
console.log('3. Windows-1252 with smart quotes:');
const win1252Text = 'Hello "smart quotes"';
const win1252Buffer = iconv.encode(win1252Text, 'windows-1252');
console.log('   Original text:', win1252Text);
console.log('   Detected:', detectEncoding(win1252Buffer));
console.log('   Converted:', convertToUTF8(win1252Buffer).toString('utf8'));
console.log();

// Example 4: SRT-like content
console.log('4. SRT-like content with special characters:');
const srtContent = `1
00:00:01,000 --> 00:00:03,000
Héllo Wörld

2
00:00:04,000 --> 00:00:06,000
Müller sagte "Hallo"`;

const srtBuffer = iconv.encode(srtContent, 'iso-8859-1');
console.log('   Detected:', detectEncoding(srtBuffer));
const convertedSrt = convertToUTF8(srtBuffer).toString('utf8');
console.log('   Converted SRT content:');
console.log(convertedSrt);