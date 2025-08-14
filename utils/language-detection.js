/**
 * Language Detection Module for SRT/VTT Content
 * Provides automatic language detection and ISO 639-1 code suggestions
 */

/**
 * ISO 639-1 language codes mapping with common language patterns
 */
const LANGUAGE_PATTERNS = {
    'en': {
        name: 'English',
        patterns: [
            /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
            /\b(is|are|was|were|have|has|had|will|would|could|should)\b/gi,
            /\b(this|that|these|those|here|there|where|when|what|who|how|why)\b/gi
        ],
        commonWords: ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i']
    },
    'de': {
        name: 'German',
        patterns: [
            /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\b/gi,
            /\b(und|oder|aber|in|auf|an|zu|für|von|mit|bei|nach|über|unter|vor|hinter)\b/gi,
            /\b(ist|sind|war|waren|haben|hat|hatte|wird|würde|könnte|sollte)\b/gi,
            /[äöüß]/gi
        ],
        commonWords: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als']
    },
    'es': {
        name: 'Spanish',
        patterns: [
            /\b(el|la|los|las|un|una|unos|unas|de|del|al)\b/gi,
            /\b(y|o|pero|en|con|por|para|desde|hasta|sobre|bajo|ante|tras)\b/gi,
            /\b(es|son|era|eran|tiene|tienen|tenía|será|sería|podría|debería)\b/gi,
            /[ñáéíóúü]/gi
        ],
        commonWords: ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al']
    },
    'fr': {
        name: 'French',
        patterns: [
            /\b(le|la|les|un|une|des|du|de|d')\b/gi,
            /\b(et|ou|mais|dans|sur|avec|par|pour|sans|sous|entre|pendant|après|avant)\b/gi,
            /\b(est|sont|était|étaient|a|ont|avait|sera|serait|pourrait|devrait)\b/gi,
            /[àâäéèêëïîôöùûüÿç]/gi
        ],
        commonWords: ['de', 'le', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se']
    },
    'it': {
        name: 'Italian',
        patterns: [
            /\b(il|la|lo|gli|le|un|una|uno|del|della|dello|degli|delle)\b/gi,
            /\b(e|o|ma|in|su|con|per|da|di|a|tra|fra|durante|dopo|prima)\b/gi,
            /\b(è|sono|era|erano|ha|hanno|aveva|sarà|sarebbe|potrebbe|dovrebbe)\b/gi,
            /[àèéìíîòóù]/gi
        ],
        commonWords: ['di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'la', 'il', 'lo', 'gli', 'le', 'un', 'una', 'uno', 'del', 'della', 'dello']
    },
    'pt': {
        name: 'Portuguese',
        patterns: [
            /\b(o|a|os|as|um|uma|uns|umas|do|da|dos|das|no|na|nos|nas)\b/gi,
            /\b(e|ou|mas|em|com|por|para|de|desde|até|sobre|sob|entre|durante|após|antes)\b/gi,
            /\b(é|são|era|eram|tem|têm|tinha|será|seria|poderia|deveria)\b/gi,
            /[ãâáàçéêíóôõú]/gi
        ],
        commonWords: ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais']
    },
    'ru': {
        name: 'Russian',
        patterns: [
            /[а-яё]/gi,
            /\b(и|в|не|на|я|быть|тот|он|оно|она|они|мы|вы|ты|что|это|как|где|когда)\b/gi
        ],
        commonWords: ['в', 'и', 'не', 'на', 'я', 'быть', 'тот', 'он', 'оно', 'она', 'они', 'мы', 'вы', 'ты', 'что', 'это', 'как', 'где', 'когда', 'почему']
    },
    'ja': {
        name: 'Japanese',
        patterns: [
            /[ひらがなカタカナ漢字]/gi,
            /[あ-んア-ン一-龯]/gi,
            /\b(です|である|だ|は|が|を|に|で|と|の|から|まで|より|について)\b/gi
        ],
        commonWords: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として']
    },
    'zh': {
        name: 'Chinese',
        patterns: [
            /[一-龯]/gi,
            /\b(的|了|和|是|在|有|不|我|你|他|她|它|们|这|那|什么|怎么|为什么|哪里|什么时候)\b/gi
        ],
        commonWords: ['的', '了', '和', '是', '在', '有', '不', '我', '你', '他', '她', '它', '们', '这', '那', '什么', '怎么', '为什么', '哪里', '什么时候']
    },
    'ko': {
        name: 'Korean',
        patterns: [
            /[가-힣]/gi,
            /\b(이|그|저|의|를|을|에|에서|와|과|로|으로|는|은|가|이|하다|있다|없다|되다)\b/gi
        ],
        commonWords: ['이', '그', '저', '의', '를', '을', '에', '에서', '와', '과', '로', '으로', '는', '은', '가', '이', '하다', '있다', '없다', '되다']
    }
};

/**
 * Extracts text content from SRT subtitle data
 * @param {string} srtContent - Raw SRT content
 * @returns {string} - Extracted text content without timestamps
 */
function extractTextFromSRT(srtContent) {
    if (!srtContent || typeof srtContent !== 'string') {
        throw new Error('Invalid SRT content: must be a non-empty string');
    }

    // Split into blocks (separated by double newlines)
    const blocks = srtContent.trim().split(/\n\s*\n/);
    const textLines = [];

    for (const block of blocks) {
        const lines = block.trim().split('\n');
        
        // Skip empty blocks
        if (lines.length < 3) continue;
        
        // Skip sequence number (first line) and timestamp (second line)
        // Collect all remaining lines as subtitle text
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                textLines.push(line);
            }
        }
    }

    return textLines.join(' ');
}

/**
 * Calculates language confidence score based on pattern matching
 * @param {string} text - Text content to analyze
 * @param {string} langCode - Language code to test
 * @returns {number} - Confidence score (0-1)
 */
function calculateLanguageScore(text, langCode) {
    const language = LANGUAGE_PATTERNS[langCode];
    if (!language) return 0;

    const textLower = text.toLowerCase();
    const words = textLower.split(/\s+/).filter(word => word.length > 1);
    
    if (words.length === 0) return 0;

    let score = 0;
    let patternScore = 0;
    let commonWordScore = 0;

    // Check pattern matches with higher weight
    for (const pattern of language.patterns) {
        const matches = text.match(pattern) || [];
        if (matches.length > 0) {
            patternScore += Math.min(matches.length / Math.max(words.length, 5), 1.0);
        }
    }
    
    // Average pattern score and boost it
    patternScore = (patternScore / language.patterns.length) * 2.0;

    // Check common word frequency
    let commonWordMatches = 0;
    for (const word of words) {
        if (language.commonWords.includes(word)) {
            commonWordMatches++;
        }
    }
    
    commonWordScore = (commonWordMatches / words.length) * 3.0; // Higher weight for common words

    // Combine scores with weighted average
    score = (patternScore * 0.4) + (commonWordScore * 0.6);

    // Apply bonus for special character patterns (for languages with unique characters)
    if (langCode === 'de' && /[äöüß]/gi.test(text)) {
        score += 0.3;
    } else if (langCode === 'es' && /[ñáéíóúü]/gi.test(text)) {
        score += 0.3;
    } else if (langCode === 'fr' && /[àâäéèêëïîôöùûüÿç]/gi.test(text)) {
        score += 0.3;
    }

    return Math.min(score, 1.0);
}

/**
 * Detects the most likely language of subtitle content
 * @param {string} srtContent - Raw SRT content or extracted text
 * @returns {Object} - Detection result with language code, name, and confidence
 */
function detectLanguage(srtContent) {
    if (!srtContent || typeof srtContent !== 'string') {
        throw new Error('Invalid content: must be a non-empty string');
    }

    // Extract text if this looks like SRT content (contains timestamps)
    let textContent = srtContent;
    if (srtContent.includes('-->') || /\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(srtContent)) {
        textContent = extractTextFromSRT(srtContent);
    }

    if (!textContent.trim()) {
        return {
            detected: false,
            language: null,
            confidence: 0,
            suggestions: []
        };
    }

    // Calculate scores for all languages
    const scores = {};
    for (const langCode of Object.keys(LANGUAGE_PATTERNS)) {
        scores[langCode] = calculateLanguageScore(textContent, langCode);
    }

    // Sort by confidence score
    const sortedResults = Object.entries(scores)
        .map(([code, score]) => ({
            code,
            name: LANGUAGE_PATTERNS[code].name,
            confidence: score
        }))
        .sort((a, b) => b.confidence - a.confidence);

    const topResult = sortedResults[0];
    const minConfidence = 0.1; // Minimum confidence threshold

    return {
        detected: topResult.confidence >= minConfidence,
        language: topResult.confidence >= minConfidence ? {
            code: topResult.code,
            name: topResult.name,
            confidence: topResult.confidence
        } : null,
        confidence: topResult.confidence,
        suggestions: sortedResults
            .filter(result => result.confidence >= Math.min(minConfidence, 0.05)) // Lower threshold for suggestions
            .slice(0, 3) // Top 3 suggestions
    };
}

/**
 * Gets language suggestions for manual selection
 * @returns {Array} - Array of all supported languages with codes and names
 */
function getSupportedLanguages() {
    return Object.entries(LANGUAGE_PATTERNS).map(([code, info]) => ({
        code,
        name: info.name
    })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validates ISO 639-1 language code
 * @param {string} langCode - Language code to validate
 * @returns {boolean} - True if valid and supported
 */
function isValidLanguageCode(langCode) {
    return typeof langCode === 'string' && 
           langCode.length === 2 && 
           LANGUAGE_PATTERNS.hasOwnProperty(langCode.toLowerCase());
}

/**
 * Gets language name from ISO 639-1 code
 * @param {string} langCode - Language code
 * @returns {string|null} - Language name or null if not found
 */
function getLanguageName(langCode) {
    if (!isValidLanguageCode(langCode)) {
        return null;
    }
    return LANGUAGE_PATTERNS[langCode.toLowerCase()].name;
}

module.exports = {
    detectLanguage,
    getSupportedLanguages,
    isValidLanguageCode,
    getLanguageName,
    extractTextFromSRT
};