/**
 * Styrerom – Dokumentarkiv
 *
 * Styre-only side for å opprette, søke, vise, redigere og arkivere dokumenter.
 * Markdown-dokumenter redigeres i portalen; Office/PDF lastes opp og tagges.
 * «Generer PDF» lager en PDF i nettleseren og arkiverer den som et vanlig dokument.
 *
 * @module Styredokumenter
 */

import { initPage, getCurrentMember } from './navigation.js';
import { parseMarkdown } from './parse-markdown.js';
import { MarkdownEditor } from './markdown-editor.js';

// --- API-oppsett (utleder base fra Files-URL, som filbehandling) ---
const API_BASE = (() => {
    const url = window.ENV?.POWER_AUTOMATE_FILES_URL || '';
    return url.replace(/\/filer\/?$/, '');
})();
const useMock = () => !window.ENV?.POWER_AUTOMATE_FILES_URL;
const DOK = '/styre/dokumenter';

async function apiReq(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
    const data = await res.json();
    return data.body || data;
}
const apiGet = (p) => apiReq('GET', p);
const apiPost = (p, b) => apiReq('POST', p, b);
const apiPatch = (p, b) => apiReq('PATCH', p, b);
const apiDelete = (p) => apiReq('DELETE', p);

const TYPE_LABELS = { referat: 'Referat', protokoll: 'Protokoll', budsjett: 'Budsjett', søknad: 'Søknad', avtale: 'Avtale', annet: 'Annet' };
const FORMAT_ICON = { markdown: '📝', pdf: '📄', office: '📎' };

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

// --- Mock-lag (lokal utvikling uten API) ---
let MOCK = [
    { id: 'SDOK-1', tittel: 'Referat styremøte august', dokumenttype: 'referat', anledning: 'Styremøte 2026-08', dato: '2026-08-20', forfatter: 'Jan Christiansen', status: 'ferdig', format: 'markdown', url: '', uploaded: false, updatedAt: '2026-08-20T10:00:00Z', contentMd: '# Referat styremøte august\n\n**Til stede:** hele styret.\n\n## Saker\n1. Høstprogram\n2. Budsjett\n\n- [ ] Bestille lokale\n- [x] Sende ut varsel' },
    { id: 'SDOK-2', tittel: 'Budsjett 2026.xlsx', dokumenttype: 'budsjett', anledning: 'Årsmøte 2026', dato: '2026-02-01', forfatter: 'Kasserer', status: 'ferdig', format: 'office', url: '#', uploaded: true, updatedAt: '2026-02-01T09:00:00Z' },
];
async function mock(method, path, body) {
    const idMatch = path.match(/\/([^/]+)$/);
    if (method === 'GET' && path === DOK) return { dokumenter: MOCK.map(({ contentMd, ...d }) => d) };
    if (method === 'GET') { const d = MOCK.find(x => x.id === idMatch[1]); return { dokument: d }; }
    if (method === 'POST' && path.endsWith('/opplasting')) { const d = { id: 'SDOK-' + Date.now(), uploaded: true, format: (body.navn || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'office', url: '#', updatedAt: new Date().toISOString(), ...body, tittel: body.tittel || body.navn }; MOCK.unshift(d); return { id: d.id, dokument: d }; }
    if (method === 'POST') { const d = { id: 'SDOK-' + Date.now(), format: 'markdown', uploaded: false, url: '', updatedAt: new Date().toISOString(), ...body }; MOCK.unshift(d); return { id: d.id, dokument: d }; }
    if (method === 'PATCH') { const d = MOCK.find(x => x.id === idMatch[1]); Object.assign(d, body, { updatedAt: new Date().toISOString() }); return { message: 'ok' }; }
    if (method === 'DELETE') { MOCK = MOCK.filter(x => x.id !== idMatch[1]); return { message: 'ok' }; }
}
const get = (p) => useMock() ? mock('GET', p) : apiGet(p);
const post = (p, b) => useMock() ? mock('POST', p, b) : apiPost(p, b);
const patch = (p, b) => useMock() ? mock('PATCH', p, b) : apiPatch(p, b);
const del = (p) => useMock() ? mock('DELETE', p) : apiDelete(p);

// ==========================================================================
class StyreDocsApp {
    constructor() {
        this.docs = [];
        this.editingId = null;
        this.editor = null;
        this.el = {};
    }

    async init() {
        if (!initPage({ requireAuth: true, requiredRole: 'styre' })) return;
        this.cache();
        this.bind();
        this.editor = new MarkdownEditor(this.el.docContent).init();
        await this.load();
    }

    cache() {
        const id = (x) => document.getElementById(x);
        this.el = {
            loader: id('loader'), docList: id('docList'), empty: id('emptyState'), emptyText: id('emptyText'),
            search: id('searchInput'), filterType: id('filterType'), filterAnledning: id('filterAnledning'),
            anledningList: id('anledningList'),
            newDocBtn: id('newDocBtn'), uploadBtn: id('uploadBtn'),
            editorModal: id('editorModal'), editorTitle: id('editorTitle'), editorClose: id('editorClose'),
            editorCancel: id('editorCancel'), editorSave: id('editorSave'), genPdfBtn: id('genPdfBtn'),
            docTitle: id('docTitle'), docType: id('docType'), docAnledning: id('docAnledning'),
            docDato: id('docDato'), docForfatter: id('docForfatter'), docStatus: id('docStatus'), docContent: id('docContent'),
            viewerModal: id('viewerModal'), viewerTitle: id('viewerTitle'), viewerClose: id('viewerClose'), viewerBody: id('viewerBody'),
            uploadModal: id('uploadModal'), uploadClose: id('uploadClose'), uploadCancel: id('uploadCancel'), uploadSubmit: id('uploadSubmit'),
            uploadFile: id('uploadFile'), uploadTitle: id('uploadTitle'), uploadType: id('uploadType'), uploadAnledning: id('uploadAnledning'), uploadDato: id('uploadDato'),
        };
    }

    bind() {
        this.el.search.addEventListener('input', () => this.render());
        this.el.filterType.addEventListener('change', () => this.render());
        this.el.filterAnledning.addEventListener('change', () => this.render());
        this.el.newDocBtn.addEventListener('click', () => this.openEditor());
        this.el.uploadBtn.addEventListener('click', () => this.openUpload());
        this.el.editorClose.addEventListener('click', () => this.hide('editorModal'));
        this.el.editorCancel.addEventListener('click', () => this.hide('editorModal'));
        this.el.editorSave.addEventListener('click', () => this.save());
        this.el.genPdfBtn.addEventListener('click', () => this.generatePdf());
        this.el.viewerClose.addEventListener('click', () => this.hide('viewerModal'));
        this.el.uploadClose.addEventListener('click', () => this.hide('uploadModal'));
        this.el.uploadCancel.addEventListener('click', () => this.hide('uploadModal'));
        this.el.uploadSubmit.addEventListener('click', () => this.upload());
        this.el.docList.addEventListener('click', (e) => this.onListClick(e));
    }

    async load() {
        this.showLoader();
        try {
            const res = await get(DOK);
            this.docs = res.dokumenter || [];
            this.populateAnledninger();
            this.render();
        } catch (err) {
            console.error('Kunne ikke laste dokumenter:', err);
            this.docs = [];
            this.render();
        } finally { this.hideLoader(); }
    }

    populateAnledninger() {
        const set = [...new Set(this.docs.map(d => d.anledning).filter(Boolean))].sort();
        this.el.filterAnledning.innerHTML = '<option value="">Alle møter/anledninger</option>' +
            set.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
        this.el.anledningList.innerHTML = set.map(a => `<option value="${esc(a)}">`).join('');
    }

    render() {
        const q = this.el.search.value.trim().toLowerCase();
        const type = this.el.filterType.value;
        const anl = this.el.filterAnledning.value;
        let list = this.docs.slice();
        if (type) list = list.filter(d => d.dokumenttype === type);
        if (anl) list = list.filter(d => d.anledning === anl);
        if (q) list = list.filter(d => [d.tittel, d.dokumenttype, d.anledning, d.forfatter].some(v => (v || '').toLowerCase().includes(q)));

        if (!list.length) { this.el.docList.innerHTML = ''; this.el.empty.hidden = false; this.el.emptyText.textContent = this.docs.length ? 'Ingen treff.' : 'Ingen dokumenter enda.'; return; }
        this.el.empty.hidden = true;

        this.el.docList.innerHTML = list.map(d => {
            const canEdit = d.format === 'markdown';
            const dl = d.uploaded && d.url && d.url !== '#' ? `<a class="sd-doc__btn" href="${esc(d.url)}" target="_blank" rel="noopener" title="Last ned">⬇</a>` : '';
            return `<article class="sd-doc" data-id="${esc(d.id)}">
                <div class="sd-doc__main" data-action="view">
                    <span class="sd-doc__icon">${FORMAT_ICON[d.format] || '📁'}</span>
                    <div class="sd-doc__info">
                        <div class="sd-doc__title">${esc(d.tittel)}</div>
                        <div class="sd-doc__meta">
                            <span class="sd-tag">${esc(TYPE_LABELS[d.dokumenttype] || d.dokumenttype)}</span>
                            ${d.anledning ? `<span>${esc(d.anledning)}</span>` : ''}
                            ${d.dato ? `<span>${esc(d.dato)}</span>` : ''}
                            <span class="sd-status sd-status--${esc(d.status)}">${esc(d.status)}</span>
                        </div>
                    </div>
                </div>
                <div class="sd-doc__actions">
                    ${dl}
                    ${canEdit ? `<button class="sd-doc__btn" data-action="edit" title="Rediger">✏️</button>` : ''}
                    <button class="sd-doc__btn sd-doc__btn--danger" data-action="delete" title="Slett">🗑</button>
                </div>
            </article>`;
        }).join('');
    }

    onListClick(e) {
        const art = e.target.closest('.sd-doc');
        if (!art) return;
        const id = art.dataset.id;
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'edit') this.openEditor(id);
        else if (action === 'delete') this.remove(id);
        else if (action === 'view' || !action) this.view(id);
    }

    // --- Editor ---
    async openEditor(id = null) {
        this.editingId = id;
        this.el.editorTitle.textContent = id ? 'Rediger dokument' : 'Nytt dokument';
        if (id) {
            const { dokument: d } = await get(`${DOK}/${id}`);
            this.el.docTitle.value = d.tittel || '';
            this.el.docType.value = d.dokumenttype || 'annet';
            this.el.docAnledning.value = d.anledning || '';
            this.el.docDato.value = d.dato || '';
            this.el.docForfatter.value = d.forfatter || '';
            this.el.docStatus.value = d.status || 'utkast';
            this.editor.setValue(d.contentMd || '');
        } else {
            this.el.docTitle.value = '';
            this.el.docType.value = 'annet';
            this.el.docAnledning.value = '';
            this.el.docDato.value = todayISO();
            this.el.docForfatter.value = getCurrentMember()?.name || '';
            this.el.docStatus.value = 'utkast';
            this.editor.setValue('');
        }
        this.show('editorModal');
    }

    collectMeta() {
        return {
            tittel: this.el.docTitle.value.trim(),
            dokumenttype: this.el.docType.value,
            anledning: this.el.docAnledning.value.trim(),
            dato: this.el.docDato.value,
            forfatter: this.el.docForfatter.value.trim(),
            status: this.el.docStatus.value,
            contentMd: this.editor.getValue(),
        };
    }

    async save() {
        const meta = this.collectMeta();
        if (!meta.tittel) return alert('Tittel er påkrevd.');
        this.showLoader();
        try {
            if (this.editingId) await patch(`${DOK}/${this.editingId}`, meta);
            else await post(DOK, meta);
            this.hide('editorModal');
            await this.load();
        } catch (err) { console.error(err); alert('Kunne ikke lagre dokument.'); }
        finally { this.hideLoader(); }
    }

    async remove(id) {
        const d = this.docs.find(x => x.id === id);
        if (!confirm(`Slette «${d?.tittel || 'dokument'}»?`)) return;
        this.showLoader();
        try { await del(`${DOK}/${id}`); await this.load(); }
        catch (err) { console.error(err); alert('Kunne ikke slette.'); }
        finally { this.hideLoader(); }
    }

    // --- Viewer ---
    async view(id) {
        const { dokument: d } = await get(`${DOK}/${id}`);
        this.el.viewerTitle.textContent = d.tittel || 'Dokument';
        if (d.format === 'markdown') {
            this.el.viewerBody.innerHTML = `<div class="sd-rendered">${parseMarkdown(d.contentMd || '')}</div>`;
        } else if (d.format === 'pdf' && d.url && d.url !== '#') {
            this.el.viewerBody.innerHTML = `<iframe class="sd-pdfframe" src="${esc(d.url)}"></iframe>
                <p><a class="sd-btn sd-btn--secondary" href="${esc(d.url)}" target="_blank" rel="noopener">Åpne i ny fane</a></p>`;
        } else {
            this.el.viewerBody.innerHTML = `<p>Denne filtypen vises ikke i portalen.</p>
                ${d.url && d.url !== '#' ? `<p><a class="sd-btn sd-btn--primary" href="${esc(d.url)}" target="_blank" rel="noopener">⬇ Last ned ${esc(d.navn || 'fil')}</a></p>` : '<p>(mock: ingen fil)</p>'}`;
        }
        this.show('viewerModal');
    }

    // --- Opplasting ---
    openUpload() {
        this.el.uploadFile.value = '';
        this.el.uploadTitle.value = '';
        this.el.uploadType.value = 'annet';
        this.el.uploadAnledning.value = '';
        this.el.uploadDato.value = todayISO();
        this.show('uploadModal');
    }

    async upload() {
        const file = this.el.uploadFile.files[0];
        if (!file) return alert('Velg en fil.');
        this.showLoader();
        try {
            const innhold = await this.fileToBase64(file);
            await post(`${DOK}/opplasting`, {
                navn: file.name,
                innhold,
                tittel: this.el.uploadTitle.value.trim() || file.name,
                dokumenttype: this.el.uploadType.value,
                anledning: this.el.uploadAnledning.value.trim(),
                dato: this.el.uploadDato.value,
                forfatter: getCurrentMember()?.name || '',
            });
            this.hide('uploadModal');
            await this.load();
        } catch (err) { console.error(err); alert('Kunne ikke laste opp.'); }
        finally { this.hideLoader(); }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }

    // --- PDF: generer i nettleser og arkiver ---
    async ensureHtml2Pdf() {
        if (window.html2pdf) return window.html2pdf;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'js/vendor/html2pdf.bundle.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('html2pdf mangler'));
            document.head.appendChild(s);
        });
        return window.html2pdf;
    }

    buildPrintable(meta) {
        const el = document.createElement('div');
        el.className = 'sd-printable';
        el.innerHTML = `<h1>${esc(meta.tittel)}</h1>
            <p style="color:#555">${esc(TYPE_LABELS[meta.dokumenttype] || meta.dokumenttype)}${meta.anledning ? ' · ' + esc(meta.anledning) : ''}${meta.dato ? ' · ' + esc(meta.dato) : ''}${meta.forfatter ? ' · ' + esc(meta.forfatter) : ''}</p>
            <hr>${parseMarkdown(meta.contentMd || '')}`;
        return el;
    }

    async generatePdf() {
        const meta = this.collectMeta();
        if (!meta.tittel) return alert('Gi dokumentet en tittel før du lager PDF.');
        const filename = `${meta.tittel.replace(/[\\/:*?"<>|]+/g, '_')}.pdf`;
        this.showLoader();
        try {
            const html2pdf = await this.ensureHtml2Pdf().catch(() => null);
            const printable = this.buildPrintable(meta);

            if (!html2pdf) {
                // Fallback: åpne utskriftsvindu (bruker lagrer selv som PDF)
                const w = window.open('', '_blank');
                w.document.write(`<html><head><title>${esc(meta.tittel)}</title></head><body>${printable.innerHTML}</body></html>`);
                w.document.close(); w.focus(); w.print();
                alert('PDF-biblioteket mangler på serveren, så jeg åpnet utskrift i stedet. Legg js/vendor/html2pdf.bundle.min.js på plass for automatisk arkivering.');
                return;
            }

            document.body.appendChild(printable);
            const blob = await html2pdf().set({
                margin: 12, filename,
                html2canvas: { backgroundColor: '#ffffff', scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4' },
            }).from(printable).outputPdf('blob');
            printable.remove();

            const innhold = await this.blobToBase64(blob);
            await post(`${DOK}/opplasting`, {
                navn: filename, innhold,
                tittel: `${meta.tittel} (PDF)`,
                dokumenttype: meta.dokumenttype, anledning: meta.anledning, dato: meta.dato,
                forfatter: meta.forfatter, status: 'ferdig',
            });
            await this.load();
            alert('PDF generert og arkivert.');
        } catch (err) { console.error(err); alert('Kunne ikke lage PDF: ' + err.message); }
        finally { this.hideLoader(); }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    }

    // --- utils ---
    show(m) { this.el[m].hidden = false; }
    hide(m) { this.el[m].hidden = true; }
    showLoader() { this.el.loader.classList.add('active'); }
    hideLoader() { this.el.loader.classList.remove('active'); }
}

document.addEventListener('DOMContentLoaded', () => new StyreDocsApp().init());
