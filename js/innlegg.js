/**
 * Innlegg (Member Posts) - JavaScript
 *
 * Viser innlegg fra medlemmer med søk, lazy loading og mulighet for å skrive nye innlegg
 *
 * @module Innlegg
 * @version 2.0.0
 */

import { initPage, getCurrentMember } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';
import badgeManager from './badge-manager.js';

// ==========================================================================
// CONFIGURATION
// ==========================================================================

const POSTS_PER_PAGE = 5;

// Mock mode for testing - evalueres lazy for å sikre at env.js har lastet
const useMock = () => !window.ENV?.POWER_AUTOMATE_POSTS_URL;

// Mock data
const MOCK_POSTS = [
    {
        id: '1',
        title: 'Takk for flott julebord!',
        content: `Vil bare si tusen takk til alle som bidro til et fantastisk julebord! Spesielt takk til festkomiteen som stod på hele kvelden.

Maten var utrolig god, og underholdningen var på topp. Sangquizen var både morsom og utfordrende - hvem visste at vi hadde så mange musikkeksperter i koret?

Gleder meg allerede til neste sosiale samling!`,
        author: { id: '1', name: 'Kari Nordmann' },
        createdAt: '2026-01-22T18:30:00',
        commentCount: 2,
        comments: [
            {
                id: 'c1',
                author: 'Ola Hansen',
                email: 'ola@test.no',
                createdAt: '2026-01-22T19:15:00',
                text: 'Enig! Fantastisk kveld. Takk til alle sammen!'
            },
            {
                id: 'c2',
                author: 'Per Johansen',
                email: 'per@test.no',
                createdAt: '2026-01-22T20:00:00',
                text: 'Hvem vant egentlig sangquizen til slutt? Jeg måtte gå tidlig.'
            }
        ]
    },
    {
        id: '2',
        title: 'Samkjøring til konsert i Oslo?',
        content: `Hei alle sammen!

Er det noen som kjører fra Drammen-området til konserten i Oslo 15. mars? Jeg har plass til 3 personer i bilen min.

Tenker å kjøre ca. kl. 17:00 så vi har god tid til oppmøte.

Gi meg en lyd hvis du vil ha skyss! Kan nås på telefon eller her i kommentarfeltet.`,
        author: { id: '2', name: 'Ola Hansen' },
        createdAt: '2026-01-20T10:15:00',
        commentCount: 1,
        comments: [
            {
                id: 'c3',
                author: 'Anne Olsen',
                email: 'anne@test.no',
                createdAt: '2026-01-20T11:30:00',
                text: 'Jeg vil gjerne ha skyss! Bor på Bragernes. Sender deg en melding.'
            }
        ]
    },
    {
        id: '3',
        title: 'Tips til øving av Ubi Caritas',
        content: `Hei sopraner (og andre interesserte)!

Jeg fant en veldig fin innspilling av Ubi Caritas på YouTube som kan være nyttig for øving. Dirigenten går gjennom de ulike stemmene og forklarer hvordan frasene skal synges.

Spesielt nyttig er gjennomgangen av crescendo-partiet i midten - det er lett å starte for sterkt der.

**Tips:** Prøv å lytte til bass-stemmen også, det hjelper med å forstå harmoniene bedre.

Lykke til med øvingen!`,
        author: { id: '3', name: 'Anne Olsen' },
        createdAt: '2026-01-18T14:45:00',
        commentCount: 0,
        comments: []
    },
    {
        id: '4',
        title: 'Noen som har funnet en blå notatbok?',
        content: `Jeg har visst mistet notatboken min på øvelsen i går. Den er blå med spiralrygg og har notater fra de siste månedene.

Hvis noen har funnet den, vennligst gi meg beskjed!

Takk på forhånd.`,
        author: { id: '4', name: 'Lisa Berg' },
        createdAt: '2026-01-16T08:20:00',
        commentCount: 2,
        comments: [
            {
                id: 'c4',
                author: 'Erik Svendsen',
                email: 'erik@test.no',
                createdAt: '2026-01-16T09:00:00',
                text: 'Jeg så en blå bok ligge på pianoet da jeg gikk. Kan det være din?'
            },
            {
                id: 'c5',
                author: 'Lisa Berg',
                email: 'lisa@test.no',
                createdAt: '2026-01-16T09:30:00',
                text: 'Ja, det er nok den! Tusen takk, Erik! Jeg henter den på neste øvelse.'
            }
        ]
    },
    {
        id: '5',
        title: 'Forslag: Kortur til København?',
        content: `Hei alle!

Hva tenker dere om en kortur til København i høst? Jeg vet om flere kor som har hatt vellykkede turer dit, med både konsert og sosialt program.

Noen muligheter:
- Felleskonsert med dansk kor
- Besøk til Tivoli
- Omvisning i operahuset

Ville dette vært interessant? Skriv gjerne i kommentarfeltet hva dere tenker, så kan vi ta det opp på neste årsmøte.`,
        author: { id: '5', name: 'Erik Svendsen' },
        createdAt: '2026-01-10T16:00:00',
        commentCount: 3,
        comments: [
            {
                id: 'c6',
                author: 'Kari Nordmann',
                email: 'kari@test.no',
                createdAt: '2026-01-10T17:30:00',
                text: 'For en flott idé! Jeg er absolutt interessert. København er en fantastisk by.'
            },
            {
                id: 'c7',
                author: 'Ola Hansen',
                email: 'ola@test.no',
                createdAt: '2026-01-10T18:00:00',
                text: 'Høres spennende ut! Har vi kontakter i danske kor?'
            },
            {
                id: 'c8',
                author: 'Anne Olsen',
                email: 'anne@test.no',
                createdAt: '2026-01-11T09:00:00',
                text: 'Jeg kjenner noen i Akademisk Kor i København. Kan høre om de er interessert i samarbeid.'
            }
        ]
    },
    {
        id: '6',
        title: 'Bilder fra høstkonserten',
        content: `Hei!

Jeg har nå lastet opp alle bildene fra høstkonserten til Google Foto. Lenken ble sendt ut på e-post.

Det ble over 200 bilder totalt! Føl dere fri til å laste ned og dele med familie og venner.

Gi gjerne tilbakemelding hvis dere vil ha noen bilder i høyere oppløsning - da kan jeg sende dem direkte.`,
        author: { id: '6', name: 'Mari Kristiansen' },
        createdAt: '2025-12-01T12:00:00',
        commentCount: 0,
        comments: []
    }
];

// ==========================================================================
// SIMPLE MARKDOWN PARSER
// ==========================================================================
function parseMarkdown(text) {
    if (!text) return '';

    let html = text
        // Escape HTML first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Images (must come before links)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Line breaks (double newline = paragraph)
        .replace(/\n\n/g, '</p><p>')
        // Single line breaks
        .replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = '<p>' + html + '</p>';

    // Wrap lists
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');

    return html;
}

// ==========================================================================
// POSTS APP
// ==========================================================================
class PostsApp {
    constructor() {
        this.posts = [];
        this.filteredPosts = [];
        this.displayedCount = 0;
        this.searchQuery = '';
        this.currentCommentPostId = null;

        this.elements = {};
    }

    async init() {
        // Initialiser side med innloggingskrav
        const pageInit = initPage({ requireAuth: true });
        if (!pageInit) return;

        this.cacheElements();
        this.bindEvents();
        await this.loadPosts();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            innleggList: document.getElementById('innleggList'),
            searchInput: document.getElementById('searchInput'),
            loadMoreBtn: document.getElementById('loadMoreBtn'),
            loadMoreContainer: document.getElementById('loadMoreContainer'),
            emptyState: document.getElementById('emptyState'),
            emptyText: document.getElementById('emptyText'),
            // New post
            newPostBtn: document.getElementById('newPostBtn'),
            emptyNewPostBtn: document.getElementById('emptyNewPostBtn'),
            postModal: document.getElementById('postModal'),
            postModalClose: document.getElementById('postModalClose'),
            postTitle: document.getElementById('postTitle'),
            postContent: document.getElementById('postContent'),
            postSubmit: document.getElementById('postSubmit'),
            postCancel: document.getElementById('postCancel'),
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

        // New post buttons
        this.elements.newPostBtn?.addEventListener('click', () => this.openPostModal());
        this.elements.emptyNewPostBtn?.addEventListener('click', () => this.openPostModal());

        // Post modal events
        this.elements.postModalClose?.addEventListener('click', () => this.closePostModal());
        this.elements.postCancel?.addEventListener('click', () => this.closePostModal());
        this.elements.postSubmit?.addEventListener('click', () => this.submitPost());

        // Close post modal on backdrop click
        this.elements.postModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.postModal) {
                this.closePostModal();
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
                if (!this.elements.postModal?.hidden) {
                    this.closePostModal();
                }
                if (!this.elements.commentModal?.hidden) {
                    this.closeCommentModal();
                }
            }
        });
    }

    // ==========================================================================
    // DATA LOADING
    // ==========================================================================
    async loadPosts() {
        this.showLoader();

        try {
            if (useMock()) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 500));
                this.posts = [...MOCK_POSTS];
            } else {
                // Bruk SharePoint API
                this.posts = await sharePointAPI.getPosts();
            }

            // Sort by date (newest first)
            this.posts.sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );

            badgeManager.markSeen('innlegg');
            this.filterAndRender();

        } catch (error) {
            console.error('Error loading posts:', error);
            // Fallback til mock-data ved feil
            this.posts = [...MOCK_POSTS];
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
        // Filter posts based on search query
        if (this.searchQuery) {
            this.filteredPosts = this.posts.filter(post => {
                const titleMatch = post.title.toLowerCase().includes(this.searchQuery);
                const contentMatch = post.content.toLowerCase().includes(this.searchQuery);
                const authorMatch = (post.author?.name || '').toLowerCase().includes(this.searchQuery);
                return titleMatch || contentMatch || authorMatch;
            });
        } else {
            this.filteredPosts = [...this.posts];
        }

        // Reset display count
        this.displayedCount = 0;

        // Clear list
        this.elements.innleggList.innerHTML = '';

        // Show posts or empty state
        if (this.filteredPosts.length === 0) {
            if (this.searchQuery) {
                this.showEmpty(`Ingen innlegg matcher "${this.searchQuery}"`);
            } else {
                this.showEmpty('Ingen innlegg å vise');
            }
        } else {
            this.hideEmpty();
            this.displayMore();
        }
    }

    displayMore() {
        const startIndex = this.displayedCount;
        const endIndex = Math.min(startIndex + POSTS_PER_PAGE, this.filteredPosts.length);

        for (let i = startIndex; i < endIndex; i++) {
            const postEl = this.createPostElement(this.filteredPosts[i]);
            this.elements.innleggList.appendChild(postEl);
        }

        this.displayedCount = endIndex;

        // Show/hide load more button
        if (this.displayedCount < this.filteredPosts.length) {
            this.elements.loadMoreContainer.hidden = false;
        } else {
            this.elements.loadMoreContainer.hidden = true;
        }
    }

    createPostElement(post) {
        const article = document.createElement('article');
        article.className = 'innlegg-card';
        article.dataset.postId = post.id;

        // Author initials
        const authorName = post.author?.name || '';
        const initials = authorName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        // Format content (simple markdown)
        let contentHtml = parseMarkdown(post.content);

        // Highlight search terms
        if (this.searchQuery) {
            contentHtml = this.highlightSearch(contentHtml, this.searchQuery);
        }

        // Format date
        const dateStr = this.formatDate(post.createdAt);
        const timeStr = this.formatTime(post.createdAt);

        // Title with search highlight
        let titleHtml = this.escapeHtml(post.title);
        if (this.searchQuery) {
            titleHtml = this.highlightSearch(titleHtml, this.searchQuery);
        }

        // Author name with search highlight
        let authorNameHtml = this.escapeHtml(authorName);
        if (this.searchQuery) {
            authorNameHtml = this.highlightSearch(authorNameHtml, this.searchQuery);
        }

        // Comments count
        const comments = post.comments || [];
        const commentCount = comments.length;
        const commentCountHtml = commentCount > 0 ? `<span class="count">${commentCount}</span>` : '';

        article.innerHTML = `
            <div class="innlegg-author">
                <div class="innlegg-author__avatar">${initials}</div>
                <div class="innlegg-author__info">
                    <div class="innlegg-author__name">${authorNameHtml}</div>
                    <div class="innlegg-author__meta">
                        <span>${dateStr} kl. ${timeStr}</span>
                    </div>
                </div>
            </div>
            <div class="innlegg-content">
                <div class="innlegg-header-row">
                    <h2 class="innlegg-title">${titleHtml}</h2>
                </div>
                <div class="innlegg-body">${contentHtml}</div>
                <div class="innlegg-actions">
                    <button class="innlegg-action-btn toggle-comments-btn" data-post-id="${post.id}">
                        💬 Kommentarer ${commentCountHtml}
                    </button>
                    <button class="innlegg-action-btn add-comment-btn" data-post-id="${post.id}">
                        ✏️ Skriv kommentar
                    </button>
                </div>
                <div class="comments-section" id="comments-${post.id}" hidden>
                    ${this.renderComments(comments)}
                </div>
            </div>
        `;

        // Bind comment button events
        const toggleBtn = article.querySelector('.toggle-comments-btn');
        const addBtn = article.querySelector('.add-comment-btn');

        toggleBtn?.addEventListener('click', () => this.toggleComments(post.id));
        addBtn?.addEventListener('click', () => this.openCommentModal(post.id));

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

    // ==========================================================================
    // POST MODAL
    // ==========================================================================
    openPostModal() {
        this.elements.postTitle.value = '';
        this.elements.postContent.value = '';
        this.elements.postModal.hidden = false;
        this.elements.postTitle.focus();
    }

    closePostModal() {
        this.elements.postModal.hidden = true;
    }

    async submitPost() {
        const title = this.elements.postTitle.value.trim();
        const content = this.elements.postContent.value.trim();

        if (!title || !content) {
            alert('Vennligst fyll ut både tittel og innhold.');
            return;
        }

        const member = getCurrentMember();
        if (!member) {
            alert('Du må være logget inn for å skrive innlegg.');
            return;
        }

        const newPost = {
            id: 'p' + Date.now(),
            title: title,
            content: content,
            author: { id: member.id, name: member.name },
            createdAt: new Date().toISOString(),
            commentCount: 0,
            comments: []
        };

        // Disable submit button
        this.elements.postSubmit.disabled = true;
        this.elements.postSubmit.textContent = 'Publiserer...';

        try {
            if (useMock()) {
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 500));

                // Add post to local data
                this.posts.unshift(newPost);
            } else {
                // Send via SharePoint API
                const result = await sharePointAPI.createPost({
                    title: newPost.title,
                    content: newPost.content,
                    authorId: member.id,
                    authorName: member.name,
                    authorEmail: member.email,
                    authorVoice: member.voice || ''
                });

                if (!result.success) {
                    throw new Error(result.error || 'Kunne ikke publisere innlegg');
                }

                // Legg til innlegg med ID fra server
                newPost.id = result.id || newPost.id;
                this.posts.unshift(newPost);
            }

            // Re-render
            this.filterAndRender();

            // Close modal
            this.closePostModal();

        } catch (error) {
            console.error('Error submitting post:', error);
            alert('Kunne ikke publisere innlegg. Prøv igjen.');
        } finally {
            this.elements.postSubmit.disabled = false;
            this.elements.postSubmit.textContent = 'Publiser innlegg';
        }
    }

    // ==========================================================================
    // COMMENTS
    // ==========================================================================
    toggleComments(postId) {
        const section = document.getElementById(`comments-${postId}`);
        if (section) {
            section.hidden = !section.hidden;
        }
    }

    openCommentModal(postId) {
        this.currentCommentPostId = postId;
        this.elements.commentText.value = '';
        this.elements.commentModal.hidden = false;
        this.elements.commentText.focus();
    }

    closeCommentModal() {
        this.elements.commentModal.hidden = true;
        this.currentCommentPostId = null;
    }

    async submitComment() {
        const text = this.elements.commentText.value.trim();
        if (!text || !this.currentCommentPostId) return;

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
                const post = this.posts.find(p => p.id === this.currentCommentPostId);
                if (post) {
                    if (!post.comments) post.comments = [];
                    post.comments.push(comment);
                }
            } else {
                // Send via SharePoint API
                const result = await sharePointAPI.addPostComment({
                    postId: this.currentCommentPostId,
                    text: comment.text,
                    authorName: member.name,
                    authorEmail: member.email
                });

                if (!result.success) {
                    throw new Error(result.error || 'Kunne ikke lagre kommentar');
                }

                // Oppdater lokal data
                const post = this.posts.find(p => p.id === this.currentCommentPostId);
                if (post) {
                    if (!post.comments) post.comments = [];
                    post.comments.push(comment);
                }
            }

            // Update UI
            this.updateCommentsSection(this.currentCommentPostId);

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

    updateCommentsSection(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        // Update comments section
        const section = document.getElementById(`comments-${postId}`);
        if (section) {
            section.innerHTML = this.renderComments(post.comments);
            section.hidden = false; // Show comments after adding
        }

        // Update comment count in button
        const card = document.querySelector(`[data-post-id="${postId}"]`);
        if (card) {
            const toggleBtn = card.querySelector('.toggle-comments-btn');
            if (toggleBtn) {
                const count = post.comments?.length || 0;
                const countHtml = count > 0 ? `<span class="count">${count}</span>` : '';
                toggleBtn.innerHTML = `💬 Kommentarer ${countHtml}`;
            }
        }
    }

    // ==========================================================================
    // HELPERS
    // ==========================================================================
    highlightSearch(html, query) {
        if (!query) return html;

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

    formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('no-NO', {
            hour: '2-digit',
            minute: '2-digit'
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
    const app = new PostsApp();
    app.init();
});

export { PostsApp };
export default PostsApp;
