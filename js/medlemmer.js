/**
 * Medlemmer - JavaScript
 *
 * Håndterer medlemsside med artikkel og arrangementer med RSVP
 *
 * @module Medlemmer
 * @version 1.0.0
 */

import sharePointAPI from './sharepoint-api.js';
import { initPage, getCurrentMember, getCurrentUserRole, hasRole, ROLES } from './navigation.js';
import badgeManager from './badge-manager.js';
import { MarkdownEditor } from './markdown-editor.js';

// ==========================================================================
// MOCK DATA - Brukes når SharePoint ikke er konfigurert
// ==========================================================================
const MOCK_DATA = {
    article: {
        title: 'Velkommen, kormedlemmer!',
        text: `Her finner du informasjon om kommende arrangementer og aktiviteter i koret.

$picture

Husk å melde deg på arrangementer så vi kan planlegge best mulig. Du kan også se hvem andre som har meldt seg på.

### Viktig informasjon
- **Øvelser**: Tirsdager kl. 19:00–21:30
- **Sted**: Vålerenga kirke
- **Kontakt**: Styret på styret@kammerkoretutsikten.no`,
        format: 'markdown',
        imageUrl: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&q=80',
        imagePlacement: 'angitt'
    },
    events: [
        {
            id: 1,
            title: 'Korøvelse',
            description: 'Vanlig øvelse med fokus på vårkonsert',
            date: '2026-02-10',
            startTime: '18:00',
            endTime: '20:30',
            location: 'Øvingslokalet, Kulturhuset',
            attendees: [
                { name: 'Ola Nordmann', email: 'ola@example.com', status: 'attending' },
                { name: 'Kari Hansen', email: 'kari@example.com', status: 'not_attending' },
                { name: 'Per Olsen', email: 'per@example.com', status: 'attending' }
            ],
            totalMembers: 25
        },
        {
            id: 2,
            title: 'Ekstraøvelse – Vårkonsert',
            description: 'Intensiv gjennomgang av konsertprogrammet. Alle stemmegrupper.',
            date: '2026-03-15',
            startTime: '10:00',
            endTime: '15:00',
            location: 'Vålerenga kirke',
            attendees: [
                { name: 'Ola Nordmann', email: 'ola@example.com', status: 'attending' }
            ],
            totalMembers: 25
        },
        {
            id: 3,
            title: 'Sosial kveld',
            description: 'Uformell sammenkomst med quiz og god mat. Ta med noe å dele!',
            date: '2026-04-05',
            startTime: '18:00',
            endTime: '22:00',
            location: 'Hos Anne, Grünerløkka',
            attendees: [],
            totalMembers: 25
        }
    ]
};

// ==========================================================================
// MEDLEMMER APP
// ==========================================================================
class MedlemmerApp {
    constructor() {
        this.data = null;
        this.member = null;
        this.elements = {};
        this.eventEditor = null;
        this.editingEventId = null;
        this.selectedDates = [];
        this.isStyreOrAdmin = false;
    }

    async init() {
        // Initialiser navigasjon med innloggingskrav
        const result = initPage({ requireAuth: true, requiredRole: 'medlem' });
        if (!result) return; // Omdirigert til login

        this.member = getCurrentMember();
        this.cacheElements();
        this.bindEvents();
        this.setCurrentYear();
        this.populateHiddenFields();

        await this.loadData();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            articleSection: document.getElementById('articleSection'),
            eventsSection: document.getElementById('eventsSection'),
            currentYear: document.getElementById('current-year'),
            // Attendees modal
            modal: document.getElementById('attendeesModal'),
            modalClose: document.getElementById('attendeesModalClose'),
            modalTitle: document.getElementById('attendees-modal-title'),
            modalBody: document.getElementById('attendeesModalBody'),
            // Event modal
            eventModal: document.getElementById('eventModal'),
            eventModalClose: document.getElementById('eventModalClose'),
            eventTitle: document.getElementById('eventTitle'),
            eventDescription: document.getElementById('eventDescription'),
            eventDateInput: document.getElementById('eventDateInput'),
            addDateBtn: document.getElementById('addDateBtn'),
            eventDateList: document.getElementById('eventDateList'),
            eventStartTime: document.getElementById('eventStartTime'),
            eventEndTime: document.getElementById('eventEndTime'),
            eventLocation: document.getElementById('eventLocation'),
            eventSubmit: document.getElementById('eventSubmit'),
            eventCancel: document.getElementById('eventCancel'),
            // Edit article modal
            editArticleModal: document.getElementById('editArticleModal'),
            editArticleModalClose: document.getElementById('editArticleModalClose'),
            editArticleTitle: document.getElementById('editArticleTitle'),
            editArticleContent: document.getElementById('editArticleContent'),
            editArticleFormat: document.getElementById('editArticleFormat'),
            editArticleSave: document.getElementById('editArticleSave'),
            editArticleCancel: document.getElementById('editArticleCancel'),
            // Hidden fields
            memberEmail: document.getElementById('memberEmail'),
            memberName: document.getElementById('memberName')
        };
    }

    populateHiddenFields() {
        if (this.member) {
            if (this.elements.memberEmail) this.elements.memberEmail.value = this.member.email || '';
            if (this.elements.memberName) this.elements.memberName.value = this.member.name || '';
        }
    }

    bindEvents() {
        // Attendees modal events
        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });

        // Event modal events
        this.elements.eventModalClose?.addEventListener('click', () => this.closeEventModal());
        this.elements.eventCancel?.addEventListener('click', () => this.closeEventModal());
        this.elements.eventSubmit?.addEventListener('click', () => this.submitEvent());
        this.elements.eventModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.eventModal) this.closeEventModal();
        });

        // Edit article modal events
        this.elements.editArticleModalClose?.addEventListener('click', () => this.closeEditArticleModal());
        this.elements.editArticleCancel?.addEventListener('click', () => this.closeEditArticleModal());
        this.elements.editArticleSave?.addEventListener('click', () => this.saveArticle());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.elements.editArticleModal?.hidden) {
                    this.closeEditArticleModal();
                } else if (this.elements.modal?.classList.contains('open')) {
                    this.closeModal();
                } else if (!this.elements.eventModal?.hidden) {
                    this.closeEventModal();
                }
            }
        });

        // Delegate click for article edit button
        this.elements.articleSection?.addEventListener('click', (e) => {
            if (e.target.id === 'editArticleBtn') {
                this.openEditArticleModal();
            }
        });
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    useMock() {
        return !window.ENV?.POWER_AUTOMATE_MEMBERS_PAGE_URL;
    }

    async loadData() {
        this.showLoader();

        try {
            let data = null;

            if (!this.useMock()) {
                try {
                    data = await sharePointAPI.getMembersPageData();
                } catch (e) {
                    console.log('Kunne ikke hente fra SharePoint, bruker mock-data', e.message);
                }
            }

            this.data = data || MOCK_DATA;

            if (this.data.article) {
                this.renderArticle(this.data.article);
            }

            if (this.data.events && this.data.events.length > 0) {
                badgeManager.markSeen('medlemmer');
                this.renderEvents(this.data.events);
            }

        } catch (error) {
            console.error('Feil ved lasting av medlemsside:', error);
            this.data = MOCK_DATA;
            this.renderArticle(this.data.article);
            this.renderEvents(this.data.events);
        } finally {
            this.hideLoader();
        }
    }

    // =========================================================================
    // ARTICLE RENDERING
    // =========================================================================

    renderArticle(article) {
        if (!this.elements.articleSection) return;

        const { title, text, format, imageUrl, imagePlacement } = article;

        let contentHtml = this.formatContent(text, format);

        let html = '';

        if (title) {
            html += `<div class="article__title-row">`;
            html += `<h2 class="article__title">${this.escapeHtml(title)}</h2>`;
            if (hasRole(getCurrentUserRole(), ROLES.STYRE)) {
                html += `<button class="edit-btn" id="editArticleBtn" type="button">Rediger</button>`;
            }
            html += `</div>`;
        }

        if (imageUrl && imagePlacement === 'over') {
            html += this.createImageHtml(imageUrl, title);
        }

        if (imageUrl && imagePlacement === 'angitt' && text.includes('$picture')) {
            const parts = contentHtml.split('$picture');
            html += `<div class="article__text">${parts[0]}</div>`;
            html += this.createImageHtml(imageUrl, title);
            if (parts[1]) {
                html += `<div class="article__text">${parts[1]}</div>`;
            }
        } else {
            contentHtml = contentHtml.replace(/\$picture/g, '');
            html += `<div class="article__text">${contentHtml}</div>`;
        }

        if (imageUrl && imagePlacement === 'under') {
            html += this.createImageHtml(imageUrl, title);
        }

        this.elements.articleSection.innerHTML = html;
    }

    createImageHtml(url, alt) {
        return `
            <figure class="article__image">
                <img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(alt || 'Artikkel-bilde')}" loading="lazy">
            </figure>
        `;
    }

    // =========================================================================
    // ARTICLE EDITING
    // =========================================================================

    openEditArticleModal() {
        if (!this.data?.article) return;

        this.elements.editArticleTitle.value = this.data.article.title || '';
        this.elements.editArticleContent.value = this.data.article.text || '';
        this.elements.editArticleFormat.value = this.data.article.format || 'markdown';
        this.elements.editArticleModal.hidden = false;

        if (!this.articleEditor && this.elements.editArticleContent) {
            this.articleEditor = new MarkdownEditor(this.elements.editArticleContent).init();
        }

        this.elements.editArticleTitle.focus();
    }

    closeEditArticleModal() {
        this.elements.editArticleModal.hidden = true;
    }

    async saveArticle() {
        const title = this.elements.editArticleTitle.value.trim();
        const text = this.elements.editArticleContent.value.trim();
        const format = this.elements.editArticleFormat.value;

        if (!title || !text) {
            alert('Vennligst fyll ut tittel og innhold.');
            return;
        }

        this.elements.editArticleSave.disabled = true;
        this.elements.editArticleSave.textContent = 'Lagrer...';

        try {
            try {
                await sharePointAPI.updateItem('articles', this.data.article.id || 'members', {
                    title, text, format
                });
            } catch (apiError) {
                console.log('API update not available, updating locally:', apiError.message);
            }

            this.data.article.title = title;
            this.data.article.text = text;
            this.data.article.format = format;
            this.renderArticle(this.data.article);
            this.closeEditArticleModal();
        } catch (error) {
            console.error('Error saving article:', error);
            alert('Kunne ikke lagre artikkelen. Prøv igjen.');
        } finally {
            this.elements.editArticleSave.disabled = false;
            this.elements.editArticleSave.textContent = 'Lagre';
        }
    }

    formatContent(text, format) {
        if (!text) return '';

        switch (format?.toLowerCase()) {
            case 'html':
                return text;
            case 'markdown':
                return this.parseMarkdown(text);
            case 'text':
            default:
                return this.textToHtml(text);
        }
    }

    parseMarkdown(text) {
        let html = this.escapeHtml(text);

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

        // Bold og italic
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Bilder (må komme før lenker)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');

        // Lenker
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Unordered lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Paragraphs
        html = html.split(/\n\n+/).map(p => {
            if (p.startsWith('<h') || p.startsWith('$picture') || p.startsWith('<ul>')) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');

        return html;
    }

    textToHtml(text) {
        const escaped = this.escapeHtml(text);
        return escaped.split(/\n\n+/).map(p => {
            if (p.trim().startsWith('$picture')) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');
    }

    // =========================================================================
    // EVENTS RENDERING
    // =========================================================================

    renderEvents(events) {
        if (!this.elements.eventsSection) return;
        events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        this.isStyreOrAdmin = hasRole(getCurrentUserRole(), ROLES.STYRE);
        const newEventBtn = this.isStyreOrAdmin
            ? '<button class="new-post-btn" id="newEventBtn">✏️ Nytt arrangement</button>'
            : '';

        let html = `<div class="events-header__top">
            <h2 class="events-section-title" style="margin:0">Arrangementer</h2>
            ${newEventBtn}
        </div>`;
        html += '<div class="events-grid">';
        html += events.map(event => this.createEventCard(event)).join('');
        html += '</div>';

        this.elements.eventsSection.innerHTML = html;

        // Bind new event button
        const btn = this.elements.eventsSection.querySelector('#newEventBtn');
        btn?.addEventListener('click', () => this.openEventModal());

        // Bind event handlers
        this.elements.eventsSection.querySelectorAll('.event-card__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const eventId = parseInt(btn.dataset.eventId);
                const action = btn.dataset.action;
                this.handleAttendance(eventId, action);
            });
        });

        // Bind edit/delete buttons
        this.elements.eventsSection.querySelectorAll('.edit-event-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const eventId = parseInt(btn.dataset.eventId);
                this.openEditEventModal(eventId);
            });
        });

        this.elements.eventsSection.querySelectorAll('.delete-event-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteEvent(btn.dataset.eventId);
            });
        });

        this.elements.eventsSection.querySelectorAll('.event-card__stat-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const eventId = toggle.dataset.eventId;
                const status = toggle.dataset.status;
                const list = this.elements.eventsSection.querySelector(
                    `.event-card__stat-list[data-event-id="${eventId}"][data-list="${status}"]`
                );
                if (!list) return;

                const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!isExpanded));
                list.classList.toggle('event-card__stat-list--expanded');
            });
        });
    }

    createEventCard(event) {
        const date = new Date(event.date);
        const day = date.getDate();
        const month = date.toLocaleDateString('no-NO', { month: 'short' });

        const timeStr = event.startTime && event.endTime
            ? `${event.startTime} – ${event.endTime}`
            : event.startTime || '';

        // Count statuses
        const attending = event.attendees.filter(a => a.status === 'attending');
        const notAttending = event.attendees.filter(a => a.status === 'not_attending');
        const notResponded = event.totalMembers - attending.length - notAttending.length;

        // Check current user's status
        const memberEmail = this.member?.email?.toLowerCase();
        const userAttendee = event.attendees.find(a => a.email?.toLowerCase() === memberEmail);
        const userStatus = userAttendee?.status || null;

        const attendingActive = userStatus === 'attending' ? ' event-card__btn--active' : '';
        const notAttendingActive = userStatus === 'not_attending' ? ' event-card__btn--active' : '';

        // Build attendee name lists
        const attendingNames = attending.map(a => `<li>${this.escapeHtml(a.name)}</li>`).join('');
        const notAttendingNames = notAttending.map(a => `<li>${this.escapeHtml(a.name)}</li>`).join('');

        return `
            <article class="event-card">
                <div class="event-card__header">
                    <div class="event-card__date-box">
                        <span class="event-card__date-day">${day}</span>
                        <span class="event-card__date-month">${month}</span>
                    </div>
                    <div class="event-card__info">
                        <h3 class="event-card__title">${this.escapeHtml(event.title)}</h3>
                        <div class="event-card__meta">
                            ${timeStr ? `
                            <div class="event-card__meta-item">
                                <span class="event-card__meta-icon">🕐</span>
                                <span>${this.escapeHtml(timeStr)}</span>
                            </div>
                            ` : ''}
                            ${event.location ? `
                            <div class="event-card__meta-item">
                                <span class="event-card__meta-icon">📍</span>
                                <span>${this.escapeHtml(event.location)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                ${event.description ? `
                <div class="event-card__body">
                    <p class="event-card__description">${this.escapeHtml(event.description)}</p>
                </div>
                ` : ''}

                ${this.isStyreOrAdmin ? `
                <div class="event-card__admin-actions" style="padding: 0 var(--space-lg)">
                    <button class="edit-btn edit-event-btn" data-event-id="${event.id}">Rediger</button>
                    <button class="edit-btn delete-btn delete-event-btn" data-event-id="${event.id}">Slett</button>
                </div>
                ` : ''}

                <div class="event-card__actions">
                    <button class="event-card__btn event-card__btn--attending${attendingActive}"
                            data-event-id="${event.id}" data-action="attending">
                        Deltar
                    </button>
                    <button class="event-card__btn event-card__btn--not-attending${notAttendingActive}"
                            data-event-id="${event.id}" data-action="not_attending">
                        Deltar ikke
                    </button>
                </div>

                <div class="event-card__stats">
                    <button class="event-card__stat-toggle" data-event-id="${event.id}" data-status="attending"
                            aria-expanded="false" type="button">
                        <span class="event-card__stat-chevron">&#9654;</span>
                        <span class="event-card__stat-indicator event-card__stat-indicator--attending">&#10003;</span>
                        <span>${attending.length} deltar</span>
                    </button>
                    <div class="event-card__stat-list" data-event-id="${event.id}" data-list="attending">
                        ${attendingNames ? `<ul>${attendingNames}</ul>` : '<p class="event-card__stat-empty">Ingen ennå</p>'}
                    </div>

                    <button class="event-card__stat-toggle" data-event-id="${event.id}" data-status="not_attending"
                            aria-expanded="false" type="button">
                        <span class="event-card__stat-chevron">&#9654;</span>
                        <span class="event-card__stat-indicator event-card__stat-indicator--not-attending">&#10007;</span>
                        <span>${notAttending.length} deltar ikke</span>
                    </button>
                    <div class="event-card__stat-list" data-event-id="${event.id}" data-list="not_attending">
                        ${notAttendingNames ? `<ul>${notAttendingNames}</ul>` : '<p class="event-card__stat-empty">Ingen ennå</p>'}
                    </div>

                    <span class="event-card__stat-info">
                        <span class="event-card__stat-indicator event-card__stat-indicator--not-responded">?</span>
                        <span>${notResponded} ikke svart</span>
                    </span>
                </div>
            </article>
        `;
    }

    // =========================================================================
    // EVENT CREATION MODAL
    // =========================================================================

    openEventModal() {
        this.editingEventId = null;
        this.elements.eventTitle.value = '';
        this.elements.eventDescription.value = '';
        this.elements.eventDateInput.value = '';
        this.selectedDates = [];
        this.renderDateList();
        this.elements.eventStartTime.value = '';
        this.elements.eventEndTime.value = '';
        this.elements.eventLocation.value = '';
        this.elements.eventSubmit.textContent = 'Opprett arrangement';
        this.elements.eventModal.hidden = false;

        // Update modal header
        const header = this.elements.eventModal.querySelector('.post-modal-header h3');
        if (header) header.textContent = 'Nytt arrangement';

        // Bind add-date button
        this.elements.addDateBtn.onclick = () => this.addDate();

        // Initialize markdown editor on first open
        if (!this.eventEditor && this.elements.eventDescription) {
            this.eventEditor = new MarkdownEditor(this.elements.eventDescription).init();
        }

        this.elements.eventTitle.focus();
    }

    openEditEventModal(eventId) {
        const event = this.data?.events?.find(e => e.id === eventId);
        if (!event) return;

        this.editingEventId = eventId;
        this.elements.eventTitle.value = event.title || '';
        this.elements.eventDescription.value = event.description || '';
        this.selectedDates = event.date ? [event.date] : [];
        this.renderDateList();
        this.elements.eventDateInput.value = '';
        this.elements.eventStartTime.value = event.startTime || '';
        this.elements.eventEndTime.value = event.endTime || '';
        this.elements.eventLocation.value = event.location || '';
        this.elements.eventSubmit.textContent = 'Lagre endringer';
        this.elements.eventModal.hidden = false;

        // Update modal header
        const header = this.elements.eventModal.querySelector('.post-modal-header h3');
        if (header) header.textContent = 'Rediger arrangement';

        // Bind add-date button
        this.elements.addDateBtn.onclick = () => this.addDate();

        // Initialize markdown editor on first open
        if (!this.eventEditor && this.elements.eventDescription) {
            this.eventEditor = new MarkdownEditor(this.elements.eventDescription).init();
        }

        this.elements.eventTitle.focus();
    }

    closeEventModal() {
        this.elements.eventModal.hidden = true;
        this.editingEventId = null;
    }

    addDate() {
        const dateValue = this.elements.eventDateInput.value;
        if (!dateValue) return;
        if (this.selectedDates.includes(dateValue)) {
            this.elements.eventDateInput.value = '';
            return;
        }
        this.selectedDates.push(dateValue);
        this.selectedDates.sort();
        this.elements.eventDateInput.value = '';
        this.renderDateList();
    }

    renderDateList() {
        const ul = this.elements.eventDateList;
        if (!ul) return;
        ul.innerHTML = this.selectedDates.map((d, i) => {
            const formatted = new Date(d + 'T00:00:00').toLocaleDateString('nb-NO', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            });
            return `<li>${formatted}<button type="button" class="date-remove-btn" data-index="${i}" title="Fjern">✕</button></li>`;
        }).join('');
        ul.querySelectorAll('.date-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedDates.splice(parseInt(btn.dataset.index), 1);
                this.renderDateList();
            });
        });
    }

    async submitEvent() {
        const title = this.elements.eventTitle.value.trim();

        if (!title || this.selectedDates.length === 0) {
            alert('Vennligst fyll ut tittel og minst én dato.');
            return;
        }

        if (!this.member) {
            alert('Du må være logget inn for å opprette arrangementer.');
            return;
        }

        // Disable submit button
        this.elements.eventSubmit.disabled = true;

        // --- EDIT existing event ---
        if (this.editingEventId) {
            this.elements.eventSubmit.textContent = 'Lagrer...';

            const updatedData = {
                title: title,
                description: this.elements.eventDescription.value.trim(),
                date: this.selectedDates[0],
                startTime: this.elements.eventStartTime.value || '',
                endTime: this.elements.eventEndTime.value || '',
                location: this.elements.eventLocation.value.trim()
            };

            try {
                try {
                    await sharePointAPI.updateItem('membersPage', this.editingEventId, updatedData);
                } catch (apiError) {
                    console.log('API update not available, updating locally:', apiError.message);
                }

                const event = this.data.events.find(e => e.id === this.editingEventId);
                if (event) {
                    Object.assign(event, updatedData);
                }

                this.renderEvents(this.data.events);
                this.closeEventModal();
                this.showToast('Arrangement oppdatert!', 'success');

            } catch (error) {
                console.error('Error updating event:', error);
                alert('Kunne ikke lagre endringer. Prøv igjen.');
            } finally {
                this.elements.eventSubmit.disabled = false;
                this.elements.eventSubmit.textContent = 'Lagre endringer';
            }
            return;
        }

        // --- CREATE new event(s) ---
        const dateCount = this.selectedDates.length;
        const plural = dateCount > 1;
        this.elements.eventSubmit.textContent = plural
            ? `Oppretter ${dateCount} arrangementer...`
            : 'Oppretter...';

        const description = this.elements.eventDescription.value.trim();
        const startTime = this.elements.eventStartTime.value || '';
        const endTime = this.elements.eventEndTime.value || '';
        const location = this.elements.eventLocation.value.trim();
        const totalMembers = this.data?.events?.[0]?.totalMembers || 0;

        const newEvents = [];

        try {
            for (const date of this.selectedDates) {
                const newEvent = {
                    id: Date.now() + newEvents.length,
                    title, description, date, startTime, endTime, location,
                    attendees: [],
                    totalMembers
                };

                if (this.useMock()) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    const result = await sharePointAPI.createEvent({
                        title, description, date, startTime, endTime, location,
                        authorName: this.member.name,
                        authorEmail: this.member.email
                    });

                    if (!result.success) {
                        throw new Error(result.error || 'Kunne ikke opprette arrangement');
                    }

                    newEvent.id = result.id || newEvent.id;
                }

                newEvents.push(newEvent);
            }

            // Add to local data and re-render
            if (!this.data.events) this.data.events = [];
            this.data.events.push(...newEvents);
            this.renderEvents(this.data.events);
            this.closeEventModal();
            this.showToast(
                plural ? `${dateCount} arrangementer opprettet!` : 'Arrangement opprettet!',
                'success'
            );

        } catch (error) {
            console.error('Error creating event:', error);
            alert('Kunne ikke opprette arrangement. Prøv igjen.');
        } finally {
            this.elements.eventSubmit.disabled = false;
            this.elements.eventSubmit.textContent = 'Opprett arrangement';
        }
    }

    async deleteEvent(eventId) {
        const event = this.data?.events?.find(e => String(e.id) === String(eventId));
        if (!event) return;

        if (!confirm(`Er du sikker på at du vil slette "${event.title}"?`)) return;

        try {
            if (!this.useMock()) {
                const deleteUrl = `${window.ENV?.POWER_AUTOMATE_CREATE_EVENT_URL}/${eventId}`;
                const response = await fetch(deleteUrl, { method: 'DELETE' });
                if (!response.ok) console.warn('API delete feilet:', response.status);
            }

            this.data.events = this.data.events.filter(e => String(e.id) !== String(eventId));
            this.renderEvents(this.data.events);
            this.showToast('Arrangement slettet', 'success');

        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Kunne ikke slette arrangementet. Prøv igjen.');
        }
    }

    // =========================================================================
    // ATTENDANCE HANDLING
    // =========================================================================

    async handleAttendance(eventId, action) {
        if (!this.member) {
            this.showToast('Du må være innlogget for å melde deg på', 'error');
            return;
        }

        const event = this.data.events.find(e => e.id === eventId);
        if (!event) return;

        // Optimistic UI update
        const memberEmail = this.member.email.toLowerCase();
        const existingIndex = event.attendees.findIndex(a => a.email?.toLowerCase() === memberEmail);

        if (existingIndex >= 0) {
            event.attendees[existingIndex].status = action;
        } else {
            event.attendees.push({
                name: this.member.name,
                email: this.member.email,
                status: action
            });
        }

        // Re-render events
        this.renderEvents(this.data.events);

        // Send to API
        try {
            if (!this.useMock()) {
                await sharePointAPI.submitEventRsvp(eventId, action, {
                    name: this.member.name,
                    email: this.member.email
                });
            }

            const statusText = action === 'attending' ? 'Registrert som deltaker' : 'Registrert som ikke-deltaker';
            this.showToast(statusText, 'success');

        } catch (error) {
            console.error('Feil ved registrering:', error);
            this.showToast('Kunne ikke registrere. Prøv igjen.', 'error');

            // Revert on error
            if (existingIndex >= 0) {
                // Can't know previous state, remove the entry
                event.attendees.splice(existingIndex, 1);
            } else {
                event.attendees.pop();
            }
            this.renderEvents(this.data.events);
        }
    }

    // =========================================================================
    // MODAL
    // =========================================================================

    openAttendeesModal(eventId, status) {
        const event = this.data.events.find(e => e.id === eventId);
        if (!event) return;

        let title = '';
        let names = [];

        if (status === 'attending') {
            title = 'Deltar';
            names = event.attendees
                .filter(a => a.status === 'attending')
                .map(a => a.name);
        } else if (status === 'not_attending') {
            title = 'Deltar ikke';
            names = event.attendees
                .filter(a => a.status === 'not_attending')
                .map(a => a.name);
        } else {
            title = 'Ikke svart';
            const respondedEmails = new Set(event.attendees.map(a => a.email?.toLowerCase()));
            // We don't have the full member list, so show count
            const notRespondedCount = event.totalMembers - event.attendees.length;
            names = [];
            if (notRespondedCount > 0) {
                this.elements.modalBody.innerHTML = `
                    <p class="attendees-modal__empty">${notRespondedCount} medlemmer har ikke svart ennå</p>
                `;
                this.elements.modalTitle.textContent = `${title} – ${event.title}`;
                this.elements.modal.classList.add('open');
                this.elements.modal.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
                return;
            }
        }

        this.elements.modalTitle.textContent = `${title} – ${event.title}`;

        if (names.length === 0) {
            this.elements.modalBody.innerHTML = `
                <p class="attendees-modal__empty">Ingen i denne listen</p>
            `;
        } else {
            this.elements.modalBody.innerHTML = `
                <ul class="attendees-modal__list">
                    ${names.map(name => `<li class="attendees-modal__item">${this.escapeHtml(name)}</li>`).join('')}
                </ul>
            `;
        }

        this.elements.modal.classList.add('open');
        this.elements.modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.elements.modal?.classList.remove('open');
        this.elements.modal?.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    showToast(message, type = 'success') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast--visible');
        });

        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const app = new MedlemmerApp();
    app.init();
});

export { MedlemmerApp };
export default MedlemmerApp;
