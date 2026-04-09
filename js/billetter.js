/**
 * Billetter Admin Page - Kammerkoret Utsikten
 * Administrasjon av ubetalte billettreservasjoner
 *
 * @module Billetter
 * @version 1.0.0
 */

import { initPage } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';

// ==========================================================================
// MOCK DATA
// ==========================================================================

const MOCK_RESERVATIONS = [
    {
        id: '1',
        ticketId: 'BIL-2026-001',
        concertId: 1,
        concertTitle: 'Vårkonsert 2026',
        concertDate: '2026-04-18',
        name: 'Ola Nordmann',
        email: 'ola@example.com',
        phone: '+47 123 45 678',
        ticketCount: 2,
        totalPrice: 500,
        reservationDate: '2026-02-01T12:00:00Z',
        isPaid: false
    },
    {
        id: '2',
        ticketId: 'BIL-2026-002',
        concertId: 1,
        concertTitle: 'Vårkonsert 2026',
        concertDate: '2026-04-18',
        name: 'Kari Hansen',
        email: 'kari@example.com',
        phone: '+47 987 65 432',
        ticketCount: 4,
        totalPrice: 1000,
        reservationDate: '2026-02-02T09:30:00Z',
        isPaid: false
    },
    {
        id: '3',
        ticketId: 'BIL-2026-003',
        concertId: 1,
        concertTitle: 'Vårkonsert 2026',
        concertDate: '2026-04-18',
        name: 'Per Olsen',
        email: 'per@example.com',
        phone: '+47 555 12 345',
        ticketCount: 1,
        totalPrice: 250,
        reservationDate: '2026-02-03T14:15:00Z',
        isPaid: false
    },
    {
        id: '4',
        ticketId: 'BIL-2026-004',
        concertId: 2,
        concertTitle: 'Sommerkonsert 2026',
        concertDate: '2026-06-21',
        name: 'Lise Berg',
        email: 'lise@example.com',
        phone: '+47 444 55 666',
        ticketCount: 3,
        totalPrice: 750,
        reservationDate: '2026-02-05T10:00:00Z',
        isPaid: false
    },
    {
        id: '5',
        ticketId: 'BIL-2026-005',
        concertId: 2,
        concertTitle: 'Sommerkonsert 2026',
        concertDate: '2026-06-21',
        name: 'Erik Dahl',
        email: 'erik@example.com',
        phone: '+47 333 22 111',
        ticketCount: 2,
        totalPrice: 500,
        reservationDate: '2026-02-06T16:45:00Z',
        isPaid: false
    },
    {
        id: '6',
        ticketId: 'BIL-2026-006',
        concertId: 2,
        concertTitle: 'Sommerkonsert 2026',
        concertDate: '2026-06-21',
        name: 'Anna Vik',
        email: 'anna@example.com',
        phone: '',
        ticketCount: 1,
        totalPrice: 250,
        reservationDate: '2026-02-07T08:20:00Z',
        isPaid: false
    }
];

// ==========================================================================
// BILLETTER APPLICATION
// ==========================================================================

class BilletterApp {
    constructor() {
        this.reservations = [];
        this.selectedIds = new Set();
        this.elements = {};
    }

    async init() {
        const result = initPage({ requireAuth: true, requiredRole: 'styre' });
        if (!result) return;

        this.cacheElements();
        this.setCurrentYear();
        this.setupEventListeners();

        await this.loadReservations();
        this.hideLoader();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            currentYear: document.getElementById('currentYear'),
            statReservations: document.getElementById('statReservations'),
            statTickets: document.getElementById('statTickets'),
            statTotal: document.getElementById('statTotal'),
            container: document.getElementById('reservationsContainer'),
            submitBar: document.getElementById('submitBar'),
            submitBtn: document.getElementById('submitBtn'),
            selectedCount: document.getElementById('selectedCount')
        };
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    setupEventListeners() {
        this.elements.submitBtn?.addEventListener('click', () => this.handleSubmit());
    }

    hideLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'none';
        }
    }

    useMock() {
        return !window.ENV?.POWER_AUTOMATE_TICKET_ADMIN_URL;
    }

    // =========================================================================
    // DATA
    // =========================================================================

    async loadReservations() {
        try {
            let data;
            if (this.useMock()) {
                data = MOCK_RESERVATIONS;
            } else {
                data = await sharePointAPI.getTicketAdminReservations();
            }

            this.reservations = data.filter(r => !r.isPaid);
            this.selectedIds.clear();
            this.renderStats();
            this.renderReservations();
            this.updateSubmitBar();
        } catch (error) {
            console.error('[Billetter] Feil ved lasting av reservasjoner:', error);
            this.showToast('Kunne ikke laste reservasjoner', 'error');
        }
    }

    groupByConcert() {
        const groups = new Map();
        for (const r of this.reservations) {
            const key = r.concertId;
            if (!groups.has(key)) {
                groups.set(key, {
                    concertId: r.concertId,
                    concertTitle: r.concertTitle,
                    concertDate: r.concertDate,
                    reservations: []
                });
            }
            groups.get(key).reservations.push(r);
        }
        return [...groups.values()].sort((a, b) => new Date(a.concertDate) - new Date(b.concertDate));
    }

    // =========================================================================
    // RENDERING
    // =========================================================================

    renderStats() {
        const count = this.reservations.length;
        const tickets = this.reservations.reduce((sum, r) => sum + r.ticketCount, 0);
        const total = this.reservations.reduce((sum, r) => sum + r.totalPrice, 0);

        this.elements.statReservations.textContent = count;
        this.elements.statTickets.textContent = tickets;
        this.elements.statTotal.textContent = `${total.toLocaleString('nb-NO')} kr`;
    }

    renderReservations() {
        const groups = this.groupByConcert();

        if (groups.length === 0) {
            this.elements.container.innerHTML = `
                <section class="card content">
                    <div class="empty-state">
                        <div class="empty-state__icon">🎉</div>
                        <h2 class="empty-state__title">Ingen ubetalte reservasjoner</h2>
                        <p class="empty-state__text">Alle billetter er betalt. Bra jobba!</p>
                    </div>
                </section>
            `;
            return;
        }

        this.elements.container.innerHTML = groups.map(group => `
            <section class="card content concert-group">
                <div class="concert-group__header">
                    <div class="concert-group__info">
                        <h2 class="concert-group__title">${escapeHtml(group.concertTitle)}</h2>
                        <span class="concert-group__date">${this.formatDate(group.concertDate)}</span>
                    </div>
                    <label class="select-all-label">
                        <input type="checkbox" class="ticket-checkbox select-all-checkbox"
                               data-concert-id="${group.concertId}">
                        Velg alle
                    </label>
                </div>
                <table class="reservations-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Billett-ID</th>
                            <th>Navn</th>
                            <th>E-post</th>
                            <th>Telefon</th>
                            <th>Antall</th>
                            <th>Pris</th>
                            <th>Dato</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.reservations.map(r => `
                            <tr>
                                <td>
                                    <input type="checkbox" class="ticket-checkbox reservation-checkbox"
                                           data-id="${escapeHtml(String(r.id))}"
                                           data-concert-id="${r.concertId}"
                                           ${this.selectedIds.has(String(r.id)) ? 'checked' : ''}>
                                </td>
                                <td data-label="Billett-ID"><code class="ticket-id">${escapeHtml(r.ticketId || '-')}</code></td>
                                <td data-label="Navn">${escapeHtml(r.name)}</td>
                                <td data-label="E-post">${escapeHtml(r.email)}</td>
                                <td data-label="Telefon">${escapeHtml(r.phone || '-')}</td>
                                <td data-label="Antall">${r.ticketCount}</td>
                                <td data-label="Pris">${r.totalPrice.toLocaleString('nb-NO')} kr</td>
                                <td data-label="Dato">${this.formatDate(r.reservationDate)}</td>
                                <td>
                                    <button class="delete-btn" data-id="${escapeHtml(String(r.id))}" title="Slett reservasjon">Slett</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </section>
        `).join('');

        // Bind checkbox events
        this.elements.container.querySelectorAll('.reservation-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.handleCheckboxChange(cb));
        });

        this.elements.container.querySelectorAll('.select-all-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.handleSelectAll(cb));
        });

        this.elements.container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleDelete(btn.dataset.id));
        });
    }

    // =========================================================================
    // CHECKBOX HANDLING
    // =========================================================================

    handleCheckboxChange(checkbox) {
        const id = checkbox.dataset.id;
        if (checkbox.checked) {
            this.selectedIds.add(id);
        } else {
            this.selectedIds.delete(id);
        }

        // Update select-all state for this concert
        const concertId = checkbox.dataset.concertId;
        this.updateSelectAllState(concertId);
        this.updateSubmitBar();
    }

    handleSelectAll(checkbox) {
        const concertId = checkbox.dataset.concertId;
        const reservationCheckboxes = this.elements.container.querySelectorAll(
            `.reservation-checkbox[data-concert-id="${concertId}"]`
        );

        reservationCheckboxes.forEach(cb => {
            cb.checked = checkbox.checked;
            const id = cb.dataset.id;
            if (checkbox.checked) {
                this.selectedIds.add(id);
            } else {
                this.selectedIds.delete(id);
            }
        });

        this.updateSubmitBar();
    }

    updateSelectAllState(concertId) {
        const all = this.elements.container.querySelectorAll(
            `.reservation-checkbox[data-concert-id="${concertId}"]`
        );
        const selectAll = this.elements.container.querySelector(
            `.select-all-checkbox[data-concert-id="${concertId}"]`
        );
        if (!selectAll) return;

        const allChecked = [...all].every(cb => cb.checked);
        selectAll.checked = allChecked;
    }

    updateSubmitBar() {
        const count = this.selectedIds.size;
        this.elements.selectedCount.textContent = count;

        if (count > 0) {
            this.elements.submitBar.classList.add('submit-bar--visible');
        } else {
            this.elements.submitBar.classList.remove('submit-bar--visible');
        }
    }

    // =========================================================================
    // SUBMIT
    // =========================================================================

    async handleSubmit() {
        if (this.selectedIds.size === 0) return;

        const ids = [...this.selectedIds];
        this.elements.submitBtn.disabled = true;
        this.elements.submitBtn.textContent = 'Sender...';

        try {
            if (!this.useMock()) {
                await sharePointAPI.markReservationsAsPaid(ids);
            }

            // Remove paid reservations locally
            this.reservations = this.reservations.filter(r => !ids.includes(String(r.id)));
            this.selectedIds.clear();

            this.renderStats();
            this.renderReservations();
            this.updateSubmitBar();

            this.showToast(`${ids.length} reservasjon(er) markert som betalt`, 'success');
        } catch (error) {
            console.error('[Billetter] Feil ved oppdatering:', error);
            this.showToast('Kunne ikke markere som betalt', 'error');
        } finally {
            this.elements.submitBtn.disabled = false;
            this.elements.submitBtn.textContent = 'Marker som betalt';
        }
    }

    // =========================================================================
    // DELETE
    // =========================================================================

    async handleDelete(id) {
        const reservation = this.reservations.find(r => String(r.id) === id);
        if (!reservation) return;

        const confirmed = confirm(`Er du sikker på at du vil slette reservasjonen for ${reservation.name} (${reservation.ticketCount} billett${reservation.ticketCount > 1 ? 'er' : ''}, ${reservation.totalPrice.toLocaleString('nb-NO')} kr)?`);
        if (!confirmed) return;

        const btn = this.elements.container.querySelector(`.delete-btn[data-id="${id}"]`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sletter...';
        }

        try {
            if (!this.useMock()) {
                await sharePointAPI.deleteReservations([id]);
            }

            this.reservations = this.reservations.filter(r => String(r.id) !== id);
            this.selectedIds.delete(id);

            this.renderStats();
            this.renderReservations();
            this.updateSubmitBar();

            this.showToast('Reservasjon slettet', 'success');
        } catch (error) {
            console.error('[Billetter] Feil ved sletting:', error);
            this.showToast('Kunne ikke slette reservasjonen', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Slett';
            }
        }
    }

    // =========================================================================
    // UTILS
    // =========================================================================

    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('nb-NO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    showToast(message, type = 'success') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('toast--visible');
        });

        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ==========================================================================
// UTILITY
// ==========================================================================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==========================================================================
// INIT
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new BilletterApp();
    app.init();
});

export { BilletterApp };
export default BilletterApp;
