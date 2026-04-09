/**
 * Filbehandling - Administrasjonsside for filkategorisering
 * Kammerkoret Utsikten
 */

// ============================================================================
// Mockdata
// ============================================================================
const MOCK_DATA = {
    filer: [
        {
            id: "1",
            navn: "Halleluja - Sopran ovefil.mp3",
            kategori: "Øvefil",
            url: "/filer/musikk/halleluja-sopran.mp3",
            sortering: 1,
            verk: "Halleluja fra Messias",
            stemme: "Sopran-1",
            anledning: "Julekonsert 2024"
        },
        {
            id: "2",
            navn: "Julekonsert 2023 - Opptak.wav",
            kategori: "Opptak",
            url: "/filer/musikk/julekonsert-2023.wav",
            sortering: 2,
            verk: "",
            stemme: "",
            anledning: "Julekonsert 2023"
        },
        {
            id: "3",
            navn: "Zadok the Priest - Tenor.mp3",
            kategori: "Øvefil",
            url: "/filer/musikk/zadok-tenor.mp3",
            sortering: 3,
            verk: "Zadok the Priest",
            stemme: "Tenor-1",
            anledning: "Jubileumskonsert 2025"
        },
        {
            id: "4",
            navn: "O Magnum Mysterium - Alt.mp3",
            kategori: "Øvefil",
            url: "/filer/musikk/o-magnum-alt.mp3",
            sortering: 4,
            verk: "O Magnum Mysterium",
            stemme: "Alt-1",
            anledning: "Julekonsert 2024"
        },
        {
            id: "5",
            navn: "Ave Maria - Partitur.pdf",
            kategori: "Note",
            url: "/filer/noter/ave-maria-partitur.pdf",
            sortering: 5,
            verk: "Ave Maria",
            stemme: "Partitur",
            anledning: "Varkonsert 2025"
        },
        {
            id: "6",
            navn: "O Magnum Mysterium - Alt stemme.pdf",
            kategori: "Note",
            url: "/filer/noter/o-magnum-alt.pdf",
            sortering: 6,
            verk: "O Magnum Mysterium",
            stemme: "Alt-1",
            anledning: "Julekonsert 2024"
        },
        {
            id: "7",
            navn: "Halleluja - Tutti noter.pdf",
            kategori: "Note",
            url: "/filer/noter/halleluja-tutti.pdf",
            sortering: 7,
            verk: "Halleluja fra Messias",
            stemme: "Tutti",
            anledning: "Julekonsert 2024"
        },
        {
            id: "8",
            navn: "Konsertbilde domkirken.jpg",
            kategori: "",
            url: "/filer/bilder/domkirken-2024.jpg",
            sortering: null,
            verk: "",
            stemme: "",
            anledning: "Julekonsert 2024"
        },
        {
            id: "9",
            navn: "Kortur Bergen 2024.png",
            kategori: "",
            url: "/filer/bilder/kortur-bergen.png",
            sortering: null,
            verk: "",
            stemme: "",
            anledning: "Kortur Bergen 2024"
        },
        {
            id: "10",
            navn: "Sideskift-markering Sanctus.json",
            kategori: "Sideskift",
            url: "/filer/sideskift/sanctus.json",
            sortering: 10,
            verk: "Sanctus",
            stemme: "",
            anledning: ""
        }
    ]
};

// ============================================================================
// State
// ============================================================================
let allFiles = [];
let filteredFiles = [];
let activeCategories = new Set(['alle']);
let searchQuery = '';
let editingFile = null;

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
    editOverlay: document.getElementById('editOverlay'),
    editForm: document.getElementById('editForm'),
    editClose: document.getElementById('editClose'),
    editCancel: document.getElementById('editCancel'),
    editTitle: document.getElementById('editTitle'),
    editFileId: document.getElementById('editFileId'),
    editFilename: document.getElementById('editFilename'),
    editFiletype: document.getElementById('editFiletype'),
    toast: document.getElementById('toast'),
    themeBtn: document.getElementById('themeBtn'),
    menuBtn: document.getElementById('menuBtn'),
    menuOverlay: document.getElementById('menuOverlay'),
    menuClose: document.getElementById('menuClose'),
    menuList: document.getElementById('menuList'),
    currentYear: document.getElementById('currentYear')
};

// Universal edit form fields
const editFields = {
    kategori: document.getElementById('editKategori'),
    verk: document.getElementById('editVerk'),
    stemme: document.getElementById('editStemme'),
    sortering: document.getElementById('editSortering'),
    anledning: document.getElementById('editAnledning')
};

// ============================================================================
// Utility Functions
// ============================================================================

function getFileIcon(filterCategory) {
    const icons = {
        note: '📄',
        opptak: '🎵',
        ovefil: '🎧',
        sideskift: '📋'
    };
    return icons[filterCategory] || '📁';
}

function getCategoryLabel(filterCategory) {
    const labels = {
        note: 'Note',
        opptak: 'Opptak',
        ovefil: 'Øvefil',
        sideskift: 'Sideskift'
    };
    return labels[filterCategory] || filterCategory || 'Ukategorisert';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('no-NO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function escapeHtml(text) {
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
    elements.toast.textContent = message;
    elements.toast.className = `toast toast--visible toast--${type}`;
    setTimeout(() => {
        elements.toast.classList.remove('toast--visible');
    }, 3000);
}

function showLoader() {
    elements.loader.classList.add('active');
}

function hideLoader() {
    elements.loader.classList.remove('active');
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
    elements.errorState.hidden = true;
    elements.emptyState.hidden = true;

    try {
        // Try to fetch from API if URL is configured
        const apiUrl = window.ENV?.POWER_AUTOMATE_FILES_URL;

        if (apiUrl) {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('API error');
            const data = await response.json();

            // Handle Power Automate response wrapper
            let files = data.body || data.filer || data;
            if (typeof files === 'string') {
                files = JSON.parse(files);
            }
            allFiles = Array.isArray(files) ? files.map(normalizeFile) : [];
        } else {
            // Use mock data
            console.log('Using mock data (no API URL configured)');
            allFiles = MOCK_DATA.filer;
        }

        // Sort by title
        allFiles.sort((a, b) => {
            const sa = a.sortering ?? Infinity;
            const sb = b.sortering ?? Infinity;
            if (sa !== sb) return sa - sb;
            return (a.navn || '').localeCompare(b.navn || '', 'no');
        });

        applyFilters();
        hideLoader();
    } catch (error) {
        console.error('Error loading files:', error);

        // Fallback to mock data on error
        console.log('Falling back to mock data');
        allFiles = MOCK_DATA.filer;
        allFiles.sort((a, b) => {
            const sa = a.sortering ?? Infinity;
            const sb = b.sortering ?? Infinity;
            if (sa !== sb) return sa - sb;
            return (a.navn || '').localeCompare(b.navn || '', 'no');
        });
        applyFilters();
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
        if (!activeCategories.has('alle')) {
            const fc = file.filterCategory || '';
            const isEmpty = fc === '';

            if (isEmpty) {
                if (!activeCategories.has('tom')) return false;
            } else {
                if (!activeCategories.has(fc)) return false;
            }
        }

        // Search filter — matches navn, anledning, verk
        if (query) {
            const navnMatch = (file.navn || '').toLowerCase().includes(query);
            const anledningMatch = (file.anledning || '').toLowerCase().includes(query);
            const verkMatch = (file.verk || '').toLowerCase().includes(query);
            if (!navnMatch && !anledningMatch && !verkMatch) return false;
        }

        return true;
    });

    renderFiles();
    updateFilterStatus();
}

function updateFilterStatus() {
    const total = allFiles.length;
    const shown = filteredFiles.length;

    if (shown === total) {
        elements.resultCount.textContent = `Viser ${total} filer`;
    } else {
        elements.resultCount.textContent = `Viser ${shown} av ${total} filer`;
    }

    // Show reset button if filters are active
    const hasFilters = !activeCategories.has('alle') || searchQuery.length > 0;
    elements.resetFilters.hidden = !hasFilters;
}

function resetFilters() {
    searchQuery = '';
    elements.searchInput.value = '';
    elements.searchClear.hidden = true;

    activeCategories = new Set(['alle']);
    updateCategoryButtons();

    applyFilters();
}

function updateCategoryButtons() {
    const chips = elements.categoryFilters.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
        const category = chip.dataset.category;
        if (activeCategories.has(category)) {
            chip.classList.add('filter-chip--active');
        } else {
            chip.classList.remove('filter-chip--active');
        }
    });
}

// ============================================================================
// Rendering
// ============================================================================

function renderFiles() {
    if (filteredFiles.length === 0) {
        elements.filesList.innerHTML = '';
        elements.emptyState.hidden = false;
        return;
    }

    elements.emptyState.hidden = true;

    const html = filteredFiles.map(file => {
        const icon = getFileIcon(file.filterCategory);
        const categoryLabel = getCategoryLabel(file.filterCategory);
        const title = highlightText(file.navn, searchQuery);
        const filtype = file.navn ? file.navn.split('.').pop() : '';

        // Build meta info
        const metaItems = [];
        const tagClass = file.filterCategory || 'tom';
        metaItems.push(`<span class="file-row__tag file-row__tag--${tagClass}">${categoryLabel}</span>`);
        if (filtype) metaItems.push(`<span>${escapeHtml(filtype.toUpperCase())}</span>`);

        if (file.verk) metaItems.push(`<span>${escapeHtml(file.verk)}</span>`);
        if (file.stemme) metaItems.push(`<span>${escapeHtml(file.stemme.replace('-', ' '))}</span>`);
        if (file.anledning) metaItems.push(`<span>${escapeHtml(file.anledning)}</span>`);
        if (file.sortering != null) metaItems.push(`<span>#${file.sortering}</span>`);

        return `
            <div class="file-row" data-id="${file.id}">
                <div class="file-row__icon">${icon}</div>
                <div class="file-row__info">
                    <div class="file-row__title">${title}</div>
                    <div class="file-row__meta">${metaItems.join('')}</div>
                </div>
                <div class="file-row__actions">
                    <button class="file-row__edit-btn" data-id="${file.id}">Rediger</button>
                </div>
            </div>
        `;
    }).join('');

    elements.filesList.innerHTML = html;
}

// ============================================================================
// Edit Form
// ============================================================================

function openEditForm(fileId) {
    const file = allFiles.find(f => String(f.id) === String(fileId));
    if (!file) return;

    editingFile = file;

    const filtype = file.navn ? file.navn.split('.').pop() : '';

    // Set common fields
    elements.editFileId.value = file.id;
    elements.editFilename.textContent = file.navn;
    elements.editFiletype.textContent = filtype.toUpperCase();
    elements.editTitle.textContent = `Rediger - ${file.navn}`;

    // Populate universal fields
    if (editFields.kategori) editFields.kategori.value = file.kategori || '';
    if (editFields.verk) editFields.verk.value = file.verk || '';
    if (editFields.stemme) editFields.stemme.value = file.stemme || '';
    if (editFields.sortering) editFields.sortering.value = file.sortering ?? '';
    if (editFields.anledning) editFields.anledning.value = file.anledning || '';

    // Show overlay
    elements.editOverlay.classList.add('open');
    elements.editOverlay.setAttribute('aria-hidden', 'false');
}

function closeEditForm() {
    elements.editOverlay.classList.remove('open');
    elements.editOverlay.setAttribute('aria-hidden', 'true');
    editingFile = null;
}

async function saveEditForm(event) {
    event.preventDefault();

    if (!editingFile) return;

    const fileId = elements.editFileId.value;

    // Collect updated data from universal fields
    const updatedData = { id: fileId };
    if (editFields.kategori) updatedData.kategori = editFields.kategori.value;
    if (editFields.verk) updatedData.verk = editFields.verk.value;
    if (editFields.stemme) updatedData.stemme = editFields.stemme.value;
    if (editFields.sortering) {
        const val = editFields.sortering.value;
        updatedData.sortering = val !== '' ? Number(val) : null;
    }
    if (editFields.anledning) updatedData.anledning = editFields.anledning.value;

    try {
        // Try to save to API if URL is configured
        const apiUrl = window.ENV?.POWER_AUTOMATE_FILES_UPDATE_URL;

        if (apiUrl) {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) throw new Error('Save failed');
        }

        // Update local data and re-normalize
        const fileIndex = allFiles.findIndex(f => String(f.id) === String(fileId));
        if (fileIndex !== -1) {
            allFiles[fileIndex] = normalizeFile({ ...allFiles[fileIndex], ...updatedData });
        }

        closeEditForm();
        applyFilters();
        showToast('Endringer lagret');

    } catch (error) {
        console.error('Error saving:', error);

        // Still update locally for demo purposes
        const fileIndex = allFiles.findIndex(f => String(f.id) === String(fileId));
        if (fileIndex !== -1) {
            allFiles[fileIndex] = normalizeFile({ ...allFiles[fileIndex], ...updatedData });
        }

        closeEditForm();
        applyFilters();
        showToast('Lagret lokalt (API ikke tilgjengelig)', 'success');
    }
}

// ============================================================================
// Theme & Menu (shared functionality)
// ============================================================================

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeButton(next);
}

function updateThemeButton(theme) {
    if (elements.themeBtn) {
        elements.themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

function openMenu() {
    elements.menuOverlay.classList.add('open');
    elements.menuOverlay.setAttribute('aria-hidden', 'false');
    elements.menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
    elements.menuOverlay.classList.remove('open');
    elements.menuOverlay.setAttribute('aria-hidden', 'true');
    elements.menuBtn.setAttribute('aria-expanded', 'false');
}

async function loadNavigation() {
    try {
        const navUrl = window.ENV?.POWER_AUTOMATE_NAVIGATION_URL;
        if (!navUrl) {
            elements.menuList.innerHTML = '<p style="padding: 1rem; color: var(--muted);">Meny ikke tilgjengelig</p>';
            return;
        }

        const response = await fetch(navUrl);
        if (!response.ok) throw new Error('Nav error');

        const data = await response.json();
        const items = data.navigation || data || [];

        const html = items.map(item => `
            <a href="${item.url}" class="uts-menuItem ${item.url === '/filbehandling.html' ? 'uts-menuItem--active' : ''}">
                <span class="uts-menuItem__icon">${item.icon || '📄'}</span>
                ${item.title}
            </a>
        `).join('');

        elements.menuList.innerHTML = html;
    } catch (error) {
        console.error('Navigation error:', error);
        elements.menuList.innerHTML = '<p style="padding: 1rem; color: var(--muted);">Kunne ikke laste meny</p>';
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        elements.searchClear.hidden = searchQuery.length === 0;
        applyFilters();
    });

    elements.searchClear.addEventListener('click', () => {
        searchQuery = '';
        elements.searchInput.value = '';
        elements.searchClear.hidden = true;
        applyFilters();
    });

    // Category filters
    elements.categoryFilters.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        const category = chip.dataset.category;

        if (category === 'alle') {
            activeCategories = new Set(['alle']);
        } else {
            activeCategories.delete('alle');

            if (activeCategories.has(category)) {
                activeCategories.delete(category);
                if (activeCategories.size === 0) {
                    activeCategories.add('alle');
                }
            } else {
                activeCategories.add(category);
            }
        }

        updateCategoryButtons();
        applyFilters();
    });

    // Reset filters
    elements.resetFilters.addEventListener('click', resetFilters);

    // File list - edit button
    elements.filesList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.file-row__edit-btn');
        if (editBtn) {
            openEditForm(editBtn.dataset.id);
        }
    });

    // Edit form
    elements.editForm.addEventListener('submit', saveEditForm);
    elements.editClose.addEventListener('click', closeEditForm);
    elements.editCancel.addEventListener('click', closeEditForm);

    // Close edit on overlay click
    elements.editOverlay.addEventListener('click', (e) => {
        if (e.target === elements.editOverlay) {
            closeEditForm();
        }
    });

    // Retry button
    elements.retryButton.addEventListener('click', loadFiles);

    // Theme toggle
    if (elements.themeBtn) {
        elements.themeBtn.addEventListener('click', toggleTheme);
    }

    // Menu
    if (elements.menuBtn) {
        elements.menuBtn.addEventListener('click', openMenu);
    }
    if (elements.menuClose) {
        elements.menuClose.addEventListener('click', closeMenu);
    }
    if (elements.menuOverlay) {
        elements.menuOverlay.addEventListener('click', (e) => {
            if (e.target === elements.menuOverlay) {
                closeMenu();
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.editOverlay.classList.contains('open')) {
                closeEditForm();
            } else if (elements.menuOverlay.classList.contains('open')) {
                closeMenu();
            }
        }
    });
}

// ============================================================================
// Initialize
// ============================================================================

function init() {
    // Set current year
    if (elements.currentYear) {
        elements.currentYear.textContent = new Date().getFullYear();
    }

    initTheme();
    initEventListeners();
    loadNavigation();
    loadFiles();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
