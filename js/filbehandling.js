/**
 * Filbehandling - Administrasjonsside for filkategorisering og opplasting
 * Kammerkoret Utsikten
 */

// ============================================================================
// State
// ============================================================================
let allFiles = [];
let filteredFiles = [];
let activeCategories = new Set(['alle']);
let searchQuery = '';
let editingFile = null;
let selectedFileIds = new Set();

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
    currentYear: document.getElementById('currentYear'),
    batchToolbar: document.getElementById('batchToolbar'),
    batchCount: document.getElementById('batchCount'),
    batchSelectAll: document.getElementById('batchSelectAll'),
    batchDeselectAll: document.getElementById('batchDeselectAll'),
    batchSetMeta: document.getElementById('batchSetMeta'),
    batchFields: document.getElementById('batchFields'),
    batchApply: document.getElementById('batchApply'),
    batchKategori: document.getElementById('batchKategori'),
    batchStemme: document.getElementById('batchStemme'),
    batchVerk: document.getElementById('batchVerk'),
    batchAnledning: document.getElementById('batchAnledning'),
    batchSortering: document.getElementById('batchSortering'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    uploadFill: document.getElementById('uploadFill'),
    uploadText: document.getElementById('uploadText'),
    importUrl: document.getElementById('importUrl'),
    importBtn: document.getElementById('importBtn'),
    importStatus: document.getElementById('importStatus'),
    anledningSelect: document.getElementById('anledningSelect'),
    anledningBtn: document.getElementById('anledningBtn'),
    anledningStatus: document.getElementById('anledningStatus'),
};

const editFields = {
    kategori: document.getElementById('editKategori'),
    verk: document.getElementById('editVerk'),
    stemme: document.getElementById('editStemme'),
    sortering: document.getElementById('editSortering'),
    anledning: document.getElementById('editAnledning')
};

// ============================================================================
// API helpers
// ============================================================================

const API_BASE = (() => {
    const url = window.ENV?.POWER_AUTOMATE_FILES_URL || '';
    // Extract base from e.g. "http://localhost:3001/api/filer"
    return url.replace(/\/filer\/?$/, '');
})();

async function apiGet(path) {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
    const data = await response.json();
    return data.body || data;
}

async function apiPost(path, body) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`POST ${path}: ${response.status}`);
    const data = await response.json();
    return data.body || data;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getFileIcon(kategori) {
    const icons = { 'Note': '📄', 'Opptak': '🎵', 'Øvefil': '🎧', 'Sideskift': '📋', 'Dokument': '📑', 'Bilde': '🖼️' };
    return icons[kategori] || '📁';
}

function filterCategoryFromKategori(kategori) {
    const map = { 'Note': 'note', 'Opptak': 'opptak', 'Øvefil': 'ovefil', 'Sideskift': 'sideskift', 'Dokument': 'dokument', 'Bilde': 'bilde' };
    return map[kategori] || '';
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
    setTimeout(() => elements.toast.classList.remove('toast--visible'), 3000);
}

function showLoader() { elements.loader.classList.add('active'); }
function hideLoader() { elements.loader.classList.remove('active'); }

// ============================================================================
// Data Loading
// ============================================================================

async function loadFiles() {
    showLoader();
    elements.errorState.hidden = true;
    elements.emptyState.hidden = true;

    try {
        const data = await apiGet('/filer');
        allFiles = (data.filer || []).map(f => ({
            ...f,
            filterCategory: filterCategoryFromKategori(f.kategori),
        }));

        allFiles.sort((a, b) => {
            const sa = a.sortering ?? Infinity;
            const sb = b.sortering ?? Infinity;
            if (sa !== sb) return sa - sb;
            return (a.navn || '').localeCompare(b.navn || '', 'no');
        });

        applyFilters();
    } catch (error) {
        console.error('Error loading files:', error);
        elements.errorState.hidden = false;
        elements.errorMessage.textContent = error.message;
    } finally {
        hideLoader();
    }
}

// ============================================================================
// Anledning Selector
// ============================================================================

async function loadAnledninger() {
    try {
        // Load available anledninger and current active
        const [anledningerData, metaData] = await Promise.all([
            apiGet('/filer/anledninger'),
            apiGet('/ovelse/meta'),
        ]);

        const anledninger = anledningerData.anledninger || [];
        const activeAnledning = metaData.anledning || '';

        const select = elements.anledningSelect;
        select.innerHTML = '<option value="">(Ingen valgt)</option>';
        for (const a of anledninger) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            if (a === activeAnledning) opt.selected = true;
            select.appendChild(opt);
        }

        elements.anledningStatus.textContent = activeAnledning
            ? `Aktiv: ${activeAnledning}`
            : 'Ingen aktiv anledning';

        // Populate batch anledning dropdown
        if (elements.batchAnledning) {
            elements.batchAnledning.innerHTML = '<option value="">(Ikke endre)</option><option value="__clear__">(Tøm feltet)</option>';
            for (const a of anledninger) {
                const opt = document.createElement('option');
                opt.value = a;
                opt.textContent = a;
                elements.batchAnledning.appendChild(opt);
            }
        }
    } catch (err) {
        console.error('Load anledninger error:', err);
        elements.anledningSelect.innerHTML = '<option value="">Kunne ikke laste</option>';
    }
}

async function setActiveAnledning() {
    const anledning = elements.anledningSelect.value;
    elements.anledningBtn.disabled = true;

    try {
        await apiPost('/ovelse/meta', { anledning });
        elements.anledningStatus.textContent = anledning
            ? `Aktiv: ${anledning}`
            : 'Ingen aktiv anledning';
        showToast(anledning ? `Aktiv anledning satt til "${anledning}"` : 'Aktiv anledning fjernet');
    } catch (err) {
        console.error('Set anledning error:', err);
        showToast('Kunne ikke sette anledning', 'error');
    } finally {
        elements.anledningBtn.disabled = false;
    }
}

// ============================================================================
// Metadata Import
// ============================================================================

async function importMetadata() {
    const url = elements.importUrl.value.trim();
    if (!url) return showToast('Lim inn en URL først', 'error');

    elements.importBtn.disabled = true;
    elements.importStatus.textContent = 'Henter metadata...';

    try {
        const result = await apiPost('/filer/importer-metadata', { url });
        elements.importStatus.textContent = result.message || `${result.created} nye, ${result.updated} oppdatert`;
        showToast(`Metadata importert: ${result.created} nye, ${result.updated} oppdatert`);
        await loadFiles();
    } catch (err) {
        console.error('Import error:', err);
        elements.importStatus.textContent = `Feil: ${err.message}`;
        showToast('Kunne ikke importere metadata', 'error');
    } finally {
        elements.importBtn.disabled = false;
    }
}

// ============================================================================
// File Upload
// ============================================================================

async function uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    elements.uploadProgress.hidden = false;
    const total = fileList.length;
    let done = 0;

    // Process in batches of 5 to avoid huge payloads
    const batchSize = 5;
    for (let i = 0; i < total; i += batchSize) {
        const batch = Array.from(fileList).slice(i, i + batchSize);
        const filer = [];

        for (const file of batch) {
            const buffer = await file.arrayBuffer();
            const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''));
            filer.push({ navn: file.name, innhold: base64 });
        }

        try {
            const result = await apiPost('/filer/last-opp-til-server', { filer });
            done += result.uploadedCount || batch.length;
        } catch (err) {
            console.error('Upload batch error:', err);
            showToast(`Feil ved opplasting: ${err.message}`, 'error');
        }

        elements.uploadFill.style.width = `${(done / total) * 100}%`;
        elements.uploadText.textContent = `${done} av ${total} filer lastet opp...`;
    }

    elements.uploadProgress.hidden = true;
    elements.uploadFill.style.width = '0%';

    showToast(`${done} fil(er) lastet opp`);
    await loadFiles();
}

async function removeFromServer(fileId) {
    try {
        await apiPost('/filer/fjern-fra-server', { id: fileId });
        showToast('Fil fjernet fra server');
        await loadFiles();
    } catch (err) {
        console.error('Remove error:', err);
        showToast('Kunne ikke fjerne fil', 'error');
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

            // Upload status filters
            if (activeCategories.has('uploaded') && !file.uploaded) return false;
            if (activeCategories.has('not-uploaded') && file.uploaded) return false;

            // Category filters (only if a category chip is active)
            const categoryChips = ['tom', 'note', 'opptak', 'ovefil', 'sideskift', 'dokument', 'bilde'];
            const activeCats = categoryChips.filter(c => activeCategories.has(c));
            if (activeCats.length > 0) {
                if (isEmpty) {
                    if (!activeCategories.has('tom')) return false;
                } else {
                    if (!activeCategories.has(fc)) return false;
                }
            }
        }

        // Search filter
        if (query) {
            const fields = [file.navn, file.anledning, file.verk, file.stemme].map(s => (s || '').toLowerCase());
            if (!fields.some(f => f.includes(query))) return false;
        }

        return true;
    });

    renderFiles();
    updateFilterStatus();
}

function updateFilterStatus() {
    const total = allFiles.length;
    const shown = filteredFiles.length;
    const uploaded = allFiles.filter(f => f.uploaded).length;

    elements.resultCount.textContent = shown === total
        ? `${total} filer (${uploaded} på server)`
        : `${shown} av ${total} filer`;

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
        chip.classList.toggle('filter-chip--active', activeCategories.has(chip.dataset.category));
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
        const icon = getFileIcon(file.kategori);
        const title = highlightText(file.navn, searchQuery);
        const filtype = file.navn ? file.navn.split('.').pop().toUpperCase() : '';
        const uploadedClass = file.uploaded ? 'file-row--uploaded' : 'file-row--not-uploaded';
        const uploadedBadge = file.uploaded
            ? '<span class="file-row__badge file-row__badge--uploaded" title="På server">✓</span>'
            : '<span class="file-row__badge file-row__badge--missing" title="Ikke lastet opp">○</span>';

        const metaItems = [];
        const tagClass = file.filterCategory || 'tom';
        const categoryLabel = file.kategori || 'Ukategorisert';
        metaItems.push(`<span class="file-row__tag file-row__tag--${tagClass}">${categoryLabel}</span>`);
        if (filtype) metaItems.push(`<span>${escapeHtml(filtype)}</span>`);
        if (file.verk) metaItems.push(`<span>${escapeHtml(file.verk)}</span>`);
        if (file.stemme) metaItems.push(`<span>${escapeHtml(file.stemme)}</span>`);
        if (file.anledning) metaItems.push(`<span>${escapeHtml(file.anledning)}</span>`);
        if (file.sortering != null && file.sortering !== 999) metaItems.push(`<span>#${file.sortering}</span>`);

        const actionBtn = file.uploaded
            ? `<button class="file-row__action-btn file-row__action-btn--remove" data-id="${file.id}" data-action="remove" title="Fjern fra server">✕</button>`
            : `<label class="file-row__action-btn file-row__action-btn--upload" title="Last opp fil">
                 ⬆ <input type="file" data-id="${file.id}" data-navn="${escapeHtml(file.navn)}" data-action="upload-single" hidden>
               </label>`;

        const checked = selectedFileIds.has(file.id) ? 'checked' : '';

        return `
            <div class="file-row ${uploadedClass}" data-id="${file.id}">
                <input type="checkbox" class="file-row__checkbox" data-id="${file.id}" ${checked}>
                <div class="file-row__icon">${icon}${uploadedBadge}</div>
                <div class="file-row__info">
                    <div class="file-row__title">${title}</div>
                    <div class="file-row__meta">${metaItems.join('')}</div>
                </div>
                <div class="file-row__actions">
                    ${file.uploaded ? `<button class="file-row__action-btn file-row__action-btn--url" data-navn="${escapeHtml(file.navn)}" data-action="copy-url" title="Kopier URL">🔗</button>` : ''}
                    <button class="file-row__edit-btn" data-id="${file.id}">Rediger</button>
                    ${actionBtn}
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
    elements.editFileId.value = file.id;
    elements.editFilename.textContent = file.navn;
    elements.editFiletype.textContent = filtype.toUpperCase();
    elements.editTitle.textContent = `Rediger - ${file.navn}`;

    if (editFields.kategori) editFields.kategori.value = file.kategori || '';
    if (editFields.verk) editFields.verk.value = file.verk || '';
    if (editFields.stemme) editFields.stemme.value = file.stemme || '';
    if (editFields.sortering) editFields.sortering.value = (file.sortering != null && file.sortering !== 999) ? file.sortering : '';
    if (editFields.anledning) editFields.anledning.value = file.anledning || '';

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
        await apiPost('/filer/oppdater', updatedData);
        closeEditForm();
        showToast('Endringer lagret');
        await loadFiles();
    } catch (error) {
        console.error('Error saving:', error);
        showToast('Kunne ikke lagre endringer', 'error');
    }
}

// ============================================================================
// Batch Metadata
// ============================================================================

function updateBatchToolbar() {
    const count = selectedFileIds.size;
    if (elements.batchToolbar) {
        elements.batchToolbar.hidden = count === 0;
    }
    if (elements.batchCount) {
        elements.batchCount.textContent = `${count} valgt`;
    }
    if (count === 0 && elements.batchFields) {
        elements.batchFields.hidden = true;
    }
}

async function applyBatchMetadata() {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0) return showToast('Ingen filer valgt', 'error');

    const kategori = elements.batchKategori?.value;
    const stemme = elements.batchStemme?.value;
    const verk = elements.batchVerk?.value?.trim();
    const anledning = elements.batchAnledning?.value;
    const sorteringVal = elements.batchSortering?.value?.trim();

    // Check that at least one field is set or cleared
    const hasChange = kategori || stemme || verk || anledning || sorteringVal;
    if (!hasChange) {
        return showToast('Fyll inn minst ett felt', 'error');
    }

    showLoader();
    let success = 0;
    let failed = 0;

    for (const id of ids) {
        const updatedData = { id };
        if (kategori && kategori !== '__clear__') updatedData.kategori = kategori;
        else if (kategori === '__clear__') updatedData.kategori = '';
        if (stemme && stemme !== '__clear__') updatedData.stemme = stemme;
        else if (stemme === '__clear__') updatedData.stemme = '';
        if (verk) updatedData.verk = verk;
        if (anledning && anledning !== '__clear__') updatedData.anledning = anledning;
        else if (anledning === '__clear__') updatedData.anledning = '';
        if (sorteringVal) updatedData.sortering = Number(sorteringVal);

        try {
            await apiPost('/filer/oppdater', updatedData);
            success++;
        } catch (err) {
            console.error('Batch update error for', id, err);
            failed++;
        }
    }

    hideLoader();
    selectedFileIds.clear();
    elements.batchFields.hidden = true;
    updateBatchToolbar();

    // Reset batch fields
    if (elements.batchKategori) elements.batchKategori.value = '';
    if (elements.batchStemme) elements.batchStemme.value = '';
    if (elements.batchVerk) elements.batchVerk.value = '';
    if (elements.batchAnledning) elements.batchAnledning.value = '';
    if (elements.batchSortering) elements.batchSortering.value = '';

    showToast(`${success} filer oppdatert${failed ? `, ${failed} feilet` : ''}`);
    await loadFiles();
}

// ============================================================================
// Theme & Menu
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
    if (elements.themeBtn) elements.themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
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
        const items = data.body || data.navigation || data || [];

        const html = (Array.isArray(items) ? items : []).map(item => `
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
                if (activeCategories.size === 0) activeCategories.add('alle');
            } else {
                activeCategories.add(category);
            }
        }
        updateCategoryButtons();
        applyFilters();
    });

    elements.resetFilters.addEventListener('click', resetFilters);

    // Checkbox selection
    elements.filesList.addEventListener('change', (e) => {
        const cb = e.target.closest('.file-row__checkbox');
        if (!cb) return;
        const id = cb.dataset.id;
        if (cb.checked) selectedFileIds.add(id);
        else selectedFileIds.delete(id);
        updateBatchToolbar();
    });

    // Batch actions
    elements.batchSelectAll?.addEventListener('click', () => {
        filteredFiles.forEach(f => selectedFileIds.add(f.id));
        renderFiles();
        updateBatchToolbar();
    });
    elements.batchDeselectAll?.addEventListener('click', () => {
        selectedFileIds.clear();
        renderFiles();
        updateBatchToolbar();
    });
    elements.batchSetMeta?.addEventListener('click', () => {
        elements.batchFields.hidden = !elements.batchFields.hidden;
    });
    elements.batchApply?.addEventListener('click', () => applyBatchMetadata());

    // File list — edit and remove buttons
    elements.filesList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.file-row__edit-btn');
        if (editBtn) return openEditForm(editBtn.dataset.id);

        const removeBtn = e.target.closest('[data-action="remove"]');
        if (removeBtn) {
            const id = removeBtn.dataset.id;
            const file = allFiles.find(f => f.id === id);
            if (file && confirm(`Fjerne "${file.navn}" fra server?\nMetadata beholdes.`)) {
                removeFromServer(id);
            }
        }

        const copyBtn = e.target.closest('[data-action="copy-url"]');
        if (copyBtn) {
            const navn = copyBtn.dataset.navn;
            const url = `/uploads/${encodeURIComponent(navn)}`;
            const fullUrl = `${location.origin}${url}`;
            navigator.clipboard.writeText(fullUrl).then(() => {
                showToast('URL kopiert til utklippstavle');
            }).catch(() => {
                // Fallback: show in prompt
                prompt('Kopier URL:', fullUrl);
            });
            return;
        }

        const uploadInput = e.target.closest('[data-action="upload-single"]');
        if (uploadInput) {
            uploadInput.addEventListener('change', async function handler() {
                uploadInput.removeEventListener('change', handler);
                if (!this.files.length) return;
                const file = this.files[0];
                const expectedName = this.dataset.navn;
                if (file.name !== expectedName) {
                    if (!confirm(`Filnavnet "${file.name}" stemmer ikke med "${expectedName}".\nLast opp likevel?`)) return;
                }
                await uploadFiles(this.files);
            }, { once: true });
        }
    });

    // Edit form
    elements.editForm.addEventListener('submit', saveEditForm);
    elements.editClose.addEventListener('click', closeEditForm);
    elements.editCancel.addEventListener('click', closeEditForm);
    elements.editOverlay.addEventListener('click', (e) => {
        if (e.target === elements.editOverlay) closeEditForm();
    });

    // Retry
    elements.retryButton.addEventListener('click', loadFiles);

    // Metadata import
    if (elements.importBtn) {
        elements.importBtn.addEventListener('click', importMetadata);
    }

    // Anledning selector
    if (elements.anledningBtn) {
        elements.anledningBtn.addEventListener('click', setActiveAnledning);
    }

    // Theme & menu
    if (elements.themeBtn) elements.themeBtn.addEventListener('click', toggleTheme);
    if (elements.menuBtn) elements.menuBtn.addEventListener('click', openMenu);
    if (elements.menuClose) elements.menuClose.addEventListener('click', closeMenu);
    if (elements.menuOverlay) {
        elements.menuOverlay.addEventListener('click', (e) => {
            if (e.target === elements.menuOverlay) closeMenu();
        });
    }

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.editOverlay.classList.contains('open')) closeEditForm();
            else if (elements.menuOverlay.classList.contains('open')) closeMenu();
        }
    });

    // --- Drag & drop ---
    const dz = elements.dropzone;
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dropzone--active'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dropzone--active'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('dropzone--active');
        uploadFiles(e.dataTransfer.files);
    });

    // File input
    elements.fileInput.addEventListener('change', (e) => {
        uploadFiles(e.target.files);
        e.target.value = '';
    });
}

// ============================================================================
// Initialize
// ============================================================================

function init() {
    if (elements.currentYear) elements.currentYear.textContent = new Date().getFullYear();
    initTheme();
    initEventListeners();
    loadNavigation();
    loadAnledninger();
    loadFiles();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
