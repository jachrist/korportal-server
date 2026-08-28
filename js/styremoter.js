/**
 * Styrerom – Styremøter
 *
 * Styremøter er arrangementer synlige kun for styret. Kan legges i kalenderen
 * (.ics) og knytter dokumenter/oppgaver sammen via anledning.
 *
 * @module Styremoter
 */

import { initPage, getCurrentMember } from './navigation.js';

const API_BASE = (() => {
    const url = window.ENV?.POWER_AUTOMATE_FILES_URL || '';
    return url.replace(/\/filer\/?$/, '');
})();
const useMock = () => !window.ENV?.POWER_AUTOMATE_FILES_URL;
const MOTER = '/styre/moter';

async function apiReq(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
    const data = await res.json();
    return data.body || data;
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) { if (!iso) return ''; try { return new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return iso; } }

let MOCK = [
    { id: 'MOTE-1', title: 'Styremøte september', description: 'Agenda: høstprogram, budsjett.', date: '2026-09-15', startTime: '18:00', endTime: '20:00', location: 'Grefsen kirke', anledning: 'Styremøte 2026-09', docCount: 2, taskCount: 3 },
    { id: 'MOTE-2', title: 'Årsmøte', description: '', date: '2026-02-01', startTime: '19:00', endTime: '21:00', location: 'Menighetshuset', anledning: 'Årsmøte 2026', docCount: 1, taskCount: 0 },
];
async function mock(method, path, body) {
    const idm = path.match(/\/moter\/([^/]+)/);
    if (method === 'GET') return { moter: MOCK.slice() };
    if (method === 'POST') { const m = { id: 'MOTE-' + Date.now(), docCount: 0, taskCount: 0, ...body, anledning: body.anledning || body.title }; MOCK.unshift(m); return { id: m.id, mote: m }; }
    if (method === 'PATCH') { const m = MOCK.find(x => x.id === idm[1]); Object.assign(m, body); return { message: 'ok' }; }
    if (method === 'DELETE') { MOCK = MOCK.filter(x => x.id !== idm[1]); return { message: 'ok' }; }
}
const req = (m, p, b) => useMock() ? mock(m, p, b) : apiReq(m, p, b);

// ==========================================================================
class StyremoterApp {
    constructor() { this.moter = []; this.editingId = null; this.el = {}; }

    async init() {
        if (!initPage({ requireAuth: true, requiredRole: 'styre' })) return;
        this.me = getCurrentMember();
        this.cache();
        this.bind();
        await this.load();
    }

    cache() {
        const id = (x) => document.getElementById(x);
        this.el = {
            loader: id('loader'), upcoming: id('upcomingList'), past: id('pastList'),
            upcomingHead: id('upcomingHead'), pastHead: id('pastHead'), empty: id('emptyState'),
            newBtn: id('newBtn'),
            modal: id('moteModal'), modalTitle: id('moteModalTitle'), close: id('moteClose'), cancel: id('moteCancel'), save: id('moteSave'),
            title: id('mTitle'), date: id('mDate'), location: id('mLocation'), start: id('mStart'), end: id('mEnd'), anledning: id('mAnledning'), desc: id('mDesc'),
        };
    }

    bind() {
        this.el.newBtn.addEventListener('click', () => this.openEditor());
        this.el.close.addEventListener('click', () => this.hide());
        this.el.cancel.addEventListener('click', () => this.hide());
        this.el.save.addEventListener('click', () => this.saveMote());
        for (const c of [this.el.upcoming, this.el.past]) c.addEventListener('click', (e) => this.onClick(e));
    }

    async load() {
        this.showLoader();
        try { this.moter = (await req('GET', MOTER)).moter || []; this.render(); }
        catch (err) { console.error(err); this.moter = []; this.render(); }
        finally { this.hideLoader(); }
    }

    render() {
        const today = todayISO();
        const upcoming = this.moter.filter(m => (m.date || '') >= today).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const past = this.moter.filter(m => (m.date || '') < today).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        this.el.empty.hidden = this.moter.length > 0;
        this.el.upcomingHead.hidden = upcoming.length === 0;
        this.el.pastHead.hidden = past.length === 0;
        this.el.upcoming.innerHTML = upcoming.map(m => this.card(m)).join('');
        this.el.past.innerHTML = past.map(m => this.card(m)).join('');
    }

    card(m) {
        const time = [m.startTime, m.endTime].filter(Boolean).join('–');
        const meta = [fmtDate(m.date), time ? `kl. ${time}` : '', m.location].filter(Boolean).join(' · ');
        const icsUrl = `${API_BASE}${MOTER}/${encodeURIComponent(m.id)}/ics`;
        const anl = encodeURIComponent(m.anledning || m.title || '');
        return `<article class="mt-card" data-id="${esc(m.id)}">
            <div class="mt-card__head">
                <div class="mt-card__title">${esc(m.title)}</div>
                <div class="sd-doc__actions">
                    <a class="sd-doc__btn" href="${esc(icsUrl)}" title="Legg i kalender">📅</a>
                    <button class="sd-doc__btn" data-action="edit" title="Rediger">✏️</button>
                    <button class="sd-doc__btn sd-doc__btn--danger" data-action="delete" title="Slett">🗑</button>
                </div>
            </div>
            ${meta ? `<div class="mt-card__meta">${esc(meta)}</div>` : ''}
            ${m.description ? `<div class="mt-card__desc">${esc(m.description)}</div>` : ''}
            <div class="mt-card__links">
                <a class="mt-link" href="styredokumenter.html">📁 Dokumenter (${m.docCount ?? 0})</a>
                <a class="mt-link" href="oppgaver.html">✅ Oppgaver (${m.taskCount ?? 0})</a>
            </div>
        </article>`;
    }

    onClick(e) {
        if (e.target.closest('a')) return; // la lenker (kalender/dokumenter) virke normalt
        const card = e.target.closest('.mt-card'); if (!card) return;
        const id = card.dataset.id;
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'edit') this.openEditor(id);
        else if (action === 'delete') this.remove(id);
    }

    openEditor(id = null) {
        this.editingId = id;
        this.el.modalTitle.textContent = id ? 'Rediger møte' : 'Nytt møte';
        const m = id ? this.moter.find(x => x.id === id) : null;
        this.el.title.value = m?.title || '';
        this.el.date.value = m?.date || '';
        this.el.location.value = m?.location || '';
        this.el.start.value = m?.startTime || '';
        this.el.end.value = m?.endTime || '';
        this.el.anledning.value = m?.anledning || '';
        this.el.desc.value = m?.description || '';
        this.el.modal.hidden = false;
    }

    async saveMote() {
        const title = this.el.title.value.trim();
        const date = this.el.date.value;
        if (!title || !date) return alert('Tittel og dato er påkrevd.');
        const body = {
            title, date,
            location: this.el.location.value.trim(),
            startTime: this.el.start.value,
            endTime: this.el.end.value,
            anledning: this.el.anledning.value.trim() || title,
            description: this.el.desc.value.trim(),
            authorName: getCurrentMember()?.name || '',
            authorEmail: getCurrentMember()?.email || '',
        };
        this.showLoader();
        try {
            if (this.editingId) await req('PATCH', `${MOTER}/${this.editingId}`, body);
            else await req('POST', MOTER, body);
            this.hide();
            await this.load();
        } catch (err) { console.error(err); alert('Kunne ikke lagre møtet.'); }
        finally { this.hideLoader(); }
    }

    async remove(id) {
        const m = this.moter.find(x => x.id === id);
        if (!confirm(`Slette «${m?.title || 'møte'}»?`)) return;
        this.showLoader();
        try { await req('DELETE', `${MOTER}/${id}`); await this.load(); }
        catch (err) { console.error(err); alert('Kunne ikke slette.'); }
        finally { this.hideLoader(); }
    }

    hide() { this.el.modal.hidden = true; }
    showLoader() { this.el.loader.classList.add('active'); }
    hideLoader() { this.el.loader.classList.remove('active'); }
}

document.addEventListener('DOMContentLoaded', () => new StyremoterApp().init());
