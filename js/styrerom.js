/**
 * Styrerom – samlet arbeidsflate med faner
 *
 * Verten viser topbar + faner; hver fane laster en eksisterende styreside i en
 * <iframe> (lazy — først når fanen åpnes, deretter beholdes den lastet så man
 * veksler uten ny innlasting). Aktiv fane huskes i localStorage og speiles i
 * URL-hash (#oppgaver osv.) for direktelenking.
 *
 * @module Styrerom
 */

import { initPage } from './navigation.js';

const TABS = [
    { key: 'medlemmer', label: 'Medlemmer', icon: '👥', src: 'styre.html' },
    { key: 'dokumenter', label: 'Dokumenter', icon: '📁', src: 'styredokumenter.html' },
    { key: 'oppgaver', label: 'Oppgaver', icon: '✅', src: 'oppgaver.html' },
    { key: 'kalender', label: 'Styrekalender', icon: '📅', src: 'styremoter.html' },
];
const STORE_KEY = 'styrerom-tab';
const isTab = (k) => TABS.some((t) => t.key === k);

class Styrerom {
    init() {
        if (!initPage({ requireAuth: true, requiredRole: 'styre' })) return;
        this.tabsEl = document.getElementById('srTabs');
        this.framesEl = document.getElementById('srFrames');
        this.build();
        this.activate(this.resolveInitial());
        window.addEventListener('hashchange', () => {
            const k = location.hash.replace('#', '');
            if (isTab(k)) this.activate(k);
        });
        // Hold fanene i samme tema som verten (unngår mørk/lys-glimt ved lasting).
        new MutationObserver(() => this.syncTheme()).observe(
            document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    hostTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }

    applyTheme(frame) {
        try { frame.contentDocument?.documentElement.setAttribute('data-theme', this.hostTheme()); }
        catch { /* ignore */ }
    }

    syncTheme() {
        for (const f of this.framesEl.querySelectorAll('.sr-frame')) this.applyTheme(f);
    }

    resolveInitial() {
        const h = location.hash.replace('#', '');
        if (isTab(h)) return h;
        try { const s = localStorage.getItem(STORE_KEY); if (isTab(s)) return s; } catch { /* ignore */ }
        return TABS[0].key;
    }

    build() {
        this.tabsEl.innerHTML = TABS.map((t) =>
            `<button class="sr-tab" data-key="${t.key}" role="tab" aria-selected="false">
                <span class="sr-tab__icon">${t.icon}</span><span class="sr-tab__label">${t.label}</span>
            </button>`).join('');
        this.framesEl.innerHTML = TABS.map((t) =>
            `<iframe class="sr-frame" data-key="${t.key}" data-src="${t.src}" title="${t.label}" hidden></iframe>`).join('');
        for (const f of this.framesEl.querySelectorAll('.sr-frame')) {
            f.addEventListener('load', () => this.applyTheme(f));
        }
        this.tabsEl.addEventListener('click', (e) => {
            const b = e.target.closest('.sr-tab');
            if (b) this.activate(b.dataset.key);
        });
    }

    activate(key) {
        for (const b of this.tabsEl.querySelectorAll('.sr-tab')) {
            const on = b.dataset.key === key;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        }
        for (const f of this.framesEl.querySelectorAll('.sr-frame')) {
            const on = f.dataset.key === key;
            if (on && !f.src) f.src = f.dataset.src; // lazy-last første gang
            f.hidden = !on;
        }
        try { localStorage.setItem(STORE_KEY, key); } catch { /* ignore */ }
        if (location.hash.replace('#', '') !== key) history.replaceState(null, '', `#${key}`);
        const t = TABS.find((x) => x.key === key);
        if (t) document.title = `${t.label} – Styrerom – Kammerkoret Utsikten`;
    }
}

document.addEventListener('DOMContentLoaded', () => new Styrerom().init());
