/**
 * Nedlasting - JavaScript
 *
 * Viser noter og øvefiler for det aktive programmet (aktiv hendelse / anledning),
 * gruppert per verk i satt rekkefølge. For hvert verk: nedlastingslenke for noten
 * (PDF) og øvefil (MP3) for valgt stemme. «Last ned alt» pakker alt i én zip.
 *
 * Tilgang: medlem og oppover (gjest/anonym omdirigeres av initPage).
 *
 * @module Nedlasting
 * @version 3.0.0
 */

import { initPage, getCurrentMember } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';

// ==========================================================================
// CONFIGURATION
// ==========================================================================

// Mock-modus for lokal testing (samme kilde som øvesiden)
const useMock = () => !window.ENV?.POWER_AUTOMATE_PRACTICE_URL;

const VOICE_LABELS = {
    'sopran 1': 'Sopran 1', 'sopran 2': 'Sopran 2',
    'alt 1': 'Alt 1', 'alt 2': 'Alt 2',
    'tenor 1': 'Tenor 1', 'tenor 2': 'Tenor 2',
    'bass 1': 'Bass 1', 'bass 2': 'Bass 2',
    'tutti': 'Tutti'
};

// --- Mock-data (kun i lokal utvikling uten API) ---
const MOCK_ANLEDNINGER = ['Under samme himmel', 'Julekonsert 2026'];
const MOCK_ACTIVE = 'Under samme himmel';
const MOCK_BASE = { pdf: 'https://utsiktenblob.blob.core.windows.net/sanger/', audio: 'https://utsiktenblob.blob.core.windows.net/sanger/' };
const MOCK_PRACTICE = {
    'Under samme himmel': {
        title: 'Under samme himmel', voice: 'tutti', baseUrls: MOCK_BASE,
        notes: [
            { noteTitle: 'Stein på stein', pdfFilename: 'Stein paa stein Utsikten.pdf', sortOrder: 1,
              audio: { 'sopran 1': 'Stein-sopr1.mp3', 'alt 1': 'Stein-alt1.mp3', 'tenor 1': 'Stein-ten1.mp3', 'bass 1': 'Stein-bass1.mp3', 'tutti': 'Stein-tutti.mp3' } },
            { noteTitle: 'Når himmelen faller ned', pdfFilename: 'Nar-himmelen-faller-ned-Utsikten.pdf', sortOrder: 2,
              audio: { 'sopran': 'Nar-himmelen-sopr.mp3', 'alt': 'Nar-himmelen-alt.mp3', 'tenor': 'Nar-himmelen-tenor.mp3', 'bass': 'Nar-himmelen-bass.mp3', 'tutti': 'Nar-himmelen-tutti.mp3' } },
            { noteTitle: 'Lift me up', pdfFilename: 'Lift Me Up EPRINT-Choral.pdf', sortOrder: 3,
              audio: { 'sopran 1': 'Lift me up - Sopran 1.mp3', 'alt 1': 'Lift me up - Alt 1.mp3', 'tenor 1': 'Lift me up - Tenor.mp3', 'bass 1': 'Lift me up - Bass.mp3', 'tutti': 'Lift me up - Tutti.mp3' } },
            { noteTitle: 'A Light of Hope', pdfFilename: 'A Light of Hope.pdf', sortOrder: 4,
              audio: { 'sopran 1': 'A-Light-sopr1.mp3', 'alt 1': 'A-Light-alt1.mp3', 'bass 1': 'A-Light-bass1.mp3', 'tutti': 'A-Light-tutti.mp3' } },
            { noteTitle: 'Fordi eg elskar deg', pdfFilename: 'Fordi eg elskar deg.pdf', sortOrder: 5,
              audio: { 'sopran': 'Fordi-sopr.mp3', 'alt': 'Fordi-alt.mp3', 'tenor': 'Fordi-tenor.mp3', 'bass': 'Fordi-bass.mp3', 'tutti': 'Fordi-tutti.mp3' } }
        ]
    },
    'Julekonsert 2026': {
        title: 'Julekonsert 2026', voice: 'tutti', baseUrls: MOCK_BASE,
        notes: [
            { noteTitle: 'O Helga Natt', pdfFilename: 'O Helga Natt - Arr.pdf', sortOrder: 1,
              audio: { 'sopran 1': 'O-Helga-sopr1.mp3', 'alt 1': 'O-Helga-alt1.mp3', 'tenor 1': 'O-Helga-ten1.mp3', 'bass 1': 'O-Helga-bass1.mp3', 'tutti': 'O-Helga-tutti.mp3' } },
            { noteTitle: 'Deilig er jorden', pdfFilename: 'Deilig er jorden - SATB.pdf', sortOrder: 2,
              audio: { 'sopran': 'Deilig-sopr.mp3', 'alt': 'Deilig-alt.mp3', 'tenor': 'Deilig-tenor.mp3', 'bass': 'Deilig-bass.mp3', 'tutti': 'Deilig-tutti.mp3' } }
        ]
    }
};

// ==========================================================================
// HELPERS
// ==========================================================================

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Filnavn-trygg tekst til zip-oppføringer
function safeName(str) {
    return String(str ?? '').replace(/[\\/:*?"<>|]+/g, '_').trim();
}

/**
 * Finn øvefil for valgt stemme, med fallback til delt basestemme (som øvesiden):
 * "tenor 1" → "tenor" hvis den nummererte ikke finnes.
 */
function resolveVoiceFile(audio, voice) {
    if (!voice || !audio) return null;
    if (audio[voice]) return audio[voice];
    const base = voice.replace(/\s*\d+$/, '').trim(); // "tenor 1" → "tenor"
    if (base && base !== voice && audio[base]) return audio[base];
    return null;
}

// ==========================================================================
// DOWNLOADS APP
// ==========================================================================
class DownloadsApp {
    constructor() {
        this.data = null;
        this.notes = [];
        this.selectedAnledning = '';
        this.currentVoice = '';
        this.elements = {};
    }

    async init() {
        // Krev innlogging + rolle medlem eller høyere (gjest/anonym omdirigeres)
        const pageInit = initPage({ requireAuth: true, requiredRole: 'medlem' });
        if (!pageInit) return;

        this.cacheElements();
        this.bindEvents();

        // Default stemme fra medlemmet
        this.currentVoice = this.getMemberVoice() || '';
        if (this.elements.voiceSelect && this.currentVoice) {
            this.elements.voiceSelect.value = this.currentVoice;
        }

        await this.loadAnledninger();
        await this.loadData();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            verkList: document.getElementById('verkList'),
            anledningSelect: document.getElementById('anledningSelect'),
            voiceSelect: document.getElementById('voiceSelect'),
            downloadAllBtn: document.getElementById('downloadAll'),
            emptyState: document.getElementById('emptyState'),
            emptyText: document.getElementById('emptyText')
        };
    }

    bindEvents() {
        this.elements.anledningSelect?.addEventListener('change', (e) => {
            this.selectedAnledning = e.target.value;
            this.loadData();
        });
        this.elements.voiceSelect?.addEventListener('change', (e) => {
            this.currentVoice = e.target.value;
            if (this.currentVoice) localStorage.setItem('korportal-voice', this.currentVoice);
            this.render();
        });
        this.elements.downloadAllBtn?.addEventListener('click', () => this.downloadAll());
    }

    getMemberVoice() {
        const member = getCurrentMember();
        let voice = (member?.voice || member?.stemme || localStorage.getItem('korportal-voice') || '').toLowerCase();
        return voice ? voice.replace(/-/g, ' ') : '';
    }

    // ----------------------------------------------------------------------
    // Aktiviteter (anledninger) + aktiv hendelse
    // ----------------------------------------------------------------------
    async loadAnledninger() {
        const select = this.elements.anledningSelect;
        if (!select) return;

        if (useMock()) {
            this.populateAnledninger(MOCK_ANLEDNINGER, MOCK_ACTIVE);
            this.selectedAnledning = select.value || MOCK_ACTIVE;
            return;
        }

        try {
            const [anRes, metaRes] = await Promise.all([
                fetch('/api/filer/anledninger').then(r => r.json()),
                fetch('/api/ovelse/meta').then(r => r.json())
            ]);
            const anledninger = (anRes.body || anRes).anledninger || [];
            const meta = metaRes.body || metaRes;
            const active = meta.anledning || '';
            this.populateAnledninger(anledninger, active);
            this.selectedAnledning = select.value || active;
        } catch (err) {
            console.error('Kunne ikke laste anledninger:', err);
            select.innerHTML = '<option value="">Kunne ikke laste</option>';
        }
    }

    populateAnledninger(anledninger, active) {
        const select = this.elements.anledningSelect;
        select.innerHTML = '';
        if (!anledninger.length) {
            select.innerHTML = '<option value="">Ingen aktiviteter</option>';
            return;
        }
        for (const a of anledninger) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            if (a === active) opt.selected = true;
            select.appendChild(opt);
        }
    }

    // ----------------------------------------------------------------------
    // Data
    // ----------------------------------------------------------------------
    async loadData() {
        this.showLoader();
        try {
            if (useMock()) {
                this.data = MOCK_PRACTICE[this.selectedAnledning] || { notes: [], baseUrls: {} };
            } else {
                this.data = await sharePointAPI.getPracticeData(this.selectedAnledning) || { notes: [], baseUrls: {} };
            }
            this.notes = this.data.notes || [];
            this.render();
        } catch (err) {
            console.error('Kunne ikke laste program:', err);
            this.notes = [];
            this.render();
        } finally {
            this.hideLoader();
        }
    }

    // ----------------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------------
    render() {
        const list = this.elements.verkList;
        if (!list) return;

        if (!this.notes.length) {
            list.innerHTML = '';
            this.showEmpty('Ingen verk for denne aktiviteten enda.');
            return;
        }
        this.hideEmpty();

        const voice = this.currentVoice;
        const base = this.data?.baseUrls || {};

        list.innerHTML = this.notes.map((note, i) => {
            const num = i + 1;
            const noteLink = this.renderNoteLink(note, base);
            const ovefilLink = this.renderOvefilLink(note, base, voice);
            return `
                <section class="dl-verk">
                    <h2 class="dl-verk__title"><span class="dl-verk__num">${num}</span> ${esc(note.noteTitle)}</h2>
                    <div class="dl-links">
                        ${noteLink}
                        ${ovefilLink}
                    </div>
                </section>`;
        }).join('');
    }

    renderNoteLink(note, base) {
        if (note.pdfFilename && base.pdf) {
            const url = base.pdf + encodeURIComponent(note.pdfFilename);
            return `<a class="dl-link" href="${esc(url)}" target="_blank" rel="noopener">
                <span class="dl-link__icon">📄</span>
                <span class="dl-link__label">Note (pdf)</span>
                <span class="dl-link__meta">pdf</span></a>`;
        }
        return `<span class="dl-link dl-link--muted">
            <span class="dl-link__icon">📄</span>
            <span class="dl-link__label">Note (pdf) – ikke tilgjengelig enda</span></span>`;
    }

    renderOvefilLink(note, base, voice) {
        if (!voice) {
            return `<span class="dl-link dl-link--muted">
                <span class="dl-link__icon">🎧</span>
                <span class="dl-link__label">Øvefil – velg stemme over</span></span>`;
        }
        const file = resolveVoiceFile(note.audio, voice);
        if (file && base.audio) {
            const url = base.audio + encodeURIComponent(file);
            return `<a class="dl-link" href="${esc(url)}" target="_blank" rel="noopener">
                <span class="dl-link__icon">🎧</span>
                <span class="dl-link__label">Øvefil – ${esc(VOICE_LABELS[voice] || voice)}</span>
                <span class="dl-link__meta">mp3</span></a>`;
        }
        return `<span class="dl-link dl-link--muted">
            <span class="dl-link__icon">🎧</span>
            <span class="dl-link__label">Øvefil – ikke tilgjengelig enda</span></span>`;
    }

    showEmpty(text) {
        if (this.elements.emptyText) this.elements.emptyText.textContent = text;
        if (this.elements.emptyState) this.elements.emptyState.hidden = false;
    }
    hideEmpty() {
        if (this.elements.emptyState) this.elements.emptyState.hidden = true;
    }

    // ----------------------------------------------------------------------
    // Last ned alt (zip) — noter + øvefiler for valgt stemme
    // ----------------------------------------------------------------------
    async ensureJSZip() {
        if (window.JSZip) return window.JSZip;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'js/vendor/jszip.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Kunne ikke laste JSZip'));
            document.head.appendChild(s);
        });
        return window.JSZip;
    }

    async downloadAll() {
        if (useMock()) {
            alert('Testmodus: «Last ned alt» lager en zip med de faktiske filene når siden kjører mot API-et.');
            return;
        }
        if (!this.notes.length) {
            alert('Ingenting å laste ned for denne aktiviteten.');
            return;
        }

        const voice = this.currentVoice;
        const base = this.data?.baseUrls || {};
        const btn = this.elements.downloadAllBtn;
        const original = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Pakker …'; }
        this.showLoader();

        const failed = [];
        try {
            const JSZip = await this.ensureJSZip();
            const zip = new JSZip();

            for (const [i, note] of this.notes.entries()) {
                const num = i + 1;
                const label = safeName(note.noteTitle) || `verk-${num}`;

                // Note (PDF)
                if (note.pdfFilename && base.pdf) {
                    try {
                        const blob = await this.fetchBlob(base.pdf + encodeURIComponent(note.pdfFilename));
                        zip.file(`${num} ${label} - Note.pdf`, blob);
                    } catch { failed.push(`${note.noteTitle} (note)`); }
                }

                // Øvefil for valgt stemme
                const file = voice ? resolveVoiceFile(note.audio, voice) : null;
                if (file && base.audio) {
                    try {
                        const blob = await this.fetchBlob(base.audio + encodeURIComponent(file));
                        const ext = (file.split('.').pop() || 'mp3').toLowerCase();
                        zip.file(`${num} ${label} - ${VOICE_LABELS[voice] || voice}.${ext}`, blob);
                    } catch { failed.push(`${note.noteTitle} (øvefil)`); }
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const anledning = safeName(this.selectedAnledning) || 'Nedlasting';
            const suffix = voice ? ` - ${VOICE_LABELS[voice] || voice}` : '';
            this.triggerDownload(content, `${anledning}${suffix}.zip`);
        } catch (err) {
            console.error('Zip-feil:', err);
            alert('Kunne ikke lage zip-fil: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = original; }
            this.hideLoader();
            if (failed.length) {
                alert('Noen filer kunne ikke hentes og ble hoppet over:\n\n' + failed.join('\n'));
            }
        }
    }

    async fetchBlob(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.blob();
    }

    triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    showLoader() { this.elements.loader?.classList.add('active'); }
    hideLoader() { this.elements.loader?.classList.remove('active'); }
}

// ==========================================================================
// INIT
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    new DownloadsApp().init();
});
