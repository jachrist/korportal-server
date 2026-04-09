/**
 * Korportal - Hovedapplikasjon (Index)
 * Forside med artikkel og kontaktinformasjon
 *
 * @module Main
 * @version 4.0.0
 */

import sharePointAPI from './sharepoint-api.js';
import badgeManager from './badge-manager.js';
import {
    ThemeManager,
    MenuManager,
    isLoggedIn,
    getCurrentUserRole,
    hasRole,
    ROLES
} from './navigation.js';
import { MarkdownEditor } from './markdown-editor.js';

// ==========================================================================
// MOCK DATA - Brukes når SharePoint ikke er konfigurert
// ==========================================================================
const MOCK_ARTICLE = {
    title: 'Velkommen til Kammerkoret Utsikten',
    text: `Kammerkoret Utsikten er et ambisiøst blandakor med base i Oslo. Vi synger et bredt repertoar fra renessanse til samtidsmusikk, og holder flere konserter i året.

$picture

Koret ble stiftet i 2010 og har siden den gang vokst til å bli et av Oslos mest aktive kammerkor. Vi øver hver tirsdag klokken 19:00-21:30 i Vålerenga kirke.

Er du interessert i å synge med oss? Ta kontakt med en av våre kontaktpersoner nedenfor.`,
    format: 'text',
    imageUrl: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&q=80',
    imagePlacement: 'angitt'
};

const MOCK_CONTACTS = [
    {
        id: 1,
        name: 'Kari Nordmann',
        email: 'dirigent@kammerkoretutsikten.no',
        phone: '99 88 77 66',
        kontaktrolle: 'Dirigent'
    },
    {
        id: 2,
        name: 'Ola Hansen',
        email: 'leder@kammerkoretutsikten.no',
        phone: '99 11 22 33',
        kontaktrolle: 'Korleder'
    },
    {
        id: 3,
        name: 'Anne Olsen',
        email: 'info@kammerkoretutsikten.no',
        phone: '99 44 55 66',
        kontaktrolle: 'Medlemsansvarlig'
    }
];

// Hurtiglenker for anonyme besøkende
const QUICK_LINKS_ANONYMOUS = [
    { title: 'Konserter', url: '/konserter.html', icon: '🎭', description: 'Se kommende konserter og kjøp billetter' },
    { title: 'Musikk fra oss', url: '/musikk.html', icon: '🎧', description: 'Hør innspillinger fra koret' }
];

// Hurtiglenker for innloggede medlemmer
const QUICK_LINKS_MEMBER = [
    { title: 'Øvelser', url: '/ovelse.html', icon: '🎼', description: 'Se øvelsesplan' },
    { title: 'Noter', url: '/noter.html', icon: '🎵', description: 'Notebiblioteket' },
    { title: 'Meldinger', url: '/meldinger.html', icon: '📢', description: 'Les meldinger' },
    { title: 'Nedlasting', url: '/nedlasting.html', icon: '📥', description: 'Last ned filer' }
];

// ==========================================================================
// HOVEDAPPLIKASJON
// ==========================================================================
class KorportalApp {
    constructor() {
        this.themeManager = new ThemeManager();
        this.menuManager = new MenuManager();
        this.elements = {};
        this.articleEditor = null;
        this.currentArticle = null;
    }

    async init() {
        this.cacheElements();
        this.setCurrentYear();
        this.bindEditModalEvents();

        // Initialiser tema og meny (ingen innloggingskrav på forsiden)
        this.themeManager.init();
        this.menuManager.init();

        // Last inn data
        await this.loadInitialData();

        // Sjekk for nytt innhold (non-blocking, kun innloggede)
        if (isLoggedIn()) {
            this.checkForNewContent();
        }
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            articleSection: document.getElementById('articleSection'),
            articleContent: document.getElementById('articleContent'),
            quickLinksSection: document.getElementById('quickLinksSection'),
            quickLinksGrid: document.getElementById('quickLinksGrid'),
            aboutSection: document.getElementById('aboutSection'),
            contactPersons: document.getElementById('contactPersons'),
            currentYear: document.getElementById('currentYear'),
            // Edit article modal
            editArticleModal: document.getElementById('editArticleModal'),
            editArticleModalClose: document.getElementById('editArticleModalClose'),
            editArticleTitle: document.getElementById('editArticleTitle'),
            editArticleContent: document.getElementById('editArticleContent'),
            editArticleFormat: document.getElementById('editArticleFormat'),
            editArticleSave: document.getElementById('editArticleSave'),
            editArticleCancel: document.getElementById('editArticleCancel'),
            editArticleDelete: document.getElementById('editArticleDelete')
        };
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    async loadInitialData() {
        this.showLoader();

        try {
            // Prøv å laste fra SharePoint, bruk mock-data hvis det feiler
            let article, contacts, quickLinks;

            try {
                [article, contacts, quickLinks] = await Promise.all([
                    sharePointAPI.getArticle('frontpage'),
                    sharePointAPI.getContactPersons(),
                    sharePointAPI.getQuickLinks()
                ]);
            } catch (e) {
                console.log('SharePoint ikke konfigurert, bruker mock-data');
            }

            // Bruk mock-data hvis ingen data fra API
            article = article || MOCK_ARTICLE;
            contacts = contacts?.length ? contacts : MOCK_CONTACTS;

            // Velg hurtiglenker basert på innloggingsstatus
            const defaultQuickLinks = isLoggedIn() ? QUICK_LINKS_MEMBER : QUICK_LINKS_ANONYMOUS;
            quickLinks = quickLinks?.length ? quickLinks : defaultQuickLinks;

            // Render artikkel
            this.renderArticle(article);

            // Render hurtiglenker (for alle besøkende)
            this.renderQuickLinks(quickLinks);

            // Render kontaktpersoner
            this.renderContactPersons(contacts);

        } catch (error) {
            console.error('Feil ved lasting av data:', error);
            // Vis mock-data ved feil
            this.renderArticle(MOCK_ARTICLE);
            this.renderContactPersons(MOCK_CONTACTS);
        } finally {
            this.hideLoader();
        }
    }

    /**
     * Renderer artikkelinnhold med støtte for ulike formater og bildeplassering
     * @param {Object} article - Artikkeldata
     * @param {string} article.title - Tittel
     * @param {string} article.text - Innhold
     * @param {string} article.format - Format: 'html', 'markdown', 'text'
     * @param {string} article.imageUrl - Bilde-URL (valgfritt)
     * @param {string} article.imagePlacement - Plassering: 'over', 'under', 'angitt'
     */
    renderArticle(article) {
        if (!this.elements.articleContent) return;

        this.currentArticle = article;
        const { title, text, format, imageUrl, imagePlacement } = article;

        // Konverter tekst basert på format
        let contentHtml = this.formatContent(text, format);

        // Bygg HTML med bildeplassering
        let html = '';

        // Tittel with optional edit button
        if (title) {
            html += `<div class="article__title-row">`;
            html += `<h2 class="article__title">${this.escapeHtml(title)}</h2>`;
            if (isLoggedIn() && hasRole(getCurrentUserRole(), ROLES.STYRE)) {
                html += `<button class="edit-btn" id="editArticleBtn" type="button">Rediger</button>`;
            }
            html += `</div>`;
        }

        // Bilde over teksten
        if (imageUrl && imagePlacement === 'over') {
            html += this.createImageHtml(imageUrl, title);
        }

        // Innhold med eventuelt innfelt bilde
        if (imageUrl && imagePlacement === 'angitt' && text.includes('$picture')) {
            // Split tekst på $picture og sett inn bilde
            const parts = contentHtml.split('$picture');
            html += `<div class="article__text">${parts[0]}</div>`;
            html += this.createImageHtml(imageUrl, title);
            if (parts[1]) {
                html += `<div class="article__text">${parts[1]}</div>`;
            }
        } else {
            // Fjern $picture-markør hvis den finnes men bildeplassering ikke er 'angitt'
            contentHtml = contentHtml.replace(/\$picture/g, '');
            html += `<div class="article__text">${contentHtml}</div>`;
        }

        // Bilde under teksten
        if (imageUrl && imagePlacement === 'under') {
            html += this.createImageHtml(imageUrl, title);
        }

        this.elements.articleContent.innerHTML = html;

        // Bind edit button
        const editBtn = document.getElementById('editArticleBtn');
        editBtn?.addEventListener('click', () => this.openEditArticleModal());
    }

    /**
     * Lager HTML for et bilde
     */
    createImageHtml(url, alt) {
        return `
            <figure class="article__image">
                <img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(alt || 'Artikkel-bilde')}" loading="lazy">
            </figure>
        `;
    }

    /**
     * Konverterer innhold basert på format
     * @param {string} text - Tekst som skal konverteres
     * @param {string} format - Format: 'html', 'markdown', 'text'
     * @returns {string} HTML-formatert innhold
     */
    formatContent(text, format) {
        if (!text) return '';

        switch (format?.toLowerCase()) {
            case 'html':
                // Returner HTML direkte (men sanitize i produksjon!)
                return text;

            case 'markdown':
                // Enkel markdown-konvertering
                return this.parseMarkdown(text);

            case 'text':
            default:
                // Konverter linjeskift til paragrafer
                return this.textToHtml(text);
        }
    }

    /**
     * Enkel markdown-parser
     */
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

        // Linjeskift til paragrafer
        html = html.split(/\n\n+/).map(p => {
            if (p.startsWith('<h') || p.startsWith('$picture')) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');

        return html;
    }

    /**
     * Konverterer ren tekst til HTML med paragrafer
     */
    textToHtml(text) {
        const escaped = this.escapeHtml(text);
        return escaped.split(/\n\n+/).map(p => {
            if (p.trim().startsWith('$picture')) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');
    }

    /**
     * Renderer hurtiglenker
     */
    renderQuickLinks(links) {
        if (!this.elements.quickLinksGrid) return;

        const html = links.map(link => {
            const target = link.openInNewTab ? 'target="_blank" rel="noopener noreferrer"' : '';

            return `
                <a href="${this.escapeHtml(link.url)}" class="quick-link" ${target} title="${this.escapeHtml(link.description || '')}">
                    <span class="quick-link__icon">${link.icon || '🔗'}</span>
                    <span class="quick-link__label">${this.escapeHtml(link.title)}</span>
                </a>
            `;
        }).join('');

        this.elements.quickLinksGrid.innerHTML = html;
    }

    /**
     * Renderer kontaktpersoner
     */
    renderContactPersons(contacts) {
        if (!this.elements.contactPersons) return;

        if (!contacts || contacts.length === 0) {
            this.elements.aboutSection?.remove();
            return;
        }

        const html = contacts.map(contact => `
            <div class="contact-card">
                <div class="contact-card__role">${this.escapeHtml(contact.kontaktrolle || 'Kontaktperson')}</div>
                <div class="contact-card__name">${this.escapeHtml(contact.name)}</div>
                <div class="contact-card__details">
                    ${contact.email ? `<a href="mailto:${this.escapeHtml(contact.email)}" class="contact-card__email">${this.escapeHtml(contact.email)}</a>` : ''}
                    ${contact.phone ? `<a href="tel:${contact.phone.replace(/\s/g, '')}" class="contact-card__phone">${this.escapeHtml(contact.phone)}</a>` : ''}
                </div>
            </div>
        `).join('');

        this.elements.contactPersons.innerHTML = html;
    }

    // =========================================================================
    // EDIT ARTICLE MODAL
    // =========================================================================

    bindEditModalEvents() {
        this.elements.editArticleModalClose?.addEventListener('click', () => this.closeEditArticleModal());
        this.elements.editArticleCancel?.addEventListener('click', () => this.closeEditArticleModal());
        this.elements.editArticleSave?.addEventListener('click', () => this.saveArticle());
        this.elements.editArticleDelete?.addEventListener('click', () => this.deleteArticle());
        this.elements.editArticleModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.editArticleModal) this.closeEditArticleModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.editArticleModal?.hidden) {
                this.closeEditArticleModal();
            }
        });
    }

    openEditArticleModal() {
        if (!this.currentArticle) return;

        this.elements.editArticleTitle.value = this.currentArticle.title || '';
        this.elements.editArticleContent.value = this.currentArticle.text || '';
        this.elements.editArticleFormat.value = this.currentArticle.format || 'text';
        this.elements.editArticleModal.hidden = false;

        // Initialize markdown editor on first open
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
                await sharePointAPI.updateItem('articles', this.currentArticle.id || 'frontpage', {
                    title,
                    text,
                    format
                });
            } catch (apiError) {
                console.log('API update not available, updating locally:', apiError.message);
            }

            // Update local data and re-render
            this.currentArticle.title = title;
            this.currentArticle.text = text;
            this.currentArticle.format = format;
            this.renderArticle(this.currentArticle);
            this.closeEditArticleModal();

        } catch (error) {
            console.error('Error saving article:', error);
            alert('Kunne ikke lagre artikkelen. Pr\u00f8v igjen.');
        } finally {
            this.elements.editArticleSave.disabled = false;
            this.elements.editArticleSave.textContent = 'Lagre';
        }
    }

    async deleteArticle() {
        if (!this.currentArticle) return;

        if (!confirm('Er du sikker på at du vil slette denne artikkelen?')) return;

        try {
            try {
                await sharePointAPI.deleteItem('articles', this.currentArticle.id || 'frontpage');
            } catch (apiError) {
                console.log('API delete not available, deleting locally:', apiError.message);
            }

            this.currentArticle = null;
            if (this.elements.articleContent) {
                this.elements.articleContent.innerHTML = '<p style="color:var(--muted)">Artikkelen er slettet.</p>';
            }
            this.closeEditArticleModal();

        } catch (error) {
            console.error('Error deleting article:', error);
            alert('Kunne ikke slette artikkelen. Pr\u00f8v igjen.');
        }
    }

    async checkForNewContent() {
        if (!badgeManager.shouldCheck()) return;

        try {
            const results = await Promise.allSettled([
                sharePointAPI.getMessages(),
                sharePointAPI.getPosts(),
                sharePointAPI.getConcerts(),
                sharePointAPI.getMembersPageData()
            ]);

            const [messagesResult, postsResult, concertsResult, membersResult] = results;

            if (messagesResult.status === 'fulfilled' && Array.isArray(messagesResult.value)) {
                badgeManager.checkAndUpdate('meldinger', messagesResult.value, 'publishedAt');
            }
            if (postsResult.status === 'fulfilled' && Array.isArray(postsResult.value)) {
                badgeManager.checkAndUpdate('innlegg', postsResult.value, 'createdAt');
            }
            if (concertsResult.status === 'fulfilled' && Array.isArray(concertsResult.value)) {
                badgeManager.checkAndUpdate('konserter', concertsResult.value, 'date');
            }
            if (membersResult.status === 'fulfilled' && membersResult.value?.events) {
                badgeManager.checkAndUpdate('medlemmer', membersResult.value.events, 'date');
            }

            badgeManager.markChecked();
        } catch (e) {
            console.warn('[Main] Badge check failed:', e.message);
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
}

// Initialiser applikasjonen når DOM er klar
document.addEventListener('DOMContentLoaded', () => {
    const app = new KorportalApp();
    app.init();
});

export { KorportalApp };
export default KorportalApp;
