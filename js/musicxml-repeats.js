/**
 * MusicXML Repeat Expander
 * Ekspanderer repetisjoner, D.S., D.C., Coda, Fine i MusicXML-filer.
 *
 * Støtter:
 * - Enkle repetisjoner (forward/backward barlines)
 * - Første/andre hus (volta brackets / endings)
 * - Dal Segno (D.S.) og D.S. al Coda / D.S. al Fine
 * - Da Capo (D.C.) og D.C. al Coda / D.C. al Fine
 * - Segno, Coda, Fine-markeringer
 * - Repetisjonsteller (times-attributt)
 *
 * @module MusicXMLRepeats
 */

// ==========================================================================
// MEASURE PARSING
// ==========================================================================

/**
 * Parser navigasjonsmarkeringer fra en takt.
 * Bruker kun første part for navigasjonssignaler.
 */
function parseMeasureNavigation(measure) {
    const nav = {
        number: measure.getAttribute('number'),
        forwardRepeat: false,
        backwardRepeat: false,
        backwardRepeatTimes: 2,
        endings: [],         // [{ number: '1', type: 'start'|'stop'|'discontinue' }]
        segno: false,
        coda: false,
        fine: false,
        dsType: null,        // 'ds' | 'ds-al-coda' | 'ds-al-fine'
        dcType: null,        // 'dc' | 'dc-al-coda' | 'dc-al-fine'
        toCoda: false
    };

    // Barlines
    for (const barline of measure.getElementsByTagName('barline')) {
        const repeat = barline.getElementsByTagName('repeat')[0];
        if (repeat) {
            const direction = repeat.getAttribute('direction');
            if (direction === 'forward') {
                nav.forwardRepeat = true;
            } else if (direction === 'backward') {
                nav.backwardRepeat = true;
                const times = repeat.getAttribute('times');
                if (times) {
                    nav.backwardRepeatTimes = parseInt(times, 10);
                }
            }
        }

        // Endings (volta brackets)
        const ending = barline.getElementsByTagName('ending')[0];
        if (ending) {
            nav.endings.push({
                number: ending.getAttribute('number'),
                type: ending.getAttribute('type')
            });
        }
    }

    // Direction elements (Segno, Coda, D.S., D.C., Fine, To Coda)
    for (const direction of measure.getElementsByTagName('direction')) {
        // Sound element has dacapo, dalsegno, fine, coda, segno, tocoda attributes
        for (const sound of direction.getElementsByTagName('sound')) {
            if (sound.getAttribute('segno')) nav.segno = true;
            if (sound.getAttribute('coda')) nav.coda = true;
            if (sound.getAttribute('fine') !== null && sound.hasAttribute('fine')) nav.fine = true;
            if (sound.getAttribute('tocoda')) nav.toCoda = true;

            if (sound.getAttribute('dacapo') === 'yes') {
                nav.dcType = 'dc';
            }
            if (sound.getAttribute('dalsegno')) {
                nav.dsType = 'ds';
            }
        }

        // Also check direction-type for segno/coda symbols and text-based directions
        for (const dirType of direction.getElementsByTagName('direction-type')) {
            if (dirType.getElementsByTagName('segno').length > 0) nav.segno = true;
            if (dirType.getElementsByTagName('coda').length > 0) {
                // Coda symbol can be either the target or "To Coda" depending on context
                // We'll refine below based on words
            }

            // Check words for D.S., D.C., Fine, To Coda, al Coda, al Fine
            for (const words of dirType.getElementsByTagName('words')) {
                const text = (words.textContent || '').toLowerCase().trim();

                if (/\bfine\b/.test(text)) nav.fine = true;

                if (/\bto\s*coda\b/.test(text)) {
                    nav.toCoda = true;
                } else if (/\bd\.?\s*s\.?\s*al\s*coda\b/.test(text)) {
                    nav.dsType = 'ds-al-coda';
                } else if (/\bd\.?\s*s\.?\s*al\s*fine\b/.test(text)) {
                    nav.dsType = 'ds-al-fine';
                } else if (/\bdal\s*segno\b/.test(text) || /\bd\.?\s*s\.?\b/.test(text)) {
                    if (!nav.dsType) nav.dsType = 'ds';
                } else if (/\bd\.?\s*c\.?\s*al\s*coda\b/.test(text)) {
                    nav.dcType = 'dc-al-coda';
                } else if (/\bd\.?\s*c\.?\s*al\s*fine\b/.test(text)) {
                    nav.dcType = 'dc-al-fine';
                } else if (/\bda\s*capo\b/.test(text) || /\bd\.?\s*c\.?\b/.test(text)) {
                    if (!nav.dcType) nav.dcType = 'dc';
                }
            }
        }
    }

    return nav;
}

/**
 * Bestem om en ending tilhører et bestemt passeringsnummer.
 * ending.number kan være "1", "2", "1, 2", "1,2,3" osv.
 */
function endingMatchesPass(endingNumber, passNumber) {
    if (!endingNumber) return false;
    const nums = endingNumber.split(/[,\s]+/).map(n => parseInt(n.trim(), 10));
    return nums.includes(passNumber);
}

// ==========================================================================
// PLAYBACK ORDER STATE MACHINE
// ==========================================================================

/**
 * Simulerer avspillingsrekkefølge og returnerer en liste med taktindekser.
 *
 * @param {Array} navs - Array med navigasjonsinfo per takt
 * @returns {number[]} - Array med taktindekser i avspillingsrekkefølge
 */
function computePlaybackOrder(navs) {
    const totalMeasures = navs.length;
    const maxIterations = totalMeasures * 10;

    const order = [];
    let pos = 0;

    // Finn posisjoner for markeringer
    const segnoPos = navs.findIndex(n => n.segno);
    const codaPos = navs.findIndex(n => n.coda);
    const finePos = navs.findIndex(n => n.fine);

    // Finn "To Coda"-posisjon
    const toCodaPos = navs.findIndex(n => n.toCoda);

    // Spor repetisjonsteller for backward repeats
    const repeatCounts = new Map(); // pos -> current count

    // Tilstandsvariabler for D.S./D.C.-navigasjon
    let jumped = false;       // Om vi har gjort et D.S./D.C.-hopp
    let seekingFine = false;  // Om vi leter etter Fine etter et hopp
    let seekingCoda = false;  // Om vi skal hoppe til Coda ved "To Coda" etter et hopp

    let iteration = 0;

    while (pos < totalMeasures && iteration < maxIterations) {
        iteration++;
        const nav = navs[pos];

        // Sjekk ending (volta) - hopp over takter med feil ending-nummer
        const activeEnding = nav.endings.find(e => e.type === 'start');
        if (activeEnding) {
            const repeatPass = repeatCounts.get(findRepeatStart(navs, pos)) || 1;
            if (!endingMatchesPass(activeEnding.number, repeatPass)) {
                // Hopp over til slutten av dette ending
                pos = skipToEndingEnd(navs, pos);
                continue;
            }
        }

        // Legg til denne takten i avspillingsrekkefølgen
        order.push(pos);

        // Sjekk Fine
        if (nav.fine && seekingFine) {
            break;
        }

        // Sjekk To Coda (etter D.S./D.C.-hopp)
        if (nav.toCoda && seekingCoda) {
            if (codaPos >= 0) {
                pos = codaPos;
                seekingCoda = false;
                continue;
            }
        }

        // Sjekk D.S.-hopp
        if (nav.dsType && !jumped) {
            jumped = true;
            if (nav.dsType === 'ds-al-fine') {
                seekingFine = true;
            } else if (nav.dsType === 'ds-al-coda') {
                seekingCoda = true;
            }
            if (segnoPos >= 0) {
                pos = segnoPos;
            } else {
                pos = 0; // Fallback: hopp til start
            }
            continue;
        }

        // Sjekk D.C.-hopp
        if (nav.dcType && !jumped) {
            jumped = true;
            if (nav.dcType === 'dc-al-fine') {
                seekingFine = true;
            } else if (nav.dcType === 'dc-al-coda') {
                seekingCoda = true;
            }
            pos = 0;
            continue;
        }

        // Sjekk backward repeat
        if (nav.backwardRepeat) {
            const repeatStart = findRepeatStart(navs, pos);
            const currentCount = repeatCounts.get(repeatStart) || 1;

            if (currentCount < nav.backwardRepeatTimes) {
                repeatCounts.set(repeatStart, currentCount + 1);
                pos = repeatStart;
                continue;
            }
            // Ferdig med repetisjonen, gå videre
            repeatCounts.set(repeatStart, 1); // Reset for evt. D.S./D.C.
        }

        pos++;
    }

    if (iteration >= maxIterations) {
        throw new Error('Uendelig løkke oppdaget i repetisjonsstrukturen. Maks iterasjoner nådd.');
    }

    return order;
}

/**
 * Finner starten av repetisjonsblokken for en gitt posisjon.
 * Søker bakover etter nærmeste forward-repeat barline.
 */
function findRepeatStart(navs, backwardPos) {
    for (let i = backwardPos; i >= 0; i--) {
        if (navs[i].forwardRepeat) return i;
    }
    return 0; // Implicit repeat fra starten
}

/**
 * Hopper over takter til slutten av et volta-ending.
 * Returnerer posisjonen etter endingen.
 */
function skipToEndingEnd(navs, startPos) {
    for (let i = startPos + 1; i < navs.length; i++) {
        // Sjekk for ny ending-start først (ending 2 starter → returner hit)
        const nextStart = navs[i].endings.find(e => e.type === 'start');
        if (nextStart) return i;

        // Sjekk for stop/discontinue av nåværende ending
        const stopEnding = navs[i].endings.find(e => e.type === 'stop' || e.type === 'discontinue');
        if (stopEnding) return i + 1;
    }
    return startPos + 1;
}

// ==========================================================================
// MEASURE CLONING AND CLEANUP
// ==========================================================================

/**
 * Fjerner navigasjonsmarkeringer fra en klonet takt.
 */
function cleanMeasure(measure) {
    // Fjern repeat barlines, men behold vanlige barlines
    const barlines = [...measure.getElementsByTagName('barline')];
    for (const barline of barlines) {
        const repeat = barline.getElementsByTagName('repeat')[0];
        const ending = barline.getElementsByTagName('ending')[0];
        if (repeat) repeat.remove();
        if (ending) ending.remove();

        // Fjern barline hvis den er tom (kun hadde repeat/ending)
        if (barline.children.length === 0) {
            barline.remove();
        }
    }

    // Fjern D.S., D.C., Segno, Coda, Fine, To Coda direction-elementer
    const directions = [...measure.getElementsByTagName('direction')];
    for (const direction of directions) {
        let shouldRemove = false;

        for (const sound of direction.getElementsByTagName('sound')) {
            if (sound.hasAttribute('segno') || sound.hasAttribute('coda') ||
                sound.hasAttribute('fine') || sound.hasAttribute('tocoda') ||
                sound.hasAttribute('dacapo') || sound.hasAttribute('dalsegno')) {
                shouldRemove = true;
            }
        }

        for (const dirType of direction.getElementsByTagName('direction-type')) {
            if (dirType.getElementsByTagName('segno').length > 0 ||
                dirType.getElementsByTagName('coda').length > 0) {
                shouldRemove = true;
            }

            for (const words of dirType.getElementsByTagName('words')) {
                const text = (words.textContent || '').toLowerCase();
                if (/\b(fine|d\.?\s*s\.?|d\.?\s*c\.?|dal\s*segno|da\s*capo|to\s*coda|al\s*coda|al\s*fine)\b/.test(text)) {
                    shouldRemove = true;
                }
            }
        }

        if (shouldRemove) {
            direction.remove();
        }
    }
}

// ==========================================================================
// MAIN EXPANSION FUNCTION
// ==========================================================================

/**
 * Ekspanderer repetisjoner i en MusicXML-fil.
 *
 * @param {string} xmlString - MusicXML-filinnhold som streng
 * @returns {{ xml: string, originalMeasures: number, expandedMeasures: number }}
 */
export function expandRepeats(xmlString) {
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

    const parts = root.getElementsByTagName('part');
    if (parts.length === 0) {
        throw new Error('Ingen parter funnet i filen.');
    }

    // Bruk første part for å beregne avspillingsrekkefølge
    const firstPart = parts[0];
    const firstPartMeasures = [...firstPart.getElementsByTagName('measure')];
    const originalCount = firstPartMeasures.length;

    if (originalCount === 0) {
        throw new Error('Ingen takter funnet i filen.');
    }

    // Parse navigasjon fra første part
    const navs = firstPartMeasures.map(m => parseMeasureNavigation(m));

    // Beregn avspillingsrekkefølge
    const playbackOrder = computePlaybackOrder(navs);
    const expandedCount = playbackOrder.length;

    // Ekspander alle parter
    for (const part of parts) {
        const measures = [...part.getElementsByTagName('measure')];

        // Klon takter i avspillingsrekkefølge
        const newMeasures = playbackOrder.map((idx, newIdx) => {
            const clone = measures[idx].cloneNode(true);
            clone.setAttribute('number', String(newIdx + 1));
            cleanMeasure(clone);
            return clone;
        });

        // Fjern alle eksisterende takter
        for (const m of measures) {
            m.remove();
        }

        // Legg til de nye taktene
        for (const m of newMeasures) {
            part.appendChild(m);
        }
    }

    const serializer = new XMLSerializer();
    let xml = serializer.serializeToString(doc);

    if (!xml.startsWith('<?xml')) {
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
    }

    return { xml, originalMeasures: originalCount, expandedMeasures: expandedCount };
}
