/**
 * Styrerom – Oppgaver
 *
 * Styre-only oppgaveliste: opprett, filtrér, følg opp og merk som ferdig.
 * Hver oppgave kan knyttes til et møte/arrangement (anledning) og en ansvarlig.
 *
 * @module Oppgaver
 */

import { initPage, getCurrentMember } from './navigation.js';

const API_BASE = (() => {
    const url = window.ENV?.POWER_AUTOMATE_FILES_URL || '';
    return url.replace(/\/filer\/?$/, '');
})();
const useMock = () => !window.ENV?.POWER_AUTOMATE_FILES_URL;

async function apiReq(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
    const data = await res.json();
    return data.body || data;
}

const STATUS_LABEL = { 'åpen': 'Åpen', 'pågår': 'Pågår', 'ferdig': 'Ferdig' };

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysUntil(iso) { if (!iso) return Infinity; return Math.ceil((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000); }

// --- Mock ---
let MOCK_TASKS = [
    { id: 'OPPG-1', tittel: 'Bestille lokale til høstkonsert', beskrivelse: 'Sjekke Grefsen kirke', anledning: 'Styremøte 2026-08', frist: todayISO(), ansvarligNavn: 'Jan Christiansen', ansvarligEmail: 's@x.no', status: 'pågår' },
    { id: 'OPPG-2', tittel: 'Sende ut medlemskontingent', beskrivelse: '', anledning: 'Årsmøte 2026', frist: '2026-01-15', ansvarligNavn: 'Kasserer', ansvarligEmail: 'k@x.no', status: 'åpen' },
    { id: 'OPPG-3', tittel: 'Oppdatere nettsiden', beskrivelse: 'Legge ut referat', anledning: 'Styremøte 2026-08', frist: '', ansvarligNavn: '', ansvarligEmail: '', status: 'ferdig' },
];
const MOCK_MEMBERS = [{ id: '1', name: 'Jan Christiansen', email: 's@x.no' }, { id: '2', name: 'Kasserer', email: 'k@x.no' }];
async function mock(method, path, body) {
    if (path.startsWith('/styre/medlemmer')) return MOCK_MEMBERS;
    const idm = path.match(/\/oppgaver\/([^/]+)/);
    if (method === 'GET') return { oppgaver: MOCK_TASKS.slice() };
    if (method === 'POST') { const t = { id: 'OPPG-' + Date.now(), ...body }; MOCK_TASKS.unshift(t); return { id: t.id, oppgave: t }; }
    if (method === 'PATCH') { const t = MOCK_TASKS.find(x => x.id === idm[1]); Object.assign(t, body); return { oppgave: t }; }
    if (method === 'DELETE') { MOCK_TASKS = MOCK_TASKS.filter(x => x.id !== idm[1]); return { message: 'ok' }; }
}
const req = (m, p, b) => useMock() ? mock(m, p, b) : apiReq(m, p, b);

// ==========================================================================
class OppgaverApp {
    constructor() { this.tasks = []; this.members = []; this.view = 'alle'; this.editingId = null; this.el = {}; }

    async init() {
        if (!initPage({ requireAuth: true, requiredRole: 'styre' })) return;
        this.me = getCurrentMember();
        this.cache();
        this.bind();
        await this.loadMembers();
        await this.load();
    }

    cache() {
        const id = (x) => document.getElementById(x);
        this.el = {
            loader: id('loader'), list: id('taskList'), empty: id('emptyState'), emptyText: id('emptyText'),
            tabs: id('viewTabs'), filterStatus: id('filterStatus'), filterAnledning: id('filterAnledning'), anledningList: id('anledningList'),
            newTaskBtn: id('newTaskBtn'),
            modal: id('taskModal'), modalTitle: id('taskModalTitle'), close: id('taskClose'), cancel: id('taskCancel'), save: id('taskSave'),
            title: id('taskTitle'), desc: id('taskDesc'), anledning: id('taskAnledning'), frist: id('taskFrist'), ansvarlig: id('taskAnsvarlig'), status: id('taskStatus'),
        };
    }

    bind() {
        this.el.tabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.op-tab'); if (!btn) return;
            this.view = btn.dataset.view;
            [...this.el.tabs.children].forEach(b => b.classList.toggle('op-tab--active', b === btn));
            this.render();
        });
        this.el.filterStatus.addEventListener('change', () => this.render());
        this.el.filterAnledning.addEventListener('change', () => this.render());
        this.el.newTaskBtn.addEventListener('click', () => this.openEditor());
        this.el.close.addEventListener('click', () => this.hide());
        this.el.cancel.addEventListener('click', () => this.hide());
        this.el.save.addEventListener('click', () => this.save());
        this.el.list.addEventListener('click', (e) => this.onListClick(e));
        this.el.list.addEventListener('change', (e) => this.onToggle(e));
    }

    async loadMembers() {
        try {
            const data = await req('GET', '/styre/medlemmer');
            this.members = Array.isArray(data) ? data : (data.members || []);
        } catch { this.members = []; }
        this.el.ansvarlig.innerHTML = '<option value="">(ingen)</option>' +
            this.members.map(m => `<option value="${esc(m.email)}" data-navn="${esc(m.name)}" data-id="${esc(m.id)}">${esc(m.name)}</option>`).join('');
    }

    async load() {
        this.showLoader();
        try {
            const res = await req('GET', '/oppgaver');
            this.tasks = res.oppgaver || [];
            this.populateAnledninger();
            this.render();
        } catch (err) { console.error(err); this.tasks = []; this.render(); }
        finally { this.hideLoader(); }
    }

    populateAnledninger() {
        const set = [...new Set(this.tasks.map(t => t.anledning).filter(Boolean))].sort();
        this.el.filterAnledning.innerHTML = '<option value="">Alle møter/anledninger</option>' + set.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
        this.el.anledningList.innerHTML = set.map(a => `<option value="${esc(a)}">`).join('');
    }

    filtered() {
        let list = this.tasks.slice();
        const myEmail = (this.me?.email || '').toLowerCase();
        if (this.view === 'mine') list = list.filter(t => (t.ansvarligEmail || '').toLowerCase() === myEmail);
        else if (this.view === 'forfalne') list = list.filter(t => t.status !== 'ferdig' && t.frist && daysUntil(t.frist) < 0);
        else if (this.view === 'uke') list = list.filter(t => t.status !== 'ferdig' && t.frist && daysUntil(t.frist) >= 0 && daysUntil(t.frist) <= 7);
        const st = this.el.filterStatus.value, anl = this.el.filterAnledning.value;
        if (st) list = list.filter(t => t.status === st);
        if (anl) list = list.filter(t => t.anledning === anl);
        return list;
    }

    render() {
        const list = this.filtered();
        if (!list.length) { this.el.list.innerHTML = ''; this.el.empty.hidden = false; this.el.emptyText.textContent = this.tasks.length ? 'Ingen oppgaver i denne visningen.' : 'Ingen oppgaver enda.'; return; }
        this.el.empty.hidden = true;

        this.el.list.innerHTML = list.map(t => {
            const done = t.status === 'ferdig';
            const d = t.frist ? daysUntil(t.frist) : null;
            const fristCls = !t.frist || done ? '' : d < 0 ? 'op-frist--over' : d <= 7 ? 'op-frist--soon' : '';
            const fristTxt = t.frist ? (d < 0 && !done ? `Forfalt ${t.frist}` : `Frist ${t.frist}`) : '';
            return `<article class="op-task ${done ? 'op-task--done' : ''}" data-id="${esc(t.id)}">
                <input type="checkbox" class="op-check" ${done ? 'checked' : ''} title="Merk som ferdig">
                <div class="op-task__main" data-action="edit">
                    <div class="op-task__title">${esc(t.tittel)}</div>
                    <div class="op-task__meta">
                        ${t.anledning ? `<span class="sd-tag">${esc(t.anledning)}</span>` : ''}
                        ${fristTxt ? `<span class="op-frist ${fristCls}">${esc(fristTxt)}</span>` : ''}
                        ${t.ansvarligNavn ? `<span>👤 ${esc(t.ansvarligNavn)}</span>` : ''}
                        <span class="op-status op-status--${esc(t.status)}">${esc(STATUS_LABEL[t.status] || t.status)}</span>
                    </div>
                </div>
                <div class="sd-doc__actions">
                    <button class="sd-doc__btn" data-action="edit" title="Rediger">✏️</button>
                    <button class="sd-doc__btn sd-doc__btn--danger" data-action="delete" title="Slett">🗑</button>
                </div>
            </article>`;
        }).join('');
    }

    onListClick(e) {
        if (e.target.classList.contains('op-check')) return;
        const art = e.target.closest('.op-task'); if (!art) return;
        const id = art.dataset.id;
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'delete') this.remove(id);
        else this.openEditor(id);
    }

    async onToggle(e) {
        if (!e.target.classList.contains('op-check')) return;
        const id = e.target.closest('.op-task')?.dataset.id;
        const status = e.target.checked ? 'ferdig' : 'åpen';
        try { await req('PATCH', `/oppgaver/${id}`, { status }); await this.load(); }
        catch (err) { console.error(err); alert('Kunne ikke oppdatere status.'); this.render(); }
    }

    openEditor(id = null) {
        this.editingId = id;
        this.el.modalTitle.textContent = id ? 'Rediger oppgave' : 'Ny oppgave';
        const t = id ? this.tasks.find(x => x.id === id) : null;
        this.el.title.value = t?.tittel || '';
        this.el.desc.value = t?.beskrivelse || '';
        this.el.anledning.value = t?.anledning || '';
        this.el.frist.value = t?.frist || '';
        this.el.ansvarlig.value = t?.ansvarligEmail || '';
        this.el.status.value = t?.status || 'åpen';
        this.el.modal.hidden = false;
    }

    async save() {
        const tittel = this.el.title.value.trim();
        if (!tittel) return alert('Oppgaven må ha en tittel.');
        const opt = this.el.ansvarlig.selectedOptions[0];
        const body = {
            tittel,
            beskrivelse: this.el.desc.value.trim(),
            anledning: this.el.anledning.value.trim(),
            frist: this.el.frist.value,
            ansvarligEmail: this.el.ansvarlig.value,
            ansvarligNavn: opt?.dataset.navn || '',
            ansvarligId: opt?.dataset.id || '',
            status: this.el.status.value,
        };
        this.showLoader();
        try {
            if (this.editingId) await req('PATCH', `/oppgaver/${this.editingId}`, body);
            else await req('POST', '/oppgaver', body);
            this.hide();
            await this.load();
        } catch (err) { console.error(err); alert('Kunne ikke lagre oppgave.'); }
        finally { this.hideLoader(); }
    }

    async remove(id) {
        const t = this.tasks.find(x => x.id === id);
        if (!confirm(`Slette «${t?.tittel || 'oppgave'}»?`)) return;
        this.showLoader();
        try { await req('DELETE', `/oppgaver/${id}`); await this.load(); }
        catch (err) { console.error(err); alert('Kunne ikke slette.'); }
        finally { this.hideLoader(); }
    }

    hide() { this.el.modal.hidden = true; }
    showLoader() { this.el.loader.classList.add('active'); }
    hideLoader() { this.el.loader.classList.remove('active'); }
}

document.addEventListener('DOMContentLoaded', () => new OppgaverApp().init());
