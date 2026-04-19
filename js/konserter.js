/**
 * Konserter - JavaScript
 *
 * Håndterer konsertvisning og billettbestilling
 * Med dark/light mode og hamburger-meny
 *
 * @module Konserter
 * @version 1.0.0
 */

import sharePointAPI from './sharepoint-api.js';
import { initPage, getCurrentUserRole, hasRole, ROLES, isLoggedIn } from './navigation.js';
import badgeManager from './badge-manager.js';
import { MarkdownEditor } from './markdown-editor.js';

// ==========================================================================
// MOCK DATA - Brukes når SharePoint ikke er konfigurert
// ==========================================================================
const MOCK_CONCERTS = [
    {
        id: 1,
        title: "Vårkonsert 2026",
        date: "2026-04-18",
        time: "19:00",
        location: "Kulturhuset, Store sal",
        address: "Youngstorget 3, Oslo",
        imageUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80",
        description: "Vår årlige vårkonsert med et variert program fra barokk til samtid.",
        ticketPrice: 250,
        ticketsAvailable: 63,
        ticketUrl: null,
        isPublic: true
    },
    {
        id: 2,
        title: "Sommerserenade",
        date: "2026-06-20",
        time: "20:00",
        location: "Vigelandsparken",
        address: "Frogner, Oslo",
        imageUrl: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80",
        description: "En magisk sommerkveld med musikk under åpen himmel.",
        ticketPrice: 0,
        ticketsAvailable: 55,
        ticketUrl: null,
        isPublic: true
    },
    {
        id: 3,
        title: "Julekonsert 2026",
        date: "2026-12-12",
        time: "18:00",
        location: "Oslo Domkirke",
        address: "Karl Johans gate 11, Oslo",
        imageUrl: "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=800&q=80",
        description: "Vår populære julekonsert i den vakre domkirken.",
        ticketPrice: 350,
        ticketsAvailable: 0,
        ticketUrl: null,
        isPublic: true
    }
];

// ==========================================================================
// CONCERTS APP
// ==========================================================================
class ConcertsApp {
    constructor() {
        this.concerts = [];
        this.selectedConcert = null;
        this.editingConcert = null;
        this.concertEditor = null;
        this.elements = {};
    }

    async init() {
        // Initialiser navigasjon (tema og meny)
        initPage({ requireAuth: false });

        this.cacheElements();
        this.bindEvents();
        this.setCurrentYear();

        this.showSkeletonLoading();
        await this.loadConcerts();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            concertsSection: document.getElementById('concerts-section'),
            emptyState: document.getElementById('empty-state'),
            currentYear: document.getElementById('current-year'),
            // Modal elements
            modal: document.getElementById('ticketModal'),
            modalClose: document.getElementById('modalClose'),
            modalTitle: document.getElementById('modal-concert-title'),
            modalLocation: document.getElementById('modal-concert-location'),
            modalDate: document.getElementById('modal-date'),
            ticketForm: document.getElementById('ticket-form'),
            concertIdInput: document.getElementById('concert-id'),
            ticketCountInput: document.getElementById('ticket-count'),
            decreaseBtn: document.getElementById('decrease-tickets'),
            increaseBtn: document.getElementById('increase-tickets'),
            ticketsAvailable: document.getElementById('tickets-available'),
            totalPrice: document.getElementById('total-price'),
            submitBtn: document.getElementById('submit-btn'),
            submitText: document.getElementById('submit-text'),
            submitSpinner: document.getElementById('submit-spinner'),
            modalSuccess: document.getElementById('modal-success'),
            closeSuccess: document.getElementById('close-success'),
            // Edit concert modal
            editConcertModal: document.getElementById('editConcertModal'),
            editConcertHeading: document.getElementById('editConcertHeading'),
            editConcertModalClose: document.getElementById('editConcertModalClose'),
            editConcertTitle: document.getElementById('editConcertTitle'),
            editConcertDate: document.getElementById('editConcertDate'),
            editConcertTime: document.getElementById('editConcertTime'),
            editConcertLocation: document.getElementById('editConcertLocation'),
            editConcertAddress: document.getElementById('editConcertAddress'),
            editConcertDescription: document.getElementById('editConcertDescription'),
            editConcertImageUrl: document.getElementById('editConcertImageUrl'),
            editConcertTicketPrice: document.getElementById('editConcertTicketPrice'),
            editConcertTicketsAvailable: document.getElementById('editConcertTicketsAvailable'),
            editConcertSave: document.getElementById('editConcertSave'),
            editConcertCancel: document.getElementById('editConcertCancel'),
            editConcertDelete: document.getElementById('editConcertDelete')
        };
    }

    bindEvents() {
        // Modal events
        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.modal?.classList.contains('open')) {
                    this.closeModal();
                }
                if (!this.elements.editConcertModal?.hidden) {
                    this.closeEditConcertModal();
                }
            }
        });

        // Ticket counter
        this.elements.decreaseBtn?.addEventListener('click', () => this.updateTicketCount(-1));
        this.elements.increaseBtn?.addEventListener('click', () => this.updateTicketCount(1));
        this.elements.ticketCountInput?.addEventListener('change', () => this.validateTicketCount());

        // Form submission
        this.elements.ticketForm?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Close success
        this.elements.closeSuccess?.addEventListener('click', () => this.closeModal());

        // Edit concert modal
        this.elements.editConcertModalClose?.addEventListener('click', () => this.closeEditConcertModal());
        this.elements.editConcertCancel?.addEventListener('click', () => this.closeEditConcertModal());
        this.elements.editConcertSave?.addEventListener('click', () => this.saveEditConcert());
        this.elements.editConcertDelete?.addEventListener('click', () => this.deleteEditConcert());
        this.elements.editConcertModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.editConcertModal) this.closeEditConcertModal();
        });
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    showSkeletonLoading() {
        if (!this.elements.concertsSection) return;

        const skeletonHtml = Array(2).fill(null).map(() => `
            <article class="concert-card concert-card--skeleton card">
                <div class="concert-card__image"></div>
                <div class="concert-card__content">
                    <div class="concert-card__header">
                        <div class="skeleton-line skeleton-line--short"></div>
                    </div>
                    <div class="skeleton-line skeleton-line--medium"></div>
                    <div class="skeleton-line skeleton-line--short"></div>
                </div>
            </article>
        `).join('');

        this.elements.concertsSection.innerHTML = skeletonHtml;
    }

    async loadConcerts() {
        this.showLoader();

        try {
            // Try to load from SharePoint, fallback to mock data
            let concerts = [];
            try {
                concerts = await sharePointAPI.getConcerts();
            } catch (e) {
                console.log('Using mock concert data');
            }

            // Use mock data if no concerts from API
            if (!concerts || concerts.length === 0) {
                concerts = MOCK_CONCERTS;
            }

            // Filter to only show upcoming concerts (include today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.concerts = concerts.filter(c => new Date(c.date) >= today);

            badgeManager.markSeen('konserter');
            this.renderConcerts();

        } catch (error) {
            console.error('Error loading concerts:', error);
            const fallbackToday = new Date();
            fallbackToday.setHours(0, 0, 0, 0);
            this.concerts = MOCK_CONCERTS.filter(c => new Date(c.date) >= fallbackToday);
            this.renderConcerts();
        } finally {
            this.hideLoader();
        }
    }

    renderConcerts() {
        if (!this.elements.concertsSection) return;

        let headerHtml = '';
        if (isLoggedIn() && hasRole(getCurrentUserRole(), ROLES.STYRE)) {
            headerHtml = `<div class="card content" style="text-align:right"><button class="btn btn--primary" id="newConcertBtn">Ny konsert</button></div>`;
        }

        if (this.concerts.length === 0) {
            this.elements.concertsSection.innerHTML = headerHtml;
            if (this.elements.emptyState) {
                this.elements.emptyState.hidden = !headerHtml;
            }
            // Bind new concert button
            document.getElementById('newConcertBtn')?.addEventListener('click', () => this.openNewConcertModal());
            return;
        }

        const html = headerHtml + this.concerts.map(concert => this.createConcertCard(concert)).join('');
        this.elements.concertsSection.innerHTML = html;

        // Bind new concert button
        document.getElementById('newConcertBtn')?.addEventListener('click', () => this.openNewConcertModal());

        // Bind book buttons
        this.elements.concertsSection.querySelectorAll('.btn--book').forEach(btn => {
            btn.addEventListener('click', () => {
                const concertId = btn.dataset.concertId;
                this.openBookingModal(concertId);
            });
        });

        // Bind edit buttons
        this.elements.concertsSection.querySelectorAll('.btn--edit-concert').forEach(btn => {
            btn.addEventListener('click', () => {
                const concertId = btn.dataset.concertId;
                this.openEditConcertModal(concertId);
            });
        });

        // Bind delete buttons
        this.elements.concertsSection.querySelectorAll('.btn--delete-concert').forEach(btn => {
            btn.addEventListener('click', () => {
                const concertId = btn.dataset.concertId;
                const concert = this.concerts.find(c => c.id === concertId);
                if (concert && confirm(`Slette "${concert.title}"?`)) {
                    this.deleteConcert(concertId);
                }
            });
        });
    }

    async deleteConcert(concertId) {
        try {
            await sharePointAPI.deleteItem('concerts', concertId);
            this.concerts = this.concerts.filter(c => c.id !== concertId);
            this.renderConcerts();
        } catch (error) {
            console.error('Error deleting concert:', error);
            alert('Kunne ikke slette konserten.');
        }
    }

    createConcertCard(concert) {
        const date = new Date(concert.date);
        const day = date.getDate();
        const month = date.toLocaleDateString('no-NO', { month: 'short' });
        const year = date.getFullYear();
        const time = concert.time || '';

        const available = concert.ticketsAvailable;
        const isSoldOut = available <= 0;
        const isFewLeft = available > 0 && available <= 20;
        const isFree = concert.ticketPrice === 0;

        let badge = '';
        if (isSoldOut) {
            badge = '<span class="concert-card__badge concert-card__badge--soldout">Utsolgt</span>';
        } else if (isFewLeft) {
            badge = '<span class="concert-card__badge concert-card__badge--few">Få billetter</span>';
        }

        let availabilityClass = '';
        let availabilityText = `${available} billetter tilgjengelig`;
        if (isSoldOut) {
            availabilityClass = 'concert-card__availability--soldout';
            availabilityText = 'Utsolgt';
        } else if (isFewLeft) {
            availabilityClass = 'concert-card__availability--few';
            availabilityText = `Kun ${available} billetter igjen!`;
        }

        const priceDisplay = isFree
            ? '<span class="concert-card__price-value concert-card__price-value--free">Gratis</span>'
            : `<span class="concert-card__price-value">${concert.ticketPrice} kr</span>`;

        const imageHtml = concert.imageUrl
            ? `<div class="concert-card__image">
                    <img src="${this.escapeHtml(concert.imageUrl)}" alt="${this.escapeHtml(concert.title)}" loading="lazy">
                    ${badge}
                </div>`
            : (badge ? `<div class="concert-card__badge-wrap">${badge}</div>` : '');

        const descriptionHtml = concert.description ? this.parseMarkdown(concert.description) : '';

        return `
            <article class="concert-card card">
                ${imageHtml}
                <div class="concert-card__content">
                    <div class="concert-card__header">
                        <div class="concert-card__date-box">
                            <span class="concert-card__date-day">${day}</span>
                            <span class="concert-card__date-month">${month}</span>
                            <span class="concert-card__date-year">${year}</span>
                        </div>
                        <div class="concert-card__info">
                            <h2 class="concert-card__title">${this.escapeHtml(concert.title)}</h2>
                            <div class="concert-card__location">
                                <span class="concert-card__location-icon">📍</span>
                                <span>${this.escapeHtml(concert.location)}</span>
                            </div>
                            ${time ? `
                            <div class="concert-card__time">
                                <span class="concert-card__location-icon">🕐</span>
                                <span>Kl. ${this.escapeHtml(time)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    ${descriptionHtml ? `
                    <div class="concert-card__description">
                        ${descriptionHtml}
                    </div>
                    ` : ''}

                    ${isLoggedIn() && hasRole(getCurrentUserRole(), ROLES.STYRE) ? `
                    <div class="concert-card__edit">
                        <button class="edit-btn btn--edit-concert" data-concert-id="${concert.id}" type="button">Rediger</button>
                        <button class="edit-btn btn--delete-concert" data-concert-id="${concert.id}" type="button" style="color:#ef4444">Slett</button>
                    </div>
                    ` : ''}

                    <div class="concert-card__footer">
                        <div class="concert-card__price">
                            <span class="concert-card__price-label">Pris</span>
                            ${priceDisplay}
                        </div>
                        <div class="concert-card__tickets">
                            <span class="concert-card__availability ${availabilityClass}">${availabilityText}</span>
                            <button class="btn btn--primary btn--book" data-concert-id="${concert.id}" ${isSoldOut ? 'disabled' : ''}>
                                ${isSoldOut ? 'Utsolgt' : 'Bestill billetter'}
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    openBookingModal(concertId) {
        this.selectedConcert = this.concerts.find(c => c.id === concertId);
        if (!this.selectedConcert) return;

        const concert = this.selectedConcert;
        const date = new Date(concert.date);
        const day = date.getDate();
        const month = date.toLocaleDateString('no-NO', { month: 'short' });

        // Update modal content
        this.elements.modalDate.innerHTML = `<span class="day">${day}</span><span class="month">${month}</span>`;
        this.elements.modalTitle.textContent = concert.title;
        this.elements.modalLocation.textContent = concert.location;
        this.elements.concertIdInput.value = concert.id;

        // Reset form
        this.elements.ticketForm.reset();
        this.elements.ticketCountInput.value = 1;
        this.elements.ticketCountInput.max = Math.min(10, concert.ticketsAvailable);

        // Update available tickets
        const available = concert.ticketsAvailable;
        this.elements.ticketsAvailable.textContent = `${available} billetter tilgjengelig`;
        this.elements.ticketsAvailable.className = 'tickets-available' + (available <= 20 ? ' tickets-available--few' : '');

        // Update price
        this.updateTotalPrice();

        // Show form, hide success
        this.elements.ticketForm.parentElement.hidden = false;
        this.elements.modalSuccess.hidden = true;

        // Open modal
        this.elements.modal.classList.add('open');
        this.elements.modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Focus first input
        setTimeout(() => {
            document.getElementById('ticket-name')?.focus();
        }, 300);
    }

    closeModal() {
        this.elements.modal?.classList.remove('open');
        this.elements.modal?.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        this.selectedConcert = null;
    }

    updateTicketCount(delta) {
        const input = this.elements.ticketCountInput;
        if (!input) return;

        const current = parseInt(input.value) || 1;
        const min = parseInt(input.min) || 1;
        const max = parseInt(input.max) || 10;
        const newValue = Math.max(min, Math.min(max, current + delta));

        input.value = newValue;
        this.updateTotalPrice();
    }

    validateTicketCount() {
        const input = this.elements.ticketCountInput;
        if (!input) return;

        const min = parseInt(input.min) || 1;
        const max = parseInt(input.max) || 10;
        let value = parseInt(input.value) || 1;

        value = Math.max(min, Math.min(max, value));
        input.value = value;
        this.updateTotalPrice();
    }

    updateTotalPrice() {
        if (!this.selectedConcert || !this.elements.totalPrice) return;

        const count = parseInt(this.elements.ticketCountInput?.value) || 1;
        const total = this.selectedConcert.ticketPrice === 0 ? 0 : this.selectedConcert.ticketPrice * count;

        this.elements.totalPrice.textContent = total === 0 ? 'Gratis' : `${total} kr`;
    }

    async handleSubmit(e) {
        e.preventDefault();
        if (!this.selectedConcert) return;

        // Get form data
        const formData = new FormData(this.elements.ticketForm);
        const data = {
            concertId: this.selectedConcert.id,
            concertTitle: this.selectedConcert.title,
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            ticketCount: parseInt(formData.get('ticketCount')),
            message: formData.get('message'),
            totalPrice: this.selectedConcert.ticketPrice === 0 ? 0 : this.selectedConcert.ticketPrice * parseInt(formData.get('ticketCount'))
        };

        // Show loading state
        this.elements.submitBtn.disabled = true;
        this.elements.submitText.textContent = 'Sender...';
        this.elements.submitSpinner.hidden = false;

        try {
            // Try to send to SharePoint if configured
            let result = {};
            try {
                result = await sharePointAPI.createTicketReservation(data) || {};
            } catch (apiError) {
                console.warn('[Konserter] Ticket reservation failed:', apiError);
                await new Promise(resolve => setTimeout(resolve, 1000));
                result = { referenceNumber: 'DEMO-0000' };
            }

            const referenceNumber = result.bookingReference || result.referenceNumber || result.ticketId || result.id || '-';

            // Show success state with booking details
            this.elements.ticketForm.parentElement.hidden = true;
            const priceText = data.totalPrice === 0 ? 'Gratis' : `${data.totalPrice} kr`;
            const paymentNote = data.totalPrice > 0
                ? `<div class="success-payment-note">
                        <p><strong>Husk å betale billettene med Vipps så raskt som mulig!</strong></p>
                        <p>Vårt Vippsnummer er <strong>#691842</strong>.</p>
                        <p>Skriv inn ditt navn og referansenummer <strong>${this.escapeHtml(String(referenceNumber))}</strong> i meldingsfeltet.</p>
                    </div>`
                : '';
            document.getElementById('success-details').innerHTML = `
                <dl class="success-summary">
                    <div class="success-summary__row">
                        <dt>Navn</dt>
                        <dd>${this.escapeHtml(data.name)}</dd>
                    </div>
                    <div class="success-summary__row">
                        <dt>E-post</dt>
                        <dd>${this.escapeHtml(data.email)}</dd>
                    </div>
                    <div class="success-summary__row">
                        <dt>Antall</dt>
                        <dd>${data.ticketCount} billett${data.ticketCount > 1 ? 'er' : ''}</dd>
                    </div>
                    <div class="success-summary__row">
                        <dt>Totalt</dt>
                        <dd class="success-summary__price">${priceText}</dd>
                    </div>
                    <div class="success-summary__row">
                        <dt>Referanse</dt>
                        <dd>${this.escapeHtml(String(referenceNumber))}</dd>
                    </div>
                </dl>
                ${paymentNote}
                <p class="success-greeting">Vennlig hilsen Kammerkoret Utsikten</p>
            `;
            this.elements.modalSuccess.hidden = false;

            // Update local concert data
            this.selectedConcert.ticketsAvailable -= data.ticketCount;
            this.renderConcerts();

        } catch (error) {
            console.error('Error submitting reservation:', error);
            alert('Det oppstod en feil. Vennligst prøv igjen.');
        } finally {
            this.elements.submitBtn.disabled = false;
            this.elements.submitText.textContent = 'Bestill billetter';
            this.elements.submitSpinner.hidden = true;
        }
    }

    // =========================================================================
    // EDIT CONCERT MODAL
    // =========================================================================

    openNewConcertModal() {
        this.editingConcert = null;
        this.isCreatingConcert = true;
        this.elements.editConcertHeading.textContent = 'Ny konsert';
        this.elements.editConcertTitle.value = '';
        this.elements.editConcertDate.value = '';
        this.elements.editConcertTime.value = '';
        this.elements.editConcertLocation.value = '';
        this.elements.editConcertAddress.value = '';
        this.elements.editConcertDescription.value = '';
        this.elements.editConcertImageUrl.value = '';
        this.elements.editConcertTicketPrice.value = '';
        this.elements.editConcertTicketsAvailable.value = '100';
        this.elements.editConcertDelete.hidden = true;
        this.elements.editConcertModal.hidden = false;

        if (!this.concertEditor && this.elements.editConcertDescription) {
            this.concertEditor = new MarkdownEditor(this.elements.editConcertDescription).init();
        }

        this.elements.editConcertTitle.focus();
    }

    openEditConcertModal(concertId) {
        const concert = this.concerts.find(c => c.id === concertId);
        if (!concert) return;

        this.editingConcert = concert;
        this.isCreatingConcert = false;
        this.elements.editConcertHeading.textContent = 'Rediger konsert';
        this.elements.editConcertTitle.value = concert.title || '';
        this.elements.editConcertDate.value = concert.date || '';
        this.elements.editConcertTime.value = concert.time || '';
        this.elements.editConcertLocation.value = concert.location || '';
        this.elements.editConcertAddress.value = concert.address || '';
        this.elements.editConcertDescription.value = concert.description || '';
        this.elements.editConcertImageUrl.value = concert.imageUrl || '';
        this.elements.editConcertTicketPrice.value = concert.ticketPrice || '';
        this.elements.editConcertTicketsAvailable.value = concert.ticketsAvailable ?? '';
        this.elements.editConcertDelete.hidden = false;
        this.elements.editConcertModal.hidden = false;

        if (!this.concertEditor && this.elements.editConcertDescription) {
            this.concertEditor = new MarkdownEditor(this.elements.editConcertDescription).init();
        }

        this.elements.editConcertTitle.focus();
    }

    closeEditConcertModal() {
        this.elements.editConcertModal.hidden = true;
        this.editingConcert = null;
    }

    getConcertFormData() {
        return {
            title: this.elements.editConcertTitle.value.trim(),
            date: this.elements.editConcertDate.value,
            time: this.elements.editConcertTime.value.trim(),
            location: this.elements.editConcertLocation.value.trim(),
            address: this.elements.editConcertAddress.value.trim(),
            description: this.elements.editConcertDescription.value.trim(),
            imageUrl: this.elements.editConcertImageUrl.value.trim(),
            ticketPrice: parseInt(this.elements.editConcertTicketPrice.value) || 0,
            ticketsAvailable: parseInt(this.elements.editConcertTicketsAvailable.value) || 100,
        };
    }

    async saveEditConcert() {
        const data = this.getConcertFormData();

        if (!data.title) {
            alert('Vennligst fyll ut tittel.');
            return;
        }
        if (!data.date) {
            alert('Vennligst velg en dato.');
            return;
        }

        this.elements.editConcertSave.disabled = true;
        this.elements.editConcertSave.textContent = 'Lagrer...';

        try {
            if (this.isCreatingConcert) {
                // Create new concert
                const result = await sharePointAPI.createItem('concerts', data);
                const newConcert = { ...data, id: result?.id || Date.now() };
                this.concerts.push(newConcert);
                this.concerts.sort((a, b) => new Date(a.date) - new Date(b.date));
            } else if (this.editingConcert) {
                // Update existing
                await sharePointAPI.updateItem('concerts', this.editingConcert.id, data);
                Object.assign(this.editingConcert, data);
            }

            this.renderConcerts();
            this.closeEditConcertModal();

        } catch (error) {
            console.error('Error saving concert:', error);
            alert('Kunne ikke lagre konserten. Pr\u00f8v igjen.');
        } finally {
            this.elements.editConcertSave.disabled = false;
            this.elements.editConcertSave.textContent = 'Lagre';
        }
    }

    async deleteEditConcert() {
        if (!this.editingConcert) return;

        if (!confirm(`Er du sikker på at du vil slette "${this.editingConcert.title}"?`)) return;

        try {
            try {
                await sharePointAPI.deleteItem('concerts', this.editingConcert.id);
            } catch (apiError) {
                console.log('API delete not available, deleting locally:', apiError.message);
            }

            this.concerts = this.concerts.filter(c => c.id !== this.editingConcert.id);
            this.renderConcerts();
            this.closeEditConcertModal();

        } catch (error) {
            console.error('Error deleting concert:', error);
            alert('Kunne ikke slette konserten. Pr\u00f8v igjen.');
        }
    }

    showLoader() {
        this.elements.loader?.classList.add('active');
    }

    hideLoader() {
        this.elements.loader?.classList.remove('active');
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    parseMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px">')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.+)$/, '<p>$1</p>');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const app = new ConcertsApp();
    app.init();
});

export { ConcertsApp };
export default ConcertsApp;
