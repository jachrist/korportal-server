/**
 * Spillelister og filer - Administrasjonsside
 * Kammerkoret Utsikten
 *
 * Håndterer filvisning, multi-valg, batch-redigering av metadata,
 * og blob-storage-operasjoner. Kun styre/admin har tilgang.
 */

import { initPage, getCurrentUserRole, hasRole, ROLES } from './navigation.js';

// ============================================================================
// Access control
// ============================================================================
const result = initPage({ requireAuth: true, requiredRole: 'styre' });
if (!result) {
    // Brukeren har ikke tilgang — initPage håndterer redirect
    document.getElementById('loader')?.classList.remove('active');
}

// ============================================================================
// State
// ============================================================================
let allFiles = [];
let filteredFiles = [];
let markedFileIds = new Set();
let activeCategory = 'alle';
let searchQuery = '';
let confirmCallback = null;

// ============================================================================
// Category mapping — kategori comes directly from SharePoint
// ============================================================================

// ============================================================================
// DOM Elements
// ============================================================================
const elements = {
    loader: document.getElementById('loader'),
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    categoryFilters: document.getElementById('categoryFilters'),
    resultCount: document.getElementById('resultCount'),
    resetFilters: document.getElementById('resetFilters'),
    filesList: document.getElementById('filesList'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    retryButton: document.getElementById('retryButton'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    markedPanel: document.getElementById('markedPanel'),
    markedCount: document.getElementById('markedCount'),
    markedList: document.getElementById('markedList'),
    markedForm: document.getElementById('markedForm'),
    markedActions: document.getElementById('markedActions'),
    kategoriInput: document.getElementById('kategoriInput'),
    verkInput: document.getElementById('verkInput'),
    stemmeInput: document.getElementById('stemmeInput'),
    sorteringInput: document.getElementById('sorteringInput'),
    anledningInput: document.getElementById('anledningInput'),
    updateMetadataBtn: document.getElementById('updateMetadataBtn'),
    syncBlobBtn: document.getElementById('syncBlobBtn'),
    uploadBlobBtn: document.getElementById('uploadBlobBtn'),
    uploadFilesBtn: document.getElementById('uploadFilesBtn'),
    uploadFileInput: document.getElementById('uploadFileInput'),
    clearBlobBtn: document.getElementById('clearBlobBtn'),
    confirmOverlay: document.getElementById('confirmOverlay'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancel: document.getElementById('confirmCancel'),
    confirmOk: document.getElementById('confirmOk'),
    toast: document.getElementById('toast'),
    currentYear: document.getElementById('currentYear')
};

// ============================================================================
// Utility Functions
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text || '');
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<span class="highlight">$1</span>');
}

function showToast(message, type = 'success') {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.className = `toast toast--visible toast--${type}`;
    setTimeout(() => {
        elements.toast.classList.remove('toast--visible');
    }, 3000);
}

function showLoader() {
    elements.loader?.classList.add('active');
}

function hideLoader() {
    elements.loader?.classList.remove('active');
}

function normalizeFile(file) {
    const raw = (file.kategori || '').toLowerCase();
    const filterCategory = raw === 'øvefil' ? 'ovefil' : raw;

    return {
        ...file,
        filterCategory
    };
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadFiles() {
    showLoader();
    if (elements.errorState) elements.errorState.hidden = true;
    if (elements.emptyState) elements.emptyState.hidden = true;

    try {
        const apiUrl = window.ENV?.POWER_AUTOMATE_FILES_URL;

        if (apiUrl) {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('API error');
            const data = await response.json();

            let files = data.body || data.filer || data;
            if (typeof files === 'string') {
                files = JSON.parse(files);
            }
            allFiles = Array.isArray(files) ? files.map(normalizeFile) : [];
        } else {
            console.warn('No FILES_URL configured');
            allFiles = [];
        }

        allFiles.sort((a, b) => {
            const sa = a.sortering ?? Infinity;
            const sb = b.sortering ?? Infinity;
            if (sa !== sb) return sa - sb;
            return (a.navn || '').localeCompare(b.navn || '', 'no');
        });
        applyFilters();
    } catch (error) {
        console.error('Error loading files:', error);
        showError(error.message || 'Kunne ikke laste filer fra server.');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// Filtering
// ============================================================================

function applyFilters() {
    const query = searchQuery.toLowerCase().trim();

    filteredFiles = allFiles.filter(file => {
        // Category filter
        if (activeCategory !== 'alle') {
            if (file.filterCategory !== activeCategory) return false;
        }

        // Search filter — matches navn, anledning, verk
        if (query) {
            const titleMatch = (file.navn || '').toLowerCase().includes(query);
            const anledningMatch = (file.anledning || '').toLowerCase().includes(query);
            const verkMatch = (file.verk || '').toLowerCase().includes(query);
            if (!titleMatch && !anledningMatch && !verkMatch) return false;
        }

        return true;
    });

    renderFiles();
    updateFilterStatus();
}

function updateFilterStatus() {
    const total = allFiles.length;
    const shown = filteredFiles.length;

    if (elements.resultCount) {
        if (shown === total) {
            elements.resultCount.textContent = `${total} filer`;
        } else {
            elements.resultCount.textContent = `${shown} av ${total} filer`;
        }
    }

    const hasFilters = activeCategory !== 'alle' || searchQuery.length > 0;
    if (elements.resetFilters) elements.resetFilters.hidden = !hasFilters;
}

function resetAllFilters() {
    searchQuery = '';
    activeCategory = 'alle';

    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.searchClear) elements.searchClear.hidden = true;

    updateCategoryButtons();
    applyFilters();
}

function updateCategoryButtons() {
    if (!elements.categoryFilters) return;
    const chips = elements.categoryFilters.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
        chip.classList.toggle('filter-chip--active', chip.dataset.category === activeCategory);
    });
}

// ============================================================================
// Rendering — File List
// ============================================================================

function renderFiles() {
    if (!elements.filesList) return;

    if (filteredFiles.length === 0) {
        elements.filesList.innerHTML = '';
        if (elements.emptyState) elements.emptyState.hidden = false;
        return;
    }

    if (elements.emptyState) elements.emptyState.hidden = true;

    const html = filteredFiles.map(file => {
        const isMarked = markedFileIds.has(String(file.id));
        const markedClass = isMarked ? ' file-row--marked' : '';
        const title = highlightText(file.navn, searchQuery);

        // Build meta items
        const metaItems = [];
        const filtype = file.navn ? file.navn.split('.').pop() : '';
        if (filtype) metaItems.push(`<span>${escapeHtml(filtype.toUpperCase())}</span>`);
        if (file.filterCategory) {
            const tagClass = `file-row__tag--${file.filterCategory}`;
            const label = file.filterCategory.charAt(0).toUpperCase() + file.filterCategory.slice(1);
            metaItems.push(`<span class="file-row__tag ${tagClass}">${escapeHtml(label)}</span>`);
        }
        if (file.verk) metaItems.push(`<span>${highlightText(file.verk, searchQuery)}</span>`);
        if (file.stemme) metaItems.push(`<span>${escapeHtml(file.stemme)}</span>`);
        if (file.anledning) metaItems.push(`<span>${highlightText(file.anledning, searchQuery)}</span>`);

        return `
            <div class="file-row${markedClass}" data-id="${escapeHtml(String(file.id))}">
                <label class="file-row__checkbox">
                    <input type="checkbox" data-id="${escapeHtml(String(file.id))}" ${isMarked ? 'checked' : ''}>
                </label>
                <div class="file-row__info">
                    <div class="file-row__title">${title}</div>
                    <div class="file-row__meta">${metaItems.join('')}</div>
                </div>
            </div>
        `;
    }).join('');

    elements.filesList.innerHTML = html;
}

// ============================================================================
// Rendering — Marked Panel
// ============================================================================

function renderMarkedPanel() {
    const count = markedFileIds.size;

    // Update count badge
    if (elements.markedCount) elements.markedCount.textContent = count;

    // Show/hide form and actions
    const hasMarked = count > 0;
    if (elements.markedForm) elements.markedForm.hidden = !hasMarked;
    if (elements.markedActions) elements.markedActions.hidden = !hasMarked;

    // Render marked list
    if (!elements.markedList) return;

    if (count === 0) {
        elements.markedList.innerHTML = '<p class="marked-panel__empty">Ingen filer er merket</p>';
        return;
    }

    const html = Array.from(markedFileIds).map(id => {
        const file = allFiles.find(f => String(f.id) === id);
        if (!file) return '';
        return `
            <div class="marked-item" data-id="${escapeHtml(id)}">
                <span class="marked-item__title">${escapeHtml(file.navn || 'Ukjent')}</span>
                <button class="marked-item__remove" data-id="${escapeHtml(id)}" title="Fjern">✕</button>
            </div>
        `;
    }).join('');

    elements.markedList.innerHTML = html;
}

// ============================================================================
// Multi-select
// ============================================================================

function toggleFileMarked(fileId) {
    const id = String(fileId);
    if (markedFileIds.has(id)) {
        markedFileIds.delete(id);
    } else {
        markedFileIds.add(id);
    }
    renderFiles();
    renderMarkedPanel();
}

function selectAllVisible() {
    filteredFiles.forEach(file => {
        markedFileIds.add(String(file.id));
    });
    renderFiles();
    renderMarkedPanel();
}

function deselectAll() {
    markedFileIds.clear();
    renderFiles();
    renderMarkedPanel();
}

// ============================================================================
// Actions
// ============================================================================

async function handleUpdateMetadata() {
    if (markedFileIds.size === 0) {
        showToast('Ingen filer er merket', 'error');
        return;
    }

    // Collect non-empty field values
    const metadata = {};
    const kategori = elements.kategoriInput?.value;
    const verk = elements.verkInput?.value.trim();
    const stemme = elements.stemmeInput?.value;
    const sorteringVal = elements.sorteringInput?.value;
    const anledning = elements.anledningInput?.value.trim();

    if (kategori) metadata.kategori = kategori;
    if (verk) metadata.verk = verk;
    if (stemme) metadata.stemme = stemme;
    if (sorteringVal !== '' && sorteringVal != null) metadata.sortering = Number(sorteringVal);
    if (anledning) metadata.anledning = anledning;

    if (Object.keys(metadata).length === 0) {
        showToast('Fyll inn minst ett felt', 'error');
        return;
    }

    const fileIds = Array.from(markedFileIds);

    function applyLocally() {
        allFiles.forEach(file => {
            if (markedFileIds.has(String(file.id))) {
                Object.assign(file, metadata);
                // Re-normalize filterCategory if kategori changed
                if (metadata.kategori !== undefined) {
                    const raw = (file.kategori || '').toLowerCase();
                    file.filterCategory = raw === 'øvefil' ? 'ovefil' : raw;
                }
            }
        });
        applyFilters();
    }

    try {
        showLoader();
        const apiUrl = window.ENV?.POWER_AUTOMATE_FILES_UPDATE_URL;
        if (apiUrl) {
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileIds, ...metadata })
            });
        }
        applyLocally();
        showToast(`Metadata oppdatert for ${fileIds.length} filer`);
    } catch (error) {
        console.error('Error updating metadata:', error);
        applyLocally();
        showToast('Lagret lokalt (API ikke tilgjengelig)', 'success');
    } finally {
        hideLoader();
    }
}

async function handleUploadToBlob() {
    if (markedFileIds.size === 0) {
        showToast('Ingen filer er merket', 'error');
        return;
    }

    const fileReferences = Array.from(markedFileIds).map(id => {
        const file = allFiles.find(f => String(f.id) === id);
        return file ? { id: file.id, url: file.url, navn: file.navn } : null;
    }).filter(Boolean);

    try {
        showLoader();
        const apiUrl = window.ENV?.POWER_AUTOMATE_BLOB_UPLOAD_URL;
        if (!apiUrl) throw new Error('Blob upload URL not configured');
        await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: fileReferences })
        });
        showToast(`${fileReferences.length} filer lastet opp til blob-storage`);
    } catch (error) {
        console.error('Error uploading to blob:', error);
        showToast('Kunne ikke laste opp til blob-storage', 'error');
    } finally {
        hideLoader();
    }
}

function handleClearBlob() {
    showConfirmDialog(
        'Tøm blob-storage',
        'Er du sikker på at du vil tømme all blob-storage? Denne handlingen kan ikke angres.',
        async () => {
            try {
                showLoader();
                const apiUrl = window.ENV?.POWER_AUTOMATE_BLOB_CLEAR_URL;
                if (!apiUrl) throw new Error('Blob clear URL not configured');
                await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clear_all' })
                });
                showToast('Blob-storage er tømt');
            } catch (error) {
                console.error('Error clearing blob:', error);
                showToast('Kunne ikke tømme blob-storage', 'error');
            } finally {
                hideLoader();
            }
        }
    );
}

// ============================================================================
// Blob Sync
// ============================================================================

async function handleSyncBlob() {
    try {
        showLoader();
        const apiUrl = window.ENV?.POWER_AUTOMATE_FILES_SYNC_URL;
        if (!apiUrl) throw new Error('Files sync URL not configured');

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();

        showToast(`${data.synced} nye filer synkronisert, ${data.skipped} allerede i tabellen`);
        await loadFiles();
    } catch (error) {
        console.error('Error syncing from blob:', error);
        showToast('Kunne ikke synkronisere fra blob-storage', 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// File Upload
// ============================================================================

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function handleFileUpload() {
    const files = elements.uploadFileInput?.files;
    if (!files || files.length === 0) return;

    try {
        showLoader();

        const filer = [];
        for (const file of files) {
            const innhold = await readFileAsBase64(file);
            filer.push({ navn: file.name, innhold });
        }

        const apiUrl = window.ENV?.POWER_AUTOMATE_FILES_UPLOAD_URL;
        if (!apiUrl) throw new Error('Files upload URL not configured');

        await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filer })
        });

        showToast(`${filer.length} fil${filer.length > 1 ? 'er' : ''} lastet opp`);
        await loadFiles();
    } catch (error) {
        console.error('Error uploading files:', error);
        showToast('Kunne ikke laste opp filer', 'error');
    } finally {
        hideLoader();
        if (elements.uploadFileInput) elements.uploadFileInput.value = '';
    }
}

// ============================================================================
// Confirm Dialog
// ============================================================================

function showConfirmDialog(title, message, callback) {
    if (elements.confirmTitle) elements.confirmTitle.textContent = title;
    if (elements.confirmMessage) elements.confirmMessage.textContent = message;
    confirmCallback = callback;

    if (elements.confirmOverlay) {
        elements.confirmOverlay.style.display = 'flex';
        elements.confirmOverlay.classList.add('open');
        elements.confirmOverlay.setAttribute('aria-hidden', 'false');
    }
}

function closeConfirmDialog() {
    confirmCallback = null;
    if (elements.confirmOverlay) {
        elements.confirmOverlay.classList.remove('open');
        elements.confirmOverlay.style.display = 'none';
        elements.confirmOverlay.setAttribute('aria-hidden', 'true');
    }
}

// ============================================================================
// Error state
// ============================================================================

function showError(message) {
    if (elements.errorState) elements.errorState.hidden = false;
    if (elements.errorMessage) elements.errorMessage.textContent = message;
    if (elements.filesList) elements.filesList.innerHTML = '';
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
    // Search
    elements.searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (elements.searchClear) elements.searchClear.hidden = searchQuery.length === 0;
        applyFilters();
    });

    elements.searchClear?.addEventListener('click', () => {
        searchQuery = '';
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.searchClear) elements.searchClear.hidden = true;
        applyFilters();
    });

    // Category filters (single-select)
    elements.categoryFilters?.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        activeCategory = chip.dataset.category;
        updateCategoryButtons();
        applyFilters();
    });

    // Reset filters
    elements.resetFilters?.addEventListener('click', resetAllFilters);

    // File list — checkbox and row click
    elements.filesList?.addEventListener('click', (e) => {
        const checkbox = e.target.closest('input[type="checkbox"]');
        if (checkbox) {
            e.stopPropagation();
            toggleFileMarked(checkbox.dataset.id);
            return;
        }

        const row = e.target.closest('.file-row');
        if (row) {
            toggleFileMarked(row.dataset.id);
        }
    });

    // Select all / Deselect all
    elements.selectAllBtn?.addEventListener('click', selectAllVisible);
    elements.deselectAllBtn?.addEventListener('click', deselectAll);

    // Marked list — remove button
    elements.markedList?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.marked-item__remove');
        if (removeBtn) {
            const id = removeBtn.dataset.id;
            markedFileIds.delete(id);
            renderFiles();
            renderMarkedPanel();
        }
    });

    // Upload files
    elements.uploadFilesBtn?.addEventListener('click', () => {
        elements.uploadFileInput?.click();
    });
    elements.uploadFileInput?.addEventListener('change', handleFileUpload);

    // Action buttons
    elements.syncBlobBtn?.addEventListener('click', handleSyncBlob);
    elements.updateMetadataBtn?.addEventListener('click', handleUpdateMetadata);
    elements.uploadBlobBtn?.addEventListener('click', handleUploadToBlob);
    elements.clearBlobBtn?.addEventListener('click', handleClearBlob);

    // Confirm dialog
    elements.confirmCancel?.addEventListener('click', closeConfirmDialog);
    elements.confirmOk?.addEventListener('click', () => {
        const callback = confirmCallback;
        closeConfirmDialog();
        if (callback) callback();
    });

    elements.confirmOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.confirmOverlay) {
            closeConfirmDialog();
        }
    });

    // Retry button
    elements.retryButton?.addEventListener('click', loadFiles);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.confirmOverlay?.classList.contains('open')) {
                closeConfirmDialog();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            elements.searchInput?.focus();
        }
    });
}

// ============================================================================
// Initialize
// ============================================================================

function init() {
    if (!result) return;

    if (elements.currentYear) {
        elements.currentYear.textContent = new Date().getFullYear();
    }

    initEventListeners();
    loadFiles();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
