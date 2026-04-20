/**
 * Admin Page - Kammerkoret Utsikten
 * Database-browser, diskplass-oversikt og verktøy
 */

import {
    ThemeManager,
    MenuManager,
    getCurrentUserRole,
    ROLES
} from './navigation.js';
import { getCurrentMember } from './member-utils.js';
import { initMusicXMLTools } from './musicxml-tools.js';
import { initWavMp3Tool } from './wav-mp3-tool.js';

class AdminApp {
    constructor() {
        this.themeManager = new ThemeManager();
        this.menuManager = new MenuManager();
        this.currentTable = '';
        this.tableRows = [];
    }

    async init() {
        if (getCurrentUserRole() !== ROLES.ADMIN) {
            window.location.href = '/';
            return;
        }

        this.themeManager.init();
        this.menuManager.init();

        const yearEl = document.getElementById('currentYear');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        this.setupEventListeners();
        await this.loadDiskInfo();
        await this.loadTables();

        initMusicXMLTools();
        initWavMp3Tool();
    }

    setupEventListeners() {
        document.getElementById('clearCacheBtn')?.addEventListener('click', () => this.clearCache());
        document.getElementById('refreshSwBtn')?.addEventListener('click', () => this.refreshServiceWorker());
        document.getElementById('dbTableSelect')?.addEventListener('change', (e) => this.selectTable(e.target.value));
        document.getElementById('dbNewRowBtn')?.addEventListener('click', () => this.openEditModal(null));
        document.getElementById('dbEditClose')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('dbEditCancel')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('dbEditSave')?.addEventListener('click', () => this.saveRow());

        document.getElementById('dbEditModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'dbEditModal') this.closeEditModal();
        });
    }

    // =========================================================================
    // DISK INFO
    // =========================================================================
    async loadDiskInfo() {
        try {
            const res = await fetch('/api/admin/disk');
            const data = await res.json();
            const info = data.body || data;

            document.getElementById('diskSize').textContent = info.disk?.size || '-';
            document.getElementById('diskUsed').textContent = info.disk?.used || '-';
            document.getElementById('diskAvailable').textContent = info.disk?.available || '-';
            document.getElementById('diskPercent').textContent = info.disk?.usePercent || '-';
            document.getElementById('uploadsInfo').textContent =
                `${info.uploads?.size || '0'} (${info.uploads?.fileCount || 0} filer)`;
            document.getElementById('dbSize').textContent = info.database?.size || '-';
        } catch (err) {
            console.error('Disk info error:', err);
        }
    }

    // =========================================================================
    // DATABASE BROWSER
    // =========================================================================
    async loadTables() {
        try {
            const res = await fetch('/api/admin/tables');
            const data = await res.json();
            const tables = data.body || data;

            const select = document.getElementById('dbTableSelect');
            select.innerHTML = '<option value="">Velg tabell...</option>';
            for (const t of tables) {
                const opt = document.createElement('option');
                opt.value = t.name;
                opt.textContent = `${t.name} (${t.rows} rader)`;
                select.appendChild(opt);
            }
        } catch (err) {
            console.error('Load tables error:', err);
        }
    }

    async selectTable(table) {
        if (!table) {
            document.getElementById('dbTableView').hidden = true;
            return;
        }

        this.currentTable = table;

        try {
            const res = await fetch(`/api/admin/tables/${encodeURIComponent(table)}?limit=500`);
            const data = await res.json();
            const result = data.body || data;
            this.tableRows = result.rows || [];

            document.getElementById('dbRowCount').textContent = `${result.total} rader`;
            this.renderTable();
            document.getElementById('dbTableView').hidden = false;
        } catch (err) {
            console.error('Load table error:', err);
        }
    }

    renderTable() {
        const rows = this.tableRows;
        if (rows.length === 0) {
            document.getElementById('dbTableHead').innerHTML = '<tr><th>Ingen data</th></tr>';
            document.getElementById('dbTableBody').innerHTML = '';
            return;
        }

        // Collect all unique keys across rows
        const allKeys = new Set();
        for (const row of rows) {
            Object.keys(row).forEach(k => allKeys.add(k));
        }
        // Put id first, then sort rest
        const keys = ['id', ...Array.from(allKeys).filter(k => k !== 'id').sort()];

        // Limit visible columns to keep table readable
        const maxCols = 8;
        const visibleKeys = keys.slice(0, maxCols);
        const hasMore = keys.length > maxCols;

        document.getElementById('dbTableHead').innerHTML = '<tr>' +
            visibleKeys.map(k => `<th>${this.escapeHtml(k)}</th>`).join('') +
            '<th>Handlinger</th></tr>';

        document.getElementById('dbTableBody').innerHTML = rows.map(row => {
            const cells = visibleKeys.map(k => {
                let val = row[k];
                if (val === null || val === undefined) val = '';
                if (typeof val === 'object') val = JSON.stringify(val);
                const str = String(val);
                const display = str.length > 50 ? str.substring(0, 50) + '...' : str;
                return `<td title="${this.escapeHtml(str)}">${this.escapeHtml(display)}</td>`;
            }).join('');

            return `<tr>
                ${cells}
                <td class="db-table__actions">
                    <button class="admin-btn admin-btn--sm" data-action="edit" data-id="${this.escapeHtml(row.id)}">Rediger</button>
                    <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete" data-id="${this.escapeHtml(row.id)}">Slett</button>
                </td>
            </tr>`;
        }).join('');

        // Bind action buttons
        document.getElementById('dbTableBody').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.dataset.action === 'edit') this.openEditModal(id);
            if (btn.dataset.action === 'delete') this.deleteRow(id);
        });
    }

    openEditModal(rowId) {
        const modal = document.getElementById('dbEditModal');
        const body = document.getElementById('dbEditBody');
        const title = document.getElementById('dbEditTitle');

        let row = {};
        if (rowId) {
            row = this.tableRows.find(r => r.id === rowId) || {};
            title.textContent = `Rediger rad: ${rowId}`;
        } else {
            title.textContent = `Ny rad i ${this.currentTable}`;
        }

        // Collect all keys from all rows for field list
        const allKeys = new Set(['id']);
        for (const r of this.tableRows) {
            Object.keys(r).forEach(k => allKeys.add(k));
        }
        const keys = ['id', ...Array.from(allKeys).filter(k => k !== 'id' && k !== 'partitionKey').sort()];

        body.innerHTML = keys.map(k => {
            let val = row[k];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') val = JSON.stringify(val, null, 2);

            const isLong = String(val).length > 80 || String(val).includes('\n');
            const readOnly = (k === 'id' && rowId) ? 'readonly' : '';

            if (isLong) {
                return `<div class="db-field">
                    <label>${this.escapeHtml(k)}</label>
                    <textarea data-key="${this.escapeHtml(k)}" rows="4" ${readOnly}>${this.escapeHtml(String(val))}</textarea>
                </div>`;
            }
            return `<div class="db-field">
                <label>${this.escapeHtml(k)}</label>
                <input type="text" data-key="${this.escapeHtml(k)}" value="${this.escapeHtml(String(val))}" ${readOnly}>
            </div>`;
        }).join('');

        // Add field for new keys
        body.innerHTML += `<div class="db-field db-field--new">
            <label>Nytt felt (valgfritt)</label>
            <div style="display:flex;gap:8px">
                <input type="text" id="dbNewFieldName" placeholder="Feltnavn" style="flex:0 0 120px">
                <input type="text" id="dbNewFieldValue" placeholder="Verdi" style="flex:1">
            </div>
        </div>`;

        modal.hidden = false;
    }

    closeEditModal() {
        document.getElementById('dbEditModal').hidden = true;
    }

    async saveRow() {
        const body = document.getElementById('dbEditBody');
        const fields = {};

        body.querySelectorAll('[data-key]').forEach(el => {
            const key = el.dataset.key;
            let val = el.value;

            // Try to parse JSON values
            if (val.startsWith('[') || val.startsWith('{')) {
                try { val = JSON.parse(val); } catch { /* keep as string */ }
            }
            // Parse numbers
            else if (val !== '' && !isNaN(val) && key !== 'id' && key !== 'email' && key !== 'phone') {
                val = Number(val);
            }
            // Parse booleans
            else if (val === 'true') val = true;
            else if (val === 'false') val = false;

            fields[key] = val;
        });

        // Add new field if specified
        const newName = document.getElementById('dbNewFieldName')?.value.trim();
        const newValue = document.getElementById('dbNewFieldValue')?.value.trim();
        if (newName && newValue) {
            fields[newName] = newValue;
        }

        if (!fields.id) {
            this.showToast('ID er påkrevd', 'error');
            return;
        }

        try {
            const res = await fetch(`/api/admin/tables/${encodeURIComponent(this.currentTable)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
            const data = await res.json();
            const result = data.body || data;

            if (!res.ok || result.success === false) {
                this.showToast(result.error || 'Feil ved lagring', 'error');
                return;
            }

            this.closeEditModal();
            this.showToast('Rad lagret');
            await this.selectTable(this.currentTable);
        } catch (err) {
            console.error('Save row error:', err);
            this.showToast('Kunne ikke lagre', 'error');
        }
    }

    async deleteRow(id) {
        if (!confirm(`Slette rad "${id}" fra ${this.currentTable}?`)) return;

        try {
            const res = await fetch(`/api/admin/tables/${encodeURIComponent(this.currentTable)}/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            const result = data.body || data;

            if (!res.ok || result.success === false) {
                this.showToast(result.error || 'Feil ved sletting', 'error');
                return;
            }

            this.showToast('Rad slettet');
            await this.selectTable(this.currentTable);
        } catch (err) {
            console.error('Delete row error:', err);
            this.showToast('Kunne ikke slette', 'error');
        }
    }

    // =========================================================================
    // CACHE
    // =========================================================================
    async clearCache() {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            this.showToast('Cache er tømt');
        } catch (err) {
            console.error('Clear cache error:', err);
            this.showToast('Kunne ikke tømme cache', 'error');
        }
    }

    async refreshServiceWorker() {
        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) {
                    if (reg.waiting) reg.waiting.postMessage('skipWaiting');
                    await reg.update();
                    this.showToast('Service Worker oppdatert. Last siden på nytt.');
                }
            }
        } catch (err) {
            console.error('SW refresh error:', err);
            this.showToast('Kunne ikke oppdatere Service Worker', 'error');
        }
    }

    // =========================================================================
    // UTILS
    // =========================================================================
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showToast(message, type = 'success') {
        document.querySelector('.toast')?.remove();
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast--visible'));
        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminApp().init();
});

export { AdminApp };
export default AdminApp;
