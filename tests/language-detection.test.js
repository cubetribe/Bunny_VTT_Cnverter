/**
 * Tests for Language Detection Module
 * Tests automatic language detection and ISO 639-1 code suggestions
 */

const { detectLanguage, getSupportedLanguages, isValidLanguageCode, getLanguageName, extractTextFromSRT } = require('../utils/language-detection');

describe('Language Detection Module', () => {
    describe('extractTextFromSRT', () => {
        test('should extract text from valid SRT content', () => {
            const srtContent = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,000
This is a test`;

            const result = extractTextFromSRT(srtContent);
            expect(result).toBe('Hello world This is a test');
        });

        test('should handle SRT with multiple lines per subtitle', () => {
            const srtContent = `1
00:00:01,000 --> 00:00:03,000
Hello world
This is line two

2
00:00:04,000 --> 00:00:06,000
Another subtitle
With multiple lines`;

            const result = extractTextFromSRT(srtContent);
            expect(result).toBe('Hello world This is line two Another subtitle With multiple lines');
        });

        test('should handle empty SRT content', () => {
            expect(() => extractTextFromSRT('')).toThrow('Invalid SRT content');
            expect(() => extractTextFromSRT(null)).toThrow('Invalid SRT content');
            expect(() => extractTextFromSRT(undefined)).toThrow('Invalid SRT content');
        });

        test('should handle malformed SRT gracefully', () => {
            const srtContent = `1
00:00:01,000 --> 00:00:03,000

2
00:00:04,000 --> 00:00:06,000
Valid subtitle`;

            const result = extractTextFromSRT(srtContent);
            expect(result).toBe('Valid subtitle');
        });
    });

    describe('detectLanguage', () => {
        test('should detect English text correctly', () => {
            const englishText = 'The quick brown fox jumps over the lazy dog. This is a test of the English language detection system.';
            const result = detectLanguage(englishText);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('en');
            expect(result.language.name).toBe('English');
            expect(result.confidence).toBeGreaterThan(0.3);
        });

        test('should detect German text correctly', () => {
            const germanText = 'Das ist ein Test der deutschen Spracherkennung. Die Katze sitzt auf der Matte und schläft.';
            const result = detectLanguage(germanText);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('de');
            expect(result.language.name).toBe('German');
            expect(result.confidence).toBeGreaterThan(0.3);
        });

        test('should detect Spanish text correctly', () => {
            const spanishText = 'Esta es una prueba del sistema de detección de idioma español. El gato está en la casa.';
            const result = detectLanguage(spanishText);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('es');
            expect(result.language.name).toBe('Spanish');
            expect(result.confidence).toBeGreaterThan(0.3);
        });

        test('should detect French text correctly', () => {
            const frenchText = 'Ceci est un test du système de détection de langue française. Le chat est sur le tapis.';
            const result = detectLanguage(frenchText);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('fr');
            expect(result.language.name).toBe('French');
            expect(result.confidence).toBeGreaterThan(0.3);
        });

        test('should handle SRT content directly', () => {
            const srtContent = `1
00:00:01,000 --> 00:00:03,000
The quick brown fox jumps over the lazy dog

2
00:00:04,000 --> 00:00:06,000
This is a test of English detection`;

            const result = detectLanguage(srtContent);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('en');
            expect(result.language.name).toBe('English');
        });

        test('should return suggestions for ambiguous text', () => {
            const ambiguousText = 'Hello test bonjour mundo the quick brown fox';
            const result = detectLanguage(ambiguousText);

            expect(result.suggestions).toBeInstanceOf(Array);
            // Even if no language is detected with high confidence, we should get suggestions
            if (result.suggestions.length > 0) {
                expect(result.suggestions[0]).toHaveProperty('code');
                expect(result.suggestions[0]).toHaveProperty('name');
                expect(result.suggestions[0]).toHaveProperty('confidence');
            }
        });

        test('should handle empty or invalid content', () => {
            expect(() => detectLanguage('')).toThrow('Invalid content');
            expect(() => detectLanguage(null)).toThrow('Invalid content');
            expect(() => detectLanguage(undefined)).toThrow('Invalid content');
        });

        test('should handle content with no detectable language', () => {
            const noLanguageText = '123 456 789 !@# $%^';
            const result = detectLanguage(noLanguageText);

            expect(result.detected).toBe(false);
            expect(result.language).toBe(null);
            expect(result.confidence).toBeLessThan(0.1);
        });

        test('should provide multiple suggestions sorted by confidence', () => {
            const mixedText = 'Hello world and bonjour monde. This is a test with the quick brown fox.';
            const result = detectLanguage(mixedText);

            expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
            
            // Check that suggestions are sorted by confidence (descending)
            for (let i = 1; i < result.suggestions.length; i++) {
                expect(result.suggestions[i-1].confidence).toBeGreaterThanOrEqual(result.suggestions[i].confidence);
            }
        });
    });

    describe('getSupportedLanguages', () => {
        test('should return array of supported languages', () => {
            const languages = getSupportedLanguages();

            expect(languages).toBeInstanceOf(Array);
            expect(languages.length).toBeGreaterThan(0);
            
            // Check structure of language objects
            languages.forEach(lang => {
                expect(lang).toHaveProperty('code');
                expect(lang).toHaveProperty('name');
                expect(typeof lang.code).toBe('string');
                expect(typeof lang.name).toBe('string');
                expect(lang.code.length).toBe(2);
            });
        });

        test('should return languages sorted alphabetically by name', () => {
            const languages = getSupportedLanguages();
            
            for (let i = 1; i < languages.length; i++) {
                expect(languages[i-1].name.localeCompare(languages[i].name)).toBeLessThanOrEqual(0);
            }
        });

        test('should include common languages', () => {
            const languages = getSupportedLanguages();
            const codes = languages.map(lang => lang.code);

            expect(codes).toContain('en');
            expect(codes).toContain('de');
            expect(codes).toContain('es');
            expect(codes).toContain('fr');
        });
    });

    describe('isValidLanguageCode', () => {
        test('should validate correct ISO 639-1 codes', () => {
            expect(isValidLanguageCode('en')).toBe(true);
            expect(isValidLanguageCode('de')).toBe(true);
            expect(isValidLanguageCode('es')).toBe(true);
            expect(isValidLanguageCode('fr')).toBe(true);
            expect(isValidLanguageCode('EN')).toBe(true); // Should handle uppercase
        });

        test('should reject invalid codes', () => {
            expect(isValidLanguageCode('eng')).toBe(false); // Too long
            expect(isValidLanguageCode('e')).toBe(false); // Too short
            expect(isValidLanguageCode('xx')).toBe(false); // Not supported
            expect(isValidLanguageCode('')).toBe(false); // Empty
            expect(isValidLanguageCode(null)).toBe(false); // Null
            expect(isValidLanguageCode(undefined)).toBe(false); // Undefined
            expect(isValidLanguageCode(123)).toBe(false); // Not string
        });
    });

    describe('getLanguageName', () => {
        test('should return correct language names', () => {
            expect(getLanguageName('en')).toBe('English');
            expect(getLanguageName('de')).toBe('German');
            expect(getLanguageName('es')).toBe('Spanish');
            expect(getLanguageName('fr')).toBe('French');
            expect(getLanguageName('EN')).toBe('English'); // Should handle uppercase
        });

        test('should return null for invalid codes', () => {
            expect(getLanguageName('xx')).toBe(null);
            expect(getLanguageName('eng')).toBe(null);
            expect(getLanguageName('')).toBe(null);
            expect(getLanguageName(null)).toBe(null);
            expect(getLanguageName(undefined)).toBe(null);
        });
    });

    describe('Language-specific detection accuracy', () => {
        test('should detect German with umlauts', () => {
            const germanText = 'Müller geht über die Straße und kauft Bröt­chen für das Frühstück.';
            const result = detectLanguage(germanText);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('de');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should detect Spanish with accents', () => {
            const spanishText = 'José está en la montaña con María y Andrés comiendo paella.';
            const result = detectLanguage(spanishText);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('es');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should detect French with accents', () => {
            const frenchText = 'Français avec des accents: café, hôtel, naïve, Noël, être.';
            const result = detectLanguage(frenchText);

            expect(result.detected).toBe(true);
            expect(result.language.code).toBe('fr');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should handle mixed language content', () => {
            const mixedText = 'Hello world and the quick brown fox. Bonjour monde. Hola mundo. Hallo Welt.';
            const result = detectLanguage(mixedText);

            // Should still detect something, but confidence might be lower
            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.suggestions[0].confidence).toBeGreaterThan(0);
        });
    });

    describe('Edge cases and error handling', () => {
        test('should handle very short text', () => {
            const shortText = 'Hi';
            const result = detectLanguage(shortText);

            // Should handle gracefully, might not detect reliably
            expect(result).toHaveProperty('detected');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('suggestions');
        });

        test('should handle text with only punctuation', () => {
            const punctuationText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const result = detectLanguage(punctuationText);

            expect(result.detected).toBe(false);
            expect(result.confidence).toBeLessThan(0.1);
        });

        test('should handle text with numbers only', () => {
            const numbersText = '123 456 789 000 111 222';
            const result = detectLanguage(numbersText);

            expect(result.detected).toBe(false);
            expect(result.confidence).toBeLessThan(0.1);
        });

        test('should handle SRT with no text content', () => {
            const emptySrtContent = `1
00:00:01,000 --> 00:00:03,000

2
00:00:04,000 --> 00:00:06,000
`;

            const result = detectLanguage(emptySrtContent);

            expect(result.detected).toBe(false);
            expect(result.language).toBe(null);
        });
    });
});