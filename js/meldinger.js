/**
 * Meldinger - JavaScript
 *
 * Viser meldinger fra styret med søk og lazy loading
 *
 * @module Meldinger
 * @version 2.0.0
 */

import { initPage, getCurrentMember, getCurrentUserRole, hasRole, ROLES } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';
import badgeManager from './badge-manager.js';
import { parseMarkdown } from './parse-markdown.js';
import { MarkdownEditor } from './markdown-editor.js';

// ==========================================================================
// CONFIGURATION
// ==========================================================================

const MESSAGES_PER_PAGE = 5;

// Mock mode for testing - evalueres lazy for å sikre at env.js har lastet
const useMock = () => !window.ENV?.POWER_AUTOMATE_MESSAGES_URL;

// Mock data
const MOCK_MESSAGES = [
    {
        id: '1',
        title: 'Velkommen til nytt semester!',
        author: 'Styret',
        publishedAt: '2026-01-20',
        isImportant: false,
        isPinned: false,
        commentCount: 2,
        format: 'markdown',
        content: `Kjære kormedlemmer,

Vi ønsker alle velkommen til et nytt og spennende semester!

## Viktige datoer

- **27. januar**: Første øvelse
- **15. mars**: Vårkonsert
- **1. mai**: Nasjonaldagen

## Nytt denne sesongen

Vi har gleden av å ønske velkommen **3 nye medlemmer** i koret:
- Anna i sopran
- Per i tenor
- Lise i alt

Ta godt imot dem!

Med vennlig hilsen,
*Styret*`,
        imageUrl: '',
        comments: [
            {
                id: 'c1',
                author: 'Kari Nordmann',
                email: 'kari@test.no',
                createdAt: '2026-01-21T10:30:00',
                text: 'Så spennende med nytt semester! Gleder meg veldig til vårkonserten.'
            },
            {
                id: 'c2',
                author: 'Ola Hansen',
                email: 'ola@test.no',
                createdAt: '2026-01-21T14:15:00',
                text: 'Velkommen til de nye medlemmene!'
            }
        ]
    },
    {
        id: '2',
        title: 'Påminnelse: Kontingent forfaller snart',
        author: 'Styret',
        publishedAt: '2026-01-18',
        isImportant: false,
        isPinned: false,
        commentCount: 0,
        format: 'html',
        content: `<p>Husk at kontingenten for vårsemesteret forfaller <strong>1. februar</strong>.</p>
<p>Beløp: <strong>500 kr</strong></p>
<p>Kontonummer: 1234.56.78901</p>
<p>Merk betalingen med ditt navn.</p>
<p>Spørsmål? Kontakt kasserer på <a href="mailto:kasserer@utsikten.no">kasserer@utsikten.no</a></p>`,
        imageUrl: '',
        comments: []
    },
    {
        id: '3',
        title: 'Bilder fra julekonserten',
        author: 'Styret',
        publishedAt: '2026-01-10',
        isImportant: false,
        isPinned: false,
        commentCount: 1,
        format: 'text',
        content: `Takk for en fantastisk julekonsert!

Bildene fra konserten er nå tilgjengelige i vårt fotoalbum.

Fotografen har gjort en flott jobb med å fange stemningen fra kvelden. Spesielt bildene fra "O Helga Natt" ble veldig fine.

Del gjerne bildene med familie og venner!`,
        imageUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800',
        comments: [
            {
                id: 'c3',
                author: 'Anne Olsen',
                email: 'anne@test.no',
                createdAt: '2026-01-11T09:00:00',
                text: 'Fantastiske bilder! Takk til fotografen.'
            }
        ]
    },
    {
        id: '4',
        title: 'Endring i øvelsestidspunkt',
        author: 'Styret',
        publishedAt: '2026-01-05',
        isImportant: false,
        isPinned: false,
        commentCount: 1,
        format: 'text',
        content: `Fra og med februar endres øvelsestidspunktet fra kl. 19:00 til kl. 18:30. Dette er for å gi oss litt mer tid til oppvarming og innstudering.

Øvelsen slutter fortsatt kl. 21:30.

Husk å oppdatere kalenderne deres!`,
        imageUrl: '',
        comments: [
            {
                id: 'c10',
                author: 'Per Johansen',
                email: 'per@test.no',
                createdAt: '2026-01-06T08:45:00',
                text: 'Fint at vi får mer tid til oppvarming!'
            }
        ]
    },
    {
        id: '5',
        title: 'Nytt notehefte er klart',
        author: 'Styret',
        publishedAt: '2025-12-20',
        isImportant: false,
        isPinned: false,
        commentCount: 2,
        format: 'markdown',
        content: `Det nye noteheftet for vårsemesteret er nå klart for nedlasting i **Øvelse**-seksjonen.

Heftet inneholder:
1. Ubi Caritas (Gjeilo)
2. Northern Lights (Ola Gjeilo)
3. Lift Me Up
4. Bruremarsj fra Valsøyfjord

> Tips: Last ned notene før første øvelse slik at du kan se gjennom dem på forhånd.`,
        imageUrl: '',
        comments: [
            {
                id: 'c11',
                author: 'Lisa Berg',
                email: 'lisa@test.no',
                createdAt: '2025-12-21T11:20:00',
                text: 'Ubi Caritas er så vakker! Gleder meg til å synge den.'
            },
            {
                id: 'c12',
                author: 'Erik Svendsen',
                email: 'erik@test.no',
                createdAt: '2025-12-21T15:30:00',
                text: 'Fint at notene er klare så tidlig. Da rekker jeg å øve litt i jula.'
            }
        ]
    },
    {
        id: '6',
        title: 'Julebord 2025 - Tusen takk!',
        author: 'Styret',
        publishedAt: '2025-12-15',
        isImportant: false,
        isPinned: false,
        commentCount: 0,
        format: 'text',
        content: `For et fantastisk julebord! Takk til alle som bidro til en minneverdig kveld.

Spesiell takk til festkomiteen som arrangerte alt fra mat til underholdning. Loddsalget innbrakte hele 3500 kr til turkassen!

Vi gleder oss allerede til neste år.`,
        imageUrl: 'https://images.unsplash.com/photo-1482575832494-771f74bf6857?w=800',
        comments: []
    },
    {
        id: '7',
        title: 'Dugnad på øvingslokalet',
        author: 'Styret',
        publishedAt: '2025-12-01',
        isImportant: false,
        isPinned: false,
        commentCount: 0,
        format: 'html',
        content: `<p>Lørdag 7. desember arrangerer vi <strong>dugnad</strong> på øvingslokalet.</p>
<p>Vi trenger hjelp til:</p>
<ul>
<li>Rydding og vask</li>
<li>Organisering av noter</li>
<li>Opphenging av juledekorasjoner</li>
</ul>
<p>Påmelding til <a href="mailto:styret@utsikten.no">styret@utsikten.no</a> innen 5. desember.</p>
<p><em>Pizza blir servert!</em></p>`,
        imageUrl: '',
        comments: []
    },
    {
        id: '8',
        title: 'Høstkonserten var en suksess',
        author: 'Styret',
        publishedAt: '2025-11-20',
        isImportant: false,
        isPinned: false,
        commentCount: 0,
        format: 'text',
        content: `Høstkonserten samlet over 200 publikummere og var utsolgt!

Tilbakemeldingene har vært overveldende positive. Flere har spesielt nevnt "Northern Lights" som et høydepunkt.

Inntektene fra konserten går til innkjøp av nytt lydanlegg til øvingslokalet.`,
        imageUrl: '',
        comments: []
    }
];

// parseMarkdown is now imported from parse-markdown.js

// ==========================================================================
// MESSAGES APP
// ==========================================================================
class MessagesApp {
    constructor() {
        this.messages = [];
        this.filteredMessages = [];
        this.displayedCount = 0;
        this.searchQuery = '';
        this.currentCommentMessageId = null;
        this.editingMessageId = null;
        this.meldingEditor = null;
        this.isStyreOrAdmin = false;

        this.elements = {};
    }

    async init() {
        // Initialiser side med innloggingskrav
        const pageInit = initPage({ requireAuth: true });
        if (!pageInit) return;

        this.cacheElements();

        // Vis opprett-knapp for styre/admin
        this.isStyreOrAdmin = hasRole(getCurrentUserRole(), ROLES.STYRE);
        if (this.isStyreOrAdmin) {
            if (this.elements.newMeldingBtn) {
                this.elements.newMeldingBtn.hidden = false;
            }
        }

        this.bindEvents();
        await this.loadMessages();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            meldingerList: document.getElementById('meldingerList'),
            searchInput: document.getElementById('searchInput'),
            loadMoreBtn: document.getElementById('loadMoreBtn'),
            loadMoreContainer: document.getElementById('loadMoreContainer'),
            emptyState: document.getElementById('emptyState'),
            emptyText: document.getElementById('emptyText'),
            // New message
            newMeldingBtn: document.getElementById('newMeldingBtn'),
            meldingModal: document.getElementById('meldingModal'),
            meldingModalClose: document.getElementById('meldingModalClose'),
            meldingTitle: document.getElementById('meldingTitle'),
            meldingContent: document.getElementById('meldingContent'),
            meldingSubmit: document.getElementById('meldingSubmit'),
            meldingCancel: document.getElementById('meldingCancel'),
            // Comment modal
            commentModal: document.getElementById('commentModal'),
            commentModalClose: document.getElementById('commentModalClose'),
            commentText: document.getElementById('commentText'),
            commentSubmit: document.getElementById('commentSubmit'),
            commentCancel: document.getElementById('commentCancel')
        };
    }

    bindEvents() {
        // Search input with debounce
        let searchTimeout;
        this.elements.searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                this.filterAndRender();
            }, 300);
        });

        // Load more button
        this.elements.loadMoreBtn?.addEventListener('click', () => {
            this.displayMore();
        });

        // New message button
        this.elements.newMeldingBtn?.addEventListener('click', () => this.openMeldingModal());

        // Message modal events
        this.elements.meldingModalClose?.addEventListener('click', () => this.closeMeldingModal());
        this.elements.meldingCancel?.addEventListener('click', () => this.closeMeldingModal());
        this.elements.meldingSubmit?.addEventListener('click', () => this.submitMelding());

        // Close message modal on backdrop click
        this.elements.meldingModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.meldingModal) {
                this.closeMeldingModal();
            }
        });

        // Comment modal events
        this.elements.commentModalClose?.addEventListener('click', () => this.closeCommentModal());
        this.elements.commentCancel?.addEventListener('click', () => this.closeCommentModal());
        this.elements.commentSubmit?.addEventListener('click', () => this.submitComment());

        // Close comment modal on backdrop click
        this.elements.commentModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.commentModal) {
                this.closeCommentModal();
            }
        });

        // Close modals on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.elements.meldingModal?.hidden) {
                    this.closeMeldingModal();
                }
                if (!this.elements.commentModal?.hidden) {
                    this.closeCommentModal();
                }
            }
        });
    }

    // ==========================================================================
    // MESSAGE MODAL (CREATE / EDIT)
    // ==========================================================================
    openMeldingModal() {
        this.editingMessageId = null;
        this.elements.meldingTitle.value = '';
        this.elements.meldingContent.value = '';
        this.elements.meldingSubmit.textContent = 'Publiser melding';
        this.elements.meldingModal.hidden = false;

        // Update modal header
        const header = this.elements.meldingModal.querySelector('.post-modal-header h3');
        if (header) header.textContent = 'Ny melding fra styret';

        // Initialize markdown editor on first open
        if (!this.meldingEditor && this.elements.meldingContent) {
            this.meldingEditor = new MarkdownEditor(this.elements.meldingContent).init();
        }

        this.elements.meldingTitle.focus();
    }

    openEditMessageModal(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        this.editingMessageId = messageId;
        this.elements.meldingTitle.value = message.title || '';
        this.elements.meldingContent.value = message.content || '';
        this.elements.meldingSubmit.textContent = 'Lagre endringer';
        this.elements.meldingModal.hidden = false;

        // Update modal header
        const header = this.elements.meldingModal.querySelector('.post-modal-header h3');
        if (header) header.textContent = 'Rediger melding';

        // Initialize markdown editor on first open
        if (!this.meldingEditor && this.elements.meldingContent) {
            this.meldingEditor = new MarkdownEditor(this.elements.meldingContent).init();
        }

        this.elements.meldingTitle.focus();
    }

    closeMeldingModal() {
        this.elements.meldingModal.hidden = true;
        this.editingMessageId = null;
    }

    async submitMelding() {
        const title = this.elements.meldingTitle.value.trim();
        const content = this.elements.meldingContent.value.trim();

        if (!title || !content) {
            alert('Vennligst fyll ut både tittel og innhold.');
            return;
        }

        const member = getCurrentMember();
        if (!member) {
            alert('Du må være logget inn for å opprette meldinger.');
            return;
        }

        // Disable submit button
        this.elements.meldingSubmit.disabled = true;

        // --- EDIT existing message ---
        if (this.editingMessageId) {
            this.elements.meldingSubmit.textContent = 'Lagrer...';

            try {
                try {
                    await sharePointAPI.updateItem('messages', this.editingMessageId, { title, content });
                } catch (apiError) {
                    console.log('API update not available, updating locally:', apiError.message);
                }

                const msg = this.messages.find(m => m.id === this.editingMessageId);
                if (msg) {
                    msg.title = title;
                    msg.content = content;
                }

                this.filterAndRender();
                this.closeMeldingModal();

            } catch (error) {
                console.error('Error updating message:', error);
                alert('Kunne ikke lagre endringer. Prøv igjen.');
            } finally {
                this.elements.meldingSubmit.disabled = false;
                this.elements.meldingSubmit.textContent = 'Lagre endringer';
            }
            return;
        }

        // --- CREATE new message ---
        this.elements.meldingSubmit.textContent = 'Publiserer...';

        const newMessage = {
            id: 'm' + Date.now(),
            title: title,
            content: content,
            format: 'markdown',
            author: member.name || 'Styret',
            publishedAt: new Date().toISOString().split('T')[0],
            imageUrl: '',
            isImportant: false,
            isPinned: false,
            commentCount: 0,
            comments: []
        };

        try {
            if (useMock()) {
                await new Promise(resolve => setTimeout(resolve, 500));
                this.messages.unshift(newMessage);
            } else {
                const result = await sharePointAPI.createMessage({
                    title: newMessage.title,
                    content: newMessage.content,
                    authorName: member.name,
                    authorEmail: member.email
                });

                if (!result.success) {
                    throw new Error(result.error || 'Kunne ikke publisere melding');
                }

                newMessage.id = result.id || newMessage.id;
                this.messages.unshift(newMessage);
            }

            this.filterAndRender();
            this.closeMeldingModal();

        } catch (error) {
            console.error('Error submitting message:', error);
            alert('Kunne ikke publisere melding. Prøv igjen.');
        } finally {
            this.elements.meldingSubmit.disabled = false;
            this.elements.meldingSubmit.textContent = 'Publiser melding';
        }
    }

    async deleteMessage(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        if (!confirm(`Er du sikker på at du vil slette meldingen "${message.title}"?`)) return;

        try {
            try {
                await sharePointAPI.deleteItem('messages', messageId);
            } catch (apiError) {
                console.log('API delete not available, deleting locally:', apiError.message);
            }

            this.messages = this.messages.filter(m => m.id !== messageId);
            this.filterAndRender();

        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Kunne ikke slette meldingen. Prøv igjen.');
        }
    }

    // ==========================================================================
    // DATA LOADING
    // ==========================================================================
    async loadMessages() {
        this.showLoader();

        try {
            if (useMock()) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 500));
                this.messages = [...MOCK_MESSAGES];
            } else {
                // Bruk SharePoint API
                this.messages = await sharePointAPI.getMessages();
            }

            // Sort by date (newest first)
            this.messages.sort((a, b) =>
                new Date(b.publishedAt) - new Date(a.publishedAt)
            );

            badgeManager.markSeen('meldinger');
            this.filterAndRender();

        } catch (error) {
            console.error('Error loading messages:', error);
            // Fallback til mock-data ved feil
            this.messages = [...MOCK_MESSAGES];
            this.filterAndRender();
            console.warn('Bruker mock-data som fallback');
        } finally {
            this.hideLoader();
        }
    }

    // ==========================================================================
    // FILTERING & RENDERING
    // ==========================================================================
    filterAndRender() {
        // Filter messages based on search query
        if (this.searchQuery) {
            this.filteredMessages = this.messages.filter(msg => {
                const titleMatch = msg.title.toLowerCase().includes(this.searchQuery);
                const contentMatch = this.getPlainText(msg).toLowerCase().includes(this.searchQuery);
                return titleMatch || contentMatch;
            });
        } else {
            this.filteredMessages = [...this.messages];
        }

        // Reset display count
        this.displayedCount = 0;

        // Clear list
        this.elements.meldingerList.innerHTML = '';

        // Show messages or empty state
        if (this.filteredMessages.length === 0) {
            if (this.searchQuery) {
                this.showEmpty(`Ingen meldinger matcher "${this.searchQuery}"`);
            } else {
                this.showEmpty('Ingen meldinger å vise');
            }
        } else {
            this.hideEmpty();
            this.displayMore();
        }
    }

    displayMore() {
        const startIndex = this.displayedCount;
        const endIndex = Math.min(startIndex + MESSAGES_PER_PAGE, this.filteredMessages.length);

        for (let i = startIndex; i < endIndex; i++) {
            const messageEl = this.createMessageElement(this.filteredMessages[i]);
            this.elements.meldingerList.appendChild(messageEl);
        }

        this.displayedCount = endIndex;

        // Show/hide load more button
        if (this.displayedCount < this.filteredMessages.length) {
            this.elements.loadMoreContainer.hidden = false;
        } else {
            this.elements.loadMoreContainer.hidden = true;
        }
    }

    createMessageElement(message) {
        const article = document.createElement('article');
        article.className = 'melding-card';
        article.dataset.messageId = message.id;

        // Image (optional)
        let imageHtml = '';
        if (message.imageUrl) {
            imageHtml = `<img src="${this.escapeHtml(message.imageUrl)}" alt="" class="melding-image" loading="lazy">`;
        }

        // Format content
        let contentHtml = this.formatContent(message);

        // Highlight search terms
        if (this.searchQuery) {
            contentHtml = this.highlightSearch(contentHtml, this.searchQuery);
        }

        // Format date
        const dateStr = this.formatDate(message.publishedAt);

        // Title with search highlight
        let titleHtml = this.escapeHtml(message.title);
        if (this.searchQuery) {
            titleHtml = this.highlightSearch(titleHtml, this.searchQuery);
        }

        // Comments count
        const comments = message.comments || [];
        const commentCount = comments.length;
        const commentCountHtml = commentCount > 0 ? `<span class="count">${commentCount}</span>` : '';

        // Edit/delete buttons for styre/admin
        const adminActions = this.isStyreOrAdmin ? `
            <div class="melding-admin-actions">
                <button class="edit-btn edit-message-btn" data-message-id="${message.id}">Rediger</button>
                <button class="edit-btn delete-btn delete-message-btn" data-message-id="${message.id}">Slett</button>
            </div>
        ` : '';

        article.innerHTML = `
            ${imageHtml}
            <div class="melding-content">
                <div class="melding-header">
                    <h2 class="melding-title">${titleHtml}</h2>
                    <span class="melding-date">${dateStr}</span>
                </div>
                ${adminActions}
                <div class="melding-body">${contentHtml}</div>
                <div class="melding-actions">
                    <button class="melding-action-btn toggle-comments-btn" data-message-id="${message.id}">
                        💬 Kommentarer ${commentCountHtml}
                    </button>
                    <button class="melding-action-btn add-comment-btn" data-message-id="${message.id}">
                        ✏️ Skriv kommentar
                    </button>
                </div>
                <div class="comments-section" id="comments-${message.id}" hidden>
                    ${this.renderComments(comments)}
                </div>
            </div>
        `;

        // Bind comment button events
        const toggleBtn = article.querySelector('.toggle-comments-btn');
        const addBtn = article.querySelector('.add-comment-btn');

        toggleBtn?.addEventListener('click', () => this.toggleComments(message.id));
        addBtn?.addEventListener('click', () => this.openCommentModal(message.id));

        // Bind edit/delete buttons
        const editBtn = article.querySelector('.edit-message-btn');
        const deleteBtn = article.querySelector('.delete-message-btn');
        editBtn?.addEventListener('click', () => this.openEditMessageModal(message.id));
        deleteBtn?.addEventListener('click', () => this.deleteMessage(message.id));

        return article;
    }

    renderComments(comments) {
        if (!comments || comments.length === 0) {
            return '<p class="no-comments">Ingen kommentarer ennå. Vær den første til å kommentere!</p>';
        }

        const commentsHtml = comments.map(comment => {
            const date = new Date(comment.createdAt);
            const dateStr = date.toLocaleDateString('no-NO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="comment">
                    <div class="comment-header">
                        <span class="comment-author">${this.escapeHtml(comment.author)}</span>
                        <span class="comment-date">${dateStr}</span>
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                </div>
            `;
        }).join('');

        return `<div class="comments-list">${commentsHtml}</div>`;
    }

    toggleComments(messageId) {
        const section = document.getElementById(`comments-${messageId}`);
        if (section) {
            section.hidden = !section.hidden;
        }
    }

    openCommentModal(messageId) {
        this.currentCommentMessageId = messageId;
        this.elements.commentText.value = '';
        this.elements.commentModal.hidden = false;
        this.elements.commentText.focus();
    }

    closeCommentModal() {
        this.elements.commentModal.hidden = true;
        this.currentCommentMessageId = null;
    }

    async submitComment() {
        const text = this.elements.commentText.value.trim();
        if (!text || !this.currentCommentMessageId) return;

        // Get current member
        const member = getCurrentMember();
        if (!member) {
            alert('Du må være logget inn for å kommentere.');
            return;
        }

        const comment = {
            id: 'c' + Date.now(),
            author: member.name,
            email: member.email,
            createdAt: new Date().toISOString(),
            text: text
        };

        // Disable submit button
        this.elements.commentSubmit.disabled = true;
        this.elements.commentSubmit.textContent = 'Sender...';

        try {
            if (useMock()) {
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 500));

                // Add comment to local data
                const message = this.messages.find(m => m.id === this.currentCommentMessageId);
                if (message) {
                    if (!message.comments) message.comments = [];
                    message.comments.push(comment);
                }
            } else {
                // Send via SharePoint API
                const result = await sharePointAPI.addMessageComment({
                    messageId: this.currentCommentMessageId,
                    text: comment.text,
                    authorName: member.name,
                    authorEmail: member.email
                });

                if (!result.success) {
                    throw new Error(result.error || 'Kunne ikke lagre kommentar');
                }

                // Oppdater lokal data
                const message = this.messages.find(m => m.id === this.currentCommentMessageId);
                if (message) {
                    if (!message.comments) message.comments = [];
                    message.comments.push(comment);
                }
            }

            // Update UI
            this.updateCommentsSection(this.currentCommentMessageId);

            // Close modal
            this.closeCommentModal();

        } catch (error) {
            console.error('Error submitting comment:', error);
            alert('Kunne ikke lagre kommentar. Prøv igjen.');
        } finally {
            this.elements.commentSubmit.disabled = false;
            this.elements.commentSubmit.textContent = 'Send kommentar';
        }
    }

    updateCommentsSection(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        // Update comments section
        const section = document.getElementById(`comments-${messageId}`);
        if (section) {
            section.innerHTML = this.renderComments(message.comments);
            section.hidden = false; // Show comments after adding
        }

        // Update comment count in button
        const card = document.querySelector(`[data-message-id="${messageId}"]`);
        if (card) {
            const toggleBtn = card.querySelector('.toggle-comments-btn');
            if (toggleBtn) {
                const count = message.comments?.length || 0;
                const countHtml = count > 0 ? `<span class="count">${count}</span>` : '';
                toggleBtn.innerHTML = `💬 Kommentarer ${countHtml}`;
            }
        }
    }

    formatContent(message) {
        switch (message.format) {
            case 'html':
                // Trust HTML content (assuming it's sanitized on server)
                return message.content;

            case 'markdown':
                return parseMarkdown(message.content);

            case 'text':
            default:
                // Convert plain text to HTML
                return '<p>' + this.escapeHtml(message.content)
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br>') + '</p>';
        }
    }

    getPlainText(message) {
        // Get plain text for search
        if (message.format === 'text') {
            return message.content;
        }

        // Strip HTML/markdown
        const temp = document.createElement('div');
        temp.innerHTML = this.formatContent(message);
        return temp.textContent || temp.innerText || '';
    }

    highlightSearch(html, query) {
        if (!query) return html;

        // Simple highlight - be careful not to break HTML tags
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');

        // Only highlight text content, not inside tags
        return html.replace(/>([^<]+)</g, (match, text) => {
            return '>' + text.replace(regex, '<span class="search-highlight">$1</span>') + '<';
        });
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('no-NO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    // ==========================================================================
    // UI HELPERS
    // ==========================================================================
    showLoader() {
        this.elements.loader?.classList.add('active');
    }

    hideLoader() {
        this.elements.loader?.classList.remove('active');
    }

    showEmpty(text) {
        if (this.elements.emptyText) {
            this.elements.emptyText.textContent = text;
        }
        if (this.elements.emptyState) {
            this.elements.emptyState.hidden = false;
        }
        if (this.elements.loadMoreContainer) {
            this.elements.loadMoreContainer.hidden = true;
        }
    }

    hideEmpty() {
        if (this.elements.emptyState) {
            this.elements.emptyState.hidden = true;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// ==========================================================================
// INITIALIZE
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const app = new MessagesApp();
    app.init();
});

export { MessagesApp };
export default MessagesApp;
