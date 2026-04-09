/**
 * Nedlasting (Downloads) - JavaScript
 *
 * Viser og håndterer nedlasting av noter
 *
 * @module Nedlasting
 * @version 2.0.0
 */

import { initPage, getCurrentMember } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';

// ==========================================================================
// CONFIGURATION
// ==========================================================================

// Mock mode for testing - evalueres lazy for å sikre at env.js har lastet
const useMock = () => !window.ENV?.POWER_AUTOMATE_DOWNLOADS_URL;

// Mock data - noter til nedlasting
const MOCK_FILES = [
    { id: 1, title: "Lift me up", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/Lift Me Up EPRINT-Choral.pdf", filename: "Lift-Me-Up-EPRINT-Choral.pdf", category: "Noter" },
    { id: 2, title: "Northern Lights", fileUrl: "https://utsiktenblob.blob.core.windows.net/noter/Northern Lights SATB.pdf", filename: "Northern-Lights-SATB.pdf", category: "Noter" },
    { id: 3, title: "Bruremarsj fra Valsøyfjord Aure", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/Bruremarsj-fra-Valsøyfjord-Aure.pdf", filename: "Bruremarsj-fra-Valsøyfjord-Aure.pdf", category: "Noter" },
    { id: 4, title: "A Light of Hope", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/A Light of Hope.pdf", filename: "A-Light-of-Hope.pdf", category: "Noter" },
    { id: 5, title: "Ubi Caritas", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/Ubi Caritas - Ola Gjeilo.pdf", filename: "Ubi-Caritas-Ola-Gjeilo.pdf", category: "Noter" },
    { id: 6, title: "Stein på stein", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/Stein paa stein.pdf", filename: "Stein-paa-stein.pdf", category: "Noter" },
    { id: 7, title: "Ja, vi elsker", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/Ja vi elsker.pdf", filename: "Ja-vi-elsker.pdf", category: "Noter" },
    { id: 8, title: "Vår beste dag", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/Vaar beste dag - SATB.pdf", filename: "Vaar-beste-dag-SATB.pdf", category: "Noter" },
    { id: 9, title: "O Helga Natt", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/O Helga Natt - Arr.pdf", filename: "O-Helga-Natt-Arr.pdf", category: "Noter" },
    { id: 10, title: "Deilig er jorden", fileUrl: "https://utsiktenblob.blob.core.windows.net/sanger/Deilig er jorden - SATB.pdf", filename: "Deilig-er-jorden-SATB.pdf", category: "Noter" }
];

// ==========================================================================
// DOWNLOADS APP
// ==========================================================================
class DownloadsApp {
    constructor() {
        this.files = [];
        this.filteredFiles = [];
        this.searchQuery = '';
        this.elements = {};
    }

    async init() {
        // Initialiser side med innloggingskrav (bruker navigation.js)
        const pageInit = initPage({ requireAuth: true });
        if (!pageInit) return; // Omdirigert til login

        this.cacheElements();
        this.bindEvents();
        await this.loadFiles();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            filesList: document.getElementById('filesList'),
            searchInput: document.getElementById('searchInput'),
            fileCountText: document.getElementById('fileCountText'),
            emptyState: document.getElementById('emptyState'),
            emptyText: document.getElementById('emptyText')
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
    }

    // ==========================================================================
    // DATA LOADING
    // ==========================================================================
    async loadFiles() {
        this.showLoader();

        try {
            if (useMock()) {
                await new Promise(resolve => setTimeout(resolve, 500));
                this.files = [...MOCK_FILES];
            } else {
                // Bruk SharePoint API
                this.files = await sharePointAPI.getDownloads();
            }

            // Sort alphabetically by name
            this.files.sort((a, b) => a.title.localeCompare(b.title, 'no'));
            this.filterAndRender();

        } catch (error) {
            console.error('Error loading files:', error);
            // Fallback til mock-data ved feil
            this.files = [...MOCK_FILES];
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
        if (this.searchQuery) {
            this.filteredFiles = this.files.filter(file =>
                file.title.toLowerCase().includes(this.searchQuery)
            );
        } else {
            this.filteredFiles = [...this.files];
        }

        this.updateFileCount();
        this.elements.filesList.innerHTML = '';

        if (this.filteredFiles.length === 0) {
            this.showEmpty(this.searchQuery
                ? `Ingen noter matcher "${this.searchQuery}"`
                : 'Ingen noter tilgjengelig'
            );
        } else {
            this.hideEmpty();
            this.renderFiles();
        }
    }

    renderFiles() {
        this.filteredFiles.forEach(file => {
            const fileEl = this.createFileElement(file);
            this.elements.filesList.appendChild(fileEl);
        });
    }

    createFileElement(file) {
        const div = document.createElement('div');
        div.className = 'file-card';

        const extension = this.getFileExtension(file.fileUrl);
        const icon = this.getFileIcon(extension);

        let nameHtml = this.escapeHtml(file.title);
        if (this.searchQuery) {
            nameHtml = this.highlightSearch(nameHtml, this.searchQuery);
        }

        div.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-info">
                <h3 class="file-name">${nameHtml}</h3>
                <div class="file-meta">
                    <span class="file-type">${extension.toUpperCase()}</span>
                </div>
            </div>
            <div class="file-actions">
                <a href="${this.escapeHtml(file.fileUrl)}"
                   class="download-btn"
                   download="${this.escapeHtml(file.title)}.${extension}"
                   target="_blank"
                   rel="noopener">
                    📥 Last ned
                </a>
            </div>
        `;

        return div;
    }

    updateFileCount() {
        const total = this.files.length;
        const filtered = this.filteredFiles.length;

        this.elements.fileCountText.textContent = this.searchQuery
            ? `Viser ${filtered} av ${total} noter`
            : `${total} noter tilgjengelig`;
    }

    getFileExtension(url) {
        const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return match ? match[1].toLowerCase() : 'fil';
    }

    getFileIcon(extension) {
        const icons = {
            'pdf': '📄',
            'mp3': '🎵',
            'wav': '🎵',
            'doc': '📝',
            'docx': '📝',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'zip': '📦'
        };
        return icons[extension] || '📄';
    }

    highlightSearch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
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
    const app = new DownloadsApp();
    app.init();
});

export { DownloadsApp };
export default DownloadsApp;
