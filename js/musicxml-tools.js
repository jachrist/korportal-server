/**
 * MusicXML Tools - Admin UI Integration
 * Håndterer filopplasting, prosessering og nedlasting for
 * fonetisk konvertering og repetisjonsekspandering.
 *
 * @module MusicXMLTools
 */

import { convertPhonetic } from './musicxml-phonetic.js';
import { expandRepeats } from './musicxml-repeats.js';

const ACCEPTED_EXTENSIONS = ['.xml', '.musicxml'];

// ==========================================================================
// TOOL INSTANCE
// ==========================================================================

class MusicXMLTool {
    constructor(sectionId, processFunction, filenameSuffix) {
        this.section = document.getElementById(sectionId);
        if (!this.section) return;

        this.processFunction = processFunction;
        this.filenameSuffix = filenameSuffix;
        this.file = null;
        this.resultXml = null;
        this.resultFilename = null;

        this.dropzone = this.section.querySelector('.mxml-dropzone');
        this.fileInput = this.section.querySelector('input[type="file"]');
        this.fileInfo = this.section.querySelector('.mxml-file-info');
        this.fileName = this.section.querySelector('.mxml-file-name');
        this.fileRemove = this.section.querySelector('.mxml-file-remove');
        this.processBtn = this.section.querySelector('.mxml-btn--primary');
        this.downloadBtn = this.section.querySelector('.mxml-btn--download');
        this.resultDiv = this.section.querySelector('.mxml-result');
        this.optionsSelect = this.section.querySelector('select');

        this.bindEvents();
    }

    bindEvents() {
        if (!this.section) return;

        // File input change
        this.fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.setFile(e.target.files[0]);
            }
        });

        // Drag and drop
        this.dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropzone.classList.add('drag-over');
        });

        this.dropzone?.addEventListener('dragleave', () => {
            this.dropzone.classList.remove('drag-over');
        });

        this.dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropzone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.setFile(e.dataTransfer.files[0]);
            }
        });

        // Remove file
        this.fileRemove?.addEventListener('click', () => {
            this.clearFile();
        });

        // Process
        this.processBtn?.addEventListener('click', () => {
            this.process();
        });

        // Download
        this.downloadBtn?.addEventListener('click', () => {
            this.download();
        });
    }

    setFile(file) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
            this.showResult('Ugyldig filtype. Velg en .xml eller .musicxml fil.', 'error');
            return;
        }

        this.file = file;
        this.resultXml = null;
        this.resultFilename = null;

        if (this.fileName) this.fileName.textContent = file.name;
        if (this.fileInfo) this.fileInfo.hidden = false;
        if (this.processBtn) this.processBtn.disabled = false;
        if (this.downloadBtn) this.downloadBtn.disabled = true;
        this.hideResult();
    }

    clearFile() {
        this.file = null;
        this.resultXml = null;
        this.resultFilename = null;

        if (this.fileInput) this.fileInput.value = '';
        if (this.fileInfo) this.fileInfo.hidden = true;
        if (this.processBtn) this.processBtn.disabled = true;
        if (this.downloadBtn) this.downloadBtn.disabled = true;
        this.hideResult();
    }

    async process() {
        if (!this.file) return;

        this.processBtn.classList.add('processing');
        this.processBtn.disabled = true;
        this.hideResult();

        try {
            const xmlString = await this.file.text();
            const result = this.processFunction(xmlString, this);

            // Generer filnavn
            const baseName = this.file.name.replace(/\.(xml|musicxml)$/i, '');
            this.resultFilename = `${baseName}${this.filenameSuffix}.musicxml`;
            this.resultXml = result.xml;

            this.showResult(result.message, 'success');
            if (this.downloadBtn) this.downloadBtn.disabled = false;

        } catch (error) {
            this.showResult(error.message, 'error');
        } finally {
            this.processBtn.classList.remove('processing');
            this.processBtn.disabled = false;
        }
    }

    download() {
        if (!this.resultXml || !this.resultFilename) return;

        const blob = new Blob([this.resultXml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.resultFilename;
        a.click();
        URL.revokeObjectURL(url);
    }

    showResult(message, type) {
        if (!this.resultDiv) return;
        this.resultDiv.hidden = false;
        this.resultDiv.className = `mxml-result mxml-result--${type}`;
        this.resultDiv.textContent = message;
    }

    hideResult() {
        if (this.resultDiv) this.resultDiv.hidden = true;
    }
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

/**
 * Initialiserer MusicXML-verktøyene på admin-siden.
 * Kalles fra admin.js.
 */
export function initMusicXMLTools() {
    // Fonetisk konvertering
    new MusicXMLTool(
        'phonetic-tool',
        (xmlString, tool) => {
            const dialect = tool.optionsSelect?.value || 'bokmaal';
            const result = convertPhonetic(xmlString, dialect);
            return {
                xml: result.xml,
                message: `Konvertering fullført! ${result.convertedCount} tekstelement${result.convertedCount !== 1 ? 'er' : ''} ble konvertert.`
            };
        },
        '_fonetisk'
    );

    // Repetisjonsekspandering
    new MusicXMLTool(
        'repeats-tool',
        (xmlString) => {
            const result = expandRepeats(xmlString);
            return {
                xml: result.xml,
                message: `Ekspandering fullført! ${result.originalMeasures} takter ble ekspandert til ${result.expandedMeasures} takter.`
            };
        },
        '_ekspandert'
    );
}
