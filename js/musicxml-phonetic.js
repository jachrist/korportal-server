/**
 * MusicXML Phonetic Converter
 * Konverterer norsk sangtekst i MusicXML til fonetisk tysk representasjon.
 * Port av convert_musicxml.py til klientside JavaScript.
 *
 * @module MusicXMLPhonetic
 */

// ==========================================================================
// CONVERSION DATA
// ==========================================================================

const RULES_BOKMAAL = [
    { from: 'skj', to: 'sch' },
    { from: 'kj', to: 'ch' },
    { from: 'sj', to: 'sch' },
    { from: 'hv', to: 'w' },
    { from: 'gj', to: 'j' },
    { from: 'ei', to: 'ai' },
    { from: 'øy', to: 'öi' },
    { from: 'au', to: 'au' },
    { from: 'æ', to: 'ä' },
    { from: 'ø', to: 'ö' },
    { from: 'å', to: 'o' },
    { from: 'y', to: 'ü' },
    { from: 'hj', to: 'j' },
    { from: 'tv', to: 'tw' },
    { from: 'v', to: 'w' },
    { from: 'kv', to: 'qu' },
    { from: 'stj', to: 'sti' },
    { from: 'med ', to: 'me ' }
];

const RULES_NYNORSK = [
    { from: 'skj', to: 'sch' },
    { from: 'kj', to: 'ch' },
    { from: 'sj', to: 'sch' },
    { from: 'gj', to: 'j' },
    { from: 'ei', to: 'ai' },
    { from: 'øy', to: 'öi' },
    { from: 'au', to: 'au' },
    { from: 'æ', to: 'ä' },
    { from: 'ø', to: 'ö' },
    { from: 'å', to: 'o' },
    { from: 'y', to: 'ü' }
];

const SPECIAL_WORDS_BOKMAAL = {
    'jeg': 'jai',
    'deg': 'dai',
    'meg': 'mai',
    'seg': 'sai',
    'og': 'o',
    'det': 'de',
    'de': 'di',
    'er': 'är',
    'var': 'war',
    'har': 'har',
    'hva': 'wa',
    'hvor': 'wor',
    'hvem': 'wem',
    'hvorfor': 'worfor',
    'hvordan': 'wordan',
    'når': 'nor',
    'nå': 'no',
    'her': 'här',
    'der': 'där',
    'være': 'wäre',
    'gjøre': 'jöre',
    'gå': 'go',
    'få': 'fo',
    'stå': 'sto',
    'ta': 'ta',
    'gi': 'ji',
    'si': 'si',
    'vi': 'wi',
    'dere': 'däre',
    'dem': 'dem',
    'den': 'den',
    'dette': 'dette',
    'disse': 'disse',
    'ikke': 'ikke',
    'aldri': 'aldri',
    'alltid': 'alltid',
    'også': 'oso'
};

const SPECIAL_WORDS_NYNORSK = {
    'eg': 'äg',
    'deg': 'däg',
    'meg': 'mäg',
    'seg': 'säg',
    'og': 'og',
    'det': 'de',
    'dei': 'dai',
    'er': 'är',
    'var': 'war',
    'har': 'har',
    'kva': 'kwa',
    'kor': 'kor',
    'kven': 'kwen',
    'korfor': 'korfor',
    'korleis': 'korlais',
    'når': 'nor',
    'no': 'no',
    'her': 'här',
    'der': 'där',
    'vere': 'wäre',
    'gjere': 'järe',
    'gå': 'go',
    'få': 'fo',
    'stå': 'sto',
    'ta': 'ta',
    'gje': 'je',
    'seie': 'saie',
    'vi': 'wi',
    'de': 'di',
    'dykk': 'dükk',
    'deira': 'daira',
    'den': 'den',
    'dette': 'dette',
    'desse': 'desse',
    'ikkje': 'ikkje',
    'aldri': 'aldri',
    'alltid': 'alltid',
    'òg': 'og',
    'nokon': 'nokon',
    'noko': 'noko',
    'andre': 'andre',
    'anna': 'anna'
};

// ==========================================================================
// CONVERSION LOGIC
// ==========================================================================

function applyCase(original, converted) {
    if (!original || !converted) return converted;
    if (original === original.toUpperCase() && original !== original.toLowerCase()) {
        return converted.toUpperCase();
    }
    if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
        return converted[0].toUpperCase() + converted.slice(1);
    }
    return converted;
}

function convertWord(word, specialWords, rules) {
    if (!word) return word;

    const originalWord = word;
    const wordLower = word.toLowerCase();

    if (wordLower in specialWords) {
        return applyCase(originalWord, specialWords[wordLower]);
    }

    let result = wordLower;
    for (const rule of rules) {
        if (rule.from) {
            result = result.replaceAll(rule.from, rule.to);
        }
    }

    return applyCase(originalWord, result);
}

function convertText(text, specialWords, rules) {
    if (!text) return text;

    const pattern = /([a-zA-ZæøåÆØÅäöüÄÖÜòÒ]+)|([^a-zA-ZæøåÆØÅäöüÄÖÜòÒ]+)/g;
    const parts = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
            parts.push(convertWord(match[1], specialWords, rules));
        } else if (match[2]) {
            parts.push(match[2]);
        }
    }

    return parts.join('');
}

// ==========================================================================
// MAIN CONVERSION FUNCTION
// ==========================================================================

/**
 * Konverterer norsk sangtekst i en MusicXML-fil til fonetisk tysk.
 *
 * @param {string} xmlString - MusicXML-filinnhold som streng
 * @param {string} dialect - 'bokmaal' eller 'nynorsk'
 * @returns {{ xml: string, convertedCount: number }}
 */
export function convertPhonetic(xmlString, dialect = 'bokmaal') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Ugyldig XML-fil: ' + parseError.textContent.slice(0, 100));
    }

    const root = doc.documentElement;
    if (root.tagName !== 'score-partwise') {
        throw new Error(`Forventet score-partwise, fant: ${root.tagName}. Kun score-partwise-format støttes.`);
    }

    const specialWords = dialect === 'nynorsk' ? SPECIAL_WORDS_NYNORSK : SPECIAL_WORDS_BOKMAAL;
    const rules = dialect === 'nynorsk' ? RULES_NYNORSK : RULES_BOKMAAL;

    let convertedCount = 0;

    const lyrics = doc.getElementsByTagName('lyric');
    for (const lyric of lyrics) {
        const textElements = lyric.getElementsByTagName('text');
        for (const textEl of textElements) {
            if (textEl.textContent) {
                const original = textEl.textContent;
                const converted = convertText(original, specialWords, rules);
                if (original !== converted) {
                    textEl.textContent = converted;
                    convertedCount++;
                }
            }
        }
    }

    const serializer = new XMLSerializer();
    let xml = serializer.serializeToString(doc);

    // Legg til XML-deklarasjon hvis den mangler
    if (!xml.startsWith('<?xml')) {
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
    }

    return { xml, convertedCount };
}
