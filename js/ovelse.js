/**
 * Øvelse - JavaScript
 *
 * Håndterer korøving med PDF-noter og lydavspilling
 * Optimalisert for touch og fullskjerm
 *
 * @module Ovelse
 * @version 4.0.0
 */

import { initPage, ThemeManager, MenuManager, getCurrentUserRole, hasRole } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';

// Mock mode for testing - evalueres lazy for å sikre at env.js har lastet
const useMock = () => !window.ENV?.POWER_AUTOMATE_PRACTICE_URL;

const OFFLINE_CACHE_NAME = 'korportal-practice-offline';

// ==========================================================================
// MOCK DATA
// ==========================================================================
const MOCK_DATA = {
    voice: "tutti",
    title: "Vårprogram 2026",
    baseUrls: {
        pdf: "https://utsiktenblob.blob.core.windows.net/sanger/",
        audio: "https://utsiktenblob.blob.core.windows.net/sanger/"
    },
    notes: [
        {
            id: "Ubi Caritas",
            noteTitle: "Ubi Caritas",
            pdfFilename: "Ubi Caritas - Ola Gjeilo.pdf",
            audio: {
                "sopran 1": "Ubi Caritas Geilo SATB - sopr 1.mp3",
                "sopran 2": "Ubi Caritas Geilo SATB - sopr 2.mp3",
                "alt 1": "Ubi Caritas Geilo SATB - alt.mp3",
                "alt 2": "Ubi Caritas Geilo SATB - alt.mp3",
                "tenor 1": "Ubi Caritas Geilo SATB - ten.mp3",
                "tenor 2": "Ubi Caritas Geilo SATB - ten.mp3",
                "bass 1": "Ubi Caritas Geilo SATB - bass.mp3",
                "bass 2": "Ubi Caritas Geilo SATB - bass.mp3",
                "tutti": "Ubi Caritas Geilo SATB - tutti.mp3"
            },
            pageTurns: [
                { time: 45.2, page: 2 },
                { time: 92.8, page: 3 },
                { time: 138.5, page: 4 }
            ]
        },
        {
            id: "Lift me up",
            noteTitle: "Lift me up",
            pdfFilename: "Lift Me Up EPRINT-Choral.pdf",
            audio: {
                "sopran 1": "Lift me up - Sopran 1.mp3",
                "sopran 2": "Lift me up - Sopran 2.mp3",
                "alt 1": "Lift me up - Alt 1.mp3",
                "alt 2": "Lift me up - Alt 2.mp3",
                "tenor 1": "Lift me up - Tenor.mp3",
                "tenor 2": "Lift me up - Tenor.mp3",
                "bass 1": "Lift me up - Bass.mp3",
                "bass 2": "Lift me up - Bass.mp3",
                "tutti": "Lift me up - Tutti.mp3"
            },
            pageTurns: [
                { time: 38.0, page: 2 },
                { time: 78.5, page: 3 },
                { time: 120.3, page: 2 },
                { time: 158.0, page: 4 }
            ]
        },
        {
            id: "Northern Lights",
            noteTitle: "Northern Lights",
            pdfFilename: "Northern Lights SATB.pdf",
            audio: {
                "sopran 1": "Northern Lights SATB - sopr.mp3",
                "sopran 2": "Northern Lights SATB - sopr.mp3",
                "alt 1": "Northern Lights SATB - alt 1.mp3",
                "alt 2": "Northern Lights SATB - alt 2.mp3",
                "tenor 1": "Northern Lights SATB - ten 1.mp3",
                "tenor 2": "Northern Lights SATB - ten 2.mp3",
                "bass 1": "Northern Lights SATB - bass.mp3",
                "bass 2": "Northern Lights SATB - bass.mp3",
                "tutti": "Northern Lights SATB - tutti.mp3"
            },
            pageTurns: []
        },
        {
            id: "Bruremarsj fra Valsøyfjord Aure",
            noteTitle: "Bruremarsj fra Valsøyfjord Aure",
            pdfFilename: "Bruremarsj-fra-Valsøyfjord-Aure.pdf",
            audio: {
                "sopran 1": "Bruremarsj-fra-Valsøyfjord-Aure - Sopran.mp3",
                "sopran 2": "Bruremarsj-fra-Valsøyfjord-Aure - Sopran.mp3",
                "alt 1": "Bruremarsj-fra-Valsøyfjord-Aure - Alt1.mp3",
                "alt 2": "Bruremarsj-fra-Valsøyfjord-Aure - Alt 2.mp3",
                "tenor 1": "Bruremarsj-fra-Valsøyfjord-Aure - Tenor.mp3",
                "tenor 2": "Bruremarsj-fra-Valsøyfjord-Aure - Tenor.mp3",
                "bass 1": "Bruremarsj-fra-Valsøyfjord-Aure - Bass.mp3",
                "bass 2": "Bruremarsj-fra-Valsøyfjord-Aure - Bass.mp3",
                "tutti": "Bruremarsj-fra-Valsøyfjord-Aure - Tutti.mp3"
            },
            pageTurns: [
                { time: 52.0, page: 2 },
                { time: 104.5, page: 3 }
            ]
        },
        {
            id: "A Light of Hope",
            noteTitle: "A Light of Hope",
            pdfFilename: "A Light of Hope.pdf",
            audio: {
                "sopran 1": "A Light of Hope - Sopran.mp3",
                "sopran 2": "A Light of Hope - Sopran.mp3",
                "alt 1": "A Light of Hope - Alt.mp3",
                "alt 2": "A Light of Hope - Alt.mp3",
                "tenor 1": "A Light of Hope - Tenor.mp3",
                "tenor 2": "A Light of Hope - Tenor.mp3",
                "bass 1": "A Light of Hope - Bass.mp3",
                "bass 2": "A Light of Hope - Bass.mp3",
                "tutti": "A Light of Hope - Tutti.mp3"
            },
            pageTurns: []
        },
        {
            id: "Stein på stein",
            noteTitle: "Stein på stein",
            pdfFilename: "Stein på Stein Utsikten.pdf",
            audio: {
                "sopran 1": "Stein på Stein Utsikten-Soprano.mp3",
                "sopran 2": "Stein på Stein Utsikten-Soprano.mp3",
                "alt 1": "Stein på Stein Utsikten-Alto.mp3",
                "alt 2": "Stein på Stein Utsikten-Alto.mp3",
                "tenor 1": "Stein på Stein Utsikten-Tenor.mp3",
                "tenor 2": "Stein på Stein Utsikten-Tenor.mp3",
                "bass 1": "Stein på Stein Utsikten-Bass.mp3",
                "bass 2": "Stein på Stein Utsikten-Bass.mp3",
                "tutti": "Stein på Stein Utsikten.mp3"
            },
            pageTurns: [
                { time: 60.0, page: 2 },
                { time: 125.0, page: 3 }
            ]
        },
        {
            id: "Når himmelen faller ned",
            noteTitle: "Når himmelen faller ned",
            pdfFilename: "Når himmelen faller ned Utsikten.pdf",
            audio: {
                "sopran 1": "Når himmelen faller ned Utsikten-Soprano.mp3",
                "sopran 2": "Når himmelen faller ned Utsikten-Soprano.mp3",
                "alt 1": "Når himmelen faller ned Utsikten-Alto.mp3",
                "alt 2": "Når himmelen faller ned Utsikten-Alto.mp3",
                "tenor 1": "Når himmelen faller ned Utsikten-Tenor.mp3",
                "tenor 2": "Når himmelen faller ned Utsikten-Tenor.mp3",
                "bass 1": "",
                "bass 2": "",
                "tutti": "Når himmelen faller ned Utsikten-tutti.mp3"
            },
            pageTurns: []
        },
        {
            id: "Lean on Me",
            noteTitle: "Lean on Me",
            pdfFilename: "Lean on Me Utsikten.pdf",
            audio: {
                "sopran 1": "Lean on Me Utsikten-Soprano.mp3",
                "sopran 2": "Lean on Me Utsikten-Soprano.mp3",
                "alt 1": "Lean on Me Utsikten-Alto.mp3",
                "alt 2": "Lean on Me Utsikten-Alto.mp3",
                "tenor 1": "Lean on Me Utsikten.mp3",
                "tenor 2": "Lean on Me Utsikten.mp3",
                "bass 1": "Lean on Me Utsikten-Bass.mp3",
                "bass 2": "Lean on Me Utsikten-Bass.mp3",
                "tutti": ""
            },
            pageTurns: []
        },
        {
            id: "Himmelhøge sti",
            noteTitle: "Himmelhøge sti",
            pdfFilename: "Himmelhøge sti.pdf",
            audio: {
                "sopran 1": "",
                "sopran 2": "",
                "alt 1": "",
                "alt 2": "",
                "tenor 1": "",
                "tenor 2": "",
                "bass 1": "",
                "bass 2": "",
                "tutti": ""
            },
            pageTurns: []
        }
    ]
};

// ==========================================================================
// PRACTICE APP
// ==========================================================================
class PracticeApp {
    constructor() {
        // State
        this.data = null;
        this.currentVoice = null;
        this.currentMode = 'both'; // 'both', 'notes', 'audio'
        this.currentWorkIndex = 0;
        this.currentPage = 1;
        this.totalPages = 0;
        this.isPlaying = false;

        // PDF state
        this.pdfDoc = null;
        this.pdfDocCache = new Map();
        this.isRendering = false;

        // Autoblading state
        this.autoTurnEnabled = localStorage.getItem('korportal-autoturn') === 'true';
        this.nextPageTurnIndex = 0;

        // Offline state
        this.isDownloading = false;

        // Recorder state
        this.isRecording = false;
        this.recordedPageTurns = [];
        this.jumpPendingTime = null;

        // Cache DOM elements
        this.elements = {};
    }

    async init() {
        // Initialiser side med innloggingskrav
        const pageInit = initPage({ requireAuth: true });
        if (!pageInit) return;

        this.cacheElements();
        this.bindEvents();

        // Load voice - check logged in member first, then saved preference
        const savedVoice = localStorage.getItem('korportal-voice');
        this.currentVoice = this.getMemberVoice() || (savedVoice ? savedVoice.replace(/-/g, ' ') : null);
        if (this.currentVoice && this.elements.voiceSelect) {
            this.elements.voiceSelect.value = this.currentVoice.toLowerCase();
        }

        // Load saved mode
        this.currentMode = localStorage.getItem('korportal-mode') || 'both';
        this.updateModeButtons();

        // Show admin tools if user has styre/admin role
        this.setupAdminTools();

        // Update autoblading button state
        this.updateAutoTurnButton();

        // Load anledninger and then data
        await this.loadAnledninger();
        await this.loadData();

        // Check offline status after data is loaded
        this.checkOfflineStatus();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            programTitle: document.getElementById('programTitle'),

            // Control bar
            anledningSelect: document.getElementById('anledningSelect'),
            voiceSelect: document.getElementById('voiceSelect'),

            // PDF elements
            pdfViewer: document.getElementById('pdfViewer'),
            pdfCanvas: document.getElementById('pdfCanvas'),
            pdfContainer: document.getElementById('pdfContainer'),
            pdfMessage: document.getElementById('pdfMessage'),
            pdfMessageText: document.getElementById('pdfMessageText'),
            pdfPrevPage: document.getElementById('pdfPrevPage'),
            pdfNextPage: document.getElementById('pdfNextPage'),

            // Audio view elements
            audioView: document.getElementById('audioView'),
            audioIcon: document.getElementById('audioIcon'),
            audioViewTitle: document.getElementById('audioViewTitle'),
            audioViewVoice: document.getElementById('audioViewVoice'),
            audioProgressBar: document.getElementById('audioProgressBar'),
            audioTime: document.getElementById('audioTime'),

            // Audio controls
            audioPlayer: document.getElementById('audioPlayer'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            audioProgressFill: document.getElementById('audioProgressFill'),
            audioTimeDisplay: document.getElementById('audioTimeDisplay'),
            audioStatus: document.getElementById('audioStatus'),
            audioProgressClickable: document.getElementById('audioProgressClickable'),

            // Work navigation
            currentTitle: document.getElementById('currentTitle'),
            workInfo: document.getElementById('workInfo'),
            prevWork: document.getElementById('prevWork'),
            nextWork: document.getElementById('nextWork'),

            // Page navigation
            pageNav: document.getElementById('pageNav'),
            pageInfo: document.getElementById('pageInfo'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),

            // Welcome modal
            welcomeModal: document.getElementById('welcomeModal'),

            // Offline
            offlineDownloadBtn: document.getElementById('offlineDownloadBtn'),
            offlineClearBtn: document.getElementById('offlineClearBtn'),
            offlineProgress: document.getElementById('offlineProgress'),
            offlineProgressFill: document.getElementById('offlineProgressFill'),
            offlineProgressText: document.getElementById('offlineProgressText'),

            // Autoblading
            autoTurnBtn: document.getElementById('autoTurnBtn'),
            autoTurnMessage: document.getElementById('autoTurnMessage'),
            autoTurnMessageText: document.getElementById('autoTurnMessageText'),

            // Admin / Recorder
            adminGroup: document.getElementById('adminGroup'),
            pageTurnRecordBtn: document.getElementById('pageTurnRecordBtn'),
            pageTurnRecorder: document.getElementById('pageTurnRecorder'),
            recorderWorkName: document.getElementById('recorderWorkName'),
            recorderTurnsInfo: document.getElementById('recorderTurnsInfo'),
            recorderStart: document.getElementById('recorderStart'),
            recorderNext: document.getElementById('recorderNext'),
            recorderJump: document.getElementById('recorderJump'),
            recorderJumpOk: document.getElementById('recorderJumpOk'),
            recorderPageLabel: document.getElementById('recorderPageLabel'),
            recorderTargetPage: document.getElementById('recorderTargetPage'),
            recorderStop: document.getElementById('recorderStop'),
            recorderUndo: document.getElementById('recorderUndo'),
            recorderCancel: document.getElementById('recorderCancel'),
            recorderList: document.getElementById('recorderList'),
            recorderListWrapper: document.getElementById('recorderListWrapper')
        };
    }

    bindEvents() {
        // Mode buttons
        document.querySelectorAll('.control-btn[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => this.selectMode(btn.dataset.mode));
        });

        // Anledning select
        this.elements.anledningSelect?.addEventListener('change', (e) => {
            this.selectAnledning(e.target.value);
        });

        // Voice select
        this.elements.voiceSelect?.addEventListener('change', (e) => {
            this.selectVoice(e.target.value);
        });

        // Voice buttons in welcome modal
        document.querySelectorAll('.voice-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectVoice(btn.dataset.voice));
        });

        // PDF navigation
        this.elements.pdfPrevPage?.addEventListener('click', () => this.prevPage());
        this.elements.pdfNextPage?.addEventListener('click', () => this.nextPage());
        this.elements.prevPage?.addEventListener('click', () => this.prevPage());
        this.elements.nextPage?.addEventListener('click', () => this.nextPage());

        // Work navigation
        this.elements.prevWork?.addEventListener('click', () => this.prevWork());
        this.elements.nextWork?.addEventListener('click', () => this.nextWork());

        // Audio controls
        this.elements.playPauseBtn?.addEventListener('click', () => this.togglePlayback());
        this.elements.audioPlayer?.addEventListener('timeupdate', () => this.updateAudioProgress());
        this.elements.audioPlayer?.addEventListener('ended', () => this.onAudioEnded());
        this.elements.audioPlayer?.addEventListener('play', () => this.onAudioPlay());
        this.elements.audioPlayer?.addEventListener('pause', () => this.onAudioPause());

        // Click on progress bar to seek
        this.elements.audioProgressClickable?.addEventListener('click', (e) => this.seekAudio(e));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Window resize
        window.addEventListener('resize', () => this.handleResize());

        // Touch/swipe on PDF
        let touchStartX = 0;
        this.elements.pdfViewer?.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        this.elements.pdfViewer?.addEventListener('touchend', (e) => {
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(deltaX) > 50) {
                if (deltaX > 0) this.prevPage();
                else this.nextPage();
            }
        }, { passive: true });

        // Offline buttons
        this.elements.offlineDownloadBtn?.addEventListener('click', () => this.downloadForOffline());
        this.elements.offlineClearBtn?.addEventListener('click', () => this.clearOfflineCache());

        // Autoblading toggle
        this.elements.autoTurnBtn?.addEventListener('click', () => this.toggleAutoTurn());

        // Admin recorder buttons
        this.elements.pageTurnRecordBtn?.addEventListener('click', () => this.showPageTurnRecorder());
        this.elements.recorderStart?.addEventListener('click', () => this.startRecording());
        this.elements.recorderNext?.addEventListener('click', () => this.markNextPage());
        this.elements.recorderJump?.addEventListener('click', () => this.startJump());
        this.elements.recorderJumpOk?.addEventListener('click', () => this.confirmJump());
        this.elements.recorderStop?.addEventListener('click', () => this.stopAndSave());
        this.elements.recorderUndo?.addEventListener('click', () => this.undoLastPageTurn());
        this.elements.recorderCancel?.addEventListener('click', () => this.cancelRecording());
        this.elements.recorderTurnsInfo?.addEventListener('click', () => this.toggleRecorderList());
    }

    // ==========================================================================
    // ANLEDNING SELECTION
    // ==========================================================================
    async loadAnledninger() {
        if (useMock()) return;
        try {
            const practiceUrl = window.ENV?.POWER_AUTOMATE_PRACTICE_URL || '';
            const apiBase = practiceUrl.replace(/\/ovelse\/program\/?$/, '');
            const [anledningerRes, metaRes] = await Promise.all([
                fetch(`${apiBase}/filer/anledninger`).then(r => r.json()),
                fetch(`${apiBase}/ovelse/meta`).then(r => r.json()),
            ]);
            const anledninger = (anledningerRes.body || anledningerRes).anledninger || [];
            const meta = metaRes.body || metaRes;
            const activeAnledning = meta.anledning || '';

            const select = this.elements.anledningSelect;
            if (!select) return;
            select.innerHTML = '';
            for (const a of anledninger) {
                const opt = document.createElement('option');
                opt.value = a;
                opt.textContent = a;
                if (a === activeAnledning) opt.selected = true;
                select.appendChild(opt);
            }
            this.selectedAnledning = select.value || activeAnledning;
        } catch (err) {
            console.error('Load anledninger error:', err);
        }
    }

    async selectAnledning(anledning) {
        this.selectedAnledning = anledning;
        this.currentWorkIndex = 0;
        this.currentPage = 1;
        await this.loadData();
        this.checkOfflineStatus();
    }

    // ==========================================================================
    // DATA LOADING
    // ==========================================================================
    async loadData() {
        this.showLoader();

        try {
            if (useMock()) {
                // Bruk mock-data for testing
                await new Promise(resolve => setTimeout(resolve, 300));
                this.data = MOCK_DATA;
            } else {
                // Bruk SharePoint API med valgt anledning
                this.data = await sharePointAPI.getPracticeData(this.selectedAnledning);
                if (!this.data) {
                    throw new Error('Ingen data mottatt');
                }
            }

            if (this.data?.notes?.length > 0) {
                this.elements.programTitle.textContent = this.data.title || 'Øvelse';
                // Last noter uansett - stemmevalg påvirker bare lyd
                await this.loadCurrentWork();
            }
        } catch (error) {
            console.error('Error loading practice data:', error);
            // Forsøk offline-data fra localStorage, ellers mock-data
            const offlineData = localStorage.getItem('korportal-practice-data');
            if (offlineData) {
                this.data = JSON.parse(offlineData);
                console.warn('Bruker offline-data fra localStorage');
            } else {
                this.data = MOCK_DATA;
                console.warn('Bruker mock-data som fallback');
            }
            if (this.data?.notes?.length > 0) {
                this.elements.programTitle.textContent = this.data.title || 'Øvelse';
                await this.loadCurrentWork();
            }
        } finally {
            this.hideLoader();
        }
    }

    // ==========================================================================
    // VOICE SELECTION
    // ==========================================================================
    showWelcomeModal() {
        if (this.elements.welcomeModal) {
            this.elements.welcomeModal.hidden = false;
        }
    }

    hideWelcomeModal() {
        if (this.elements.welcomeModal) {
            this.elements.welcomeModal.hidden = true;
        }
    }

    getMemberVoice() {
        try {
            const memberData = localStorage.getItem('korportal-member');
            if (memberData) {
                const member = JSON.parse(memberData);
                const voice = (member?.voice || member?.stemme || '').toLowerCase();
                if (!voice) return null;
                // Normaliser bindestrek-format (f.eks. "sopran-1") til mellomrom ("sopran 1")
                return voice.replace(/-/g, ' ');
            }
        } catch {
            // Ignore parse errors
        }
        return null;
    }

    selectVoice(voice) {
        this.currentVoice = voice;
        localStorage.setItem('korportal-voice', voice);

        // Update select dropdown
        if (this.elements.voiceSelect) {
            this.elements.voiceSelect.value = voice;
        }

        this.hideWelcomeModal();

        // Load/reload content
        if (this.data) {
            this.loadCurrentWork();
        }
    }

    // ==========================================================================
    // MODE SELECTION
    // ==========================================================================
    selectMode(mode) {
        this.currentMode = mode;
        localStorage.setItem('korportal-mode', mode);
        this.updateModeButtons();
        this.applyMode();
    }

    updateModeButtons() {
        document.querySelectorAll('.control-btn[data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.currentMode);
        });
    }

    applyMode() {
        const showPdf = this.currentMode === 'both' || this.currentMode === 'notes';
        const showAudioView = this.currentMode === 'audio';

        // Show/hide PDF viewer
        if (this.elements.pdfViewer) {
            this.elements.pdfViewer.style.display = showPdf ? 'flex' : 'none';
        }

        // Show/hide audio-only view
        if (this.elements.audioView) {
            this.elements.audioView.hidden = !showAudioView;
        }

        // Show/hide page navigation
        if (this.elements.pageNav) {
            this.elements.pageNav.style.display = showPdf ? 'flex' : 'none';
        }

        // Update audio view if visible
        if (showAudioView) {
            this.updateAudioView();
        }

        // Stop audio if mode is notes-only
        if (this.currentMode === 'notes') {
            this.elements.audioPlayer?.pause();
        }
    }

    // ==========================================================================
    // PDF RENDERING
    // ==========================================================================
    async loadCurrentWork() {
        if (!this.data?.notes?.length) return;

        const work = this.data.notes[this.currentWorkIndex];
        if (!work) return;

        this.currentPage = 1;
        this.nextPageTurnIndex = 0;
        this.updateWorkInfo();

        // Load PDF if in notes mode (uavhengig av stemmevalg)
        if (this.currentMode !== 'audio') {
            await this.loadPdf(work);
        }

        // Load audio (kun hvis stemme er valgt)
        if (this.currentVoice) {
            await this.loadAudio();
        } else {
            // Ingen stemme valgt - vis melding
            if (this.elements.audioStatus) {
                this.elements.audioStatus.textContent = 'Velg stemme for lyd';
                this.elements.audioStatus.classList.add('no-audio');
            }
        }

        this.applyMode();
    }

    async loadPdf(work) {
        const pdfUrl = this.data.baseUrls.pdf + encodeURIComponent(work.pdfFilename);

        console.log('Loading PDF:', pdfUrl);
        this.showPdfMessage(`Laster: ${work.noteTitle}...`);

        try {
            // Check in-memory cache first
            if (this.pdfDocCache.has(pdfUrl)) {
                console.log('Using cached PDF');
                this.pdfDoc = this.pdfDocCache.get(pdfUrl);
            } else {
                // Try offline cache, then network
                let pdfData = null;
                if ('caches' in window) {
                    try {
                        const cacheExists = await caches.has(OFFLINE_CACHE_NAME);
                        if (cacheExists) {
                            const cache = await caches.open(OFFLINE_CACHE_NAME);
                            const cachedResponse = await cache.match(pdfUrl);
                            if (cachedResponse) {
                                console.log('Using offline-cached PDF');
                                pdfData = await cachedResponse.arrayBuffer();
                            }
                        }
                    } catch (e) {
                        // Ignore cache errors
                    }
                }

                if (pdfData) {
                    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                    this.pdfDoc = await loadingTask.promise;
                } else {
                    console.log('Fetching PDF from server...');
                    try {
                        // Fetch via fetch API for better CORS handling on Safari/iOS
                        const response = await fetch(pdfUrl, { mode: 'cors' });
                        const arrayBuffer = await response.arrayBuffer();
                        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                        this.pdfDoc = await loadingTask.promise;
                    } catch (fetchError) {
                        // Fallback: let pdf.js handle the fetch directly
                        console.warn('Fetch failed, trying pdf.js direct:', fetchError.message);
                        const loadingTask = pdfjsLib.getDocument(pdfUrl);
                        this.pdfDoc = await loadingTask.promise;
                    }
                }
                this.pdfDocCache.set(pdfUrl, this.pdfDoc);
                console.log('PDF loaded, pages:', this.pdfDoc.numPages);
            }

            this.totalPages = this.pdfDoc.numPages;
            this.hidePdfMessage();
            await this.renderPage(this.currentPage);
            this.updatePageInfo();

            // Preload next PDF
            this.preloadNextPdf();

        } catch (error) {
            console.error('Error loading PDF:', error);
            let errorMsg = `Kunne ikke laste: ${work.noteTitle}`;
            if (error.message?.includes('Missing PDF')) {
                errorMsg += '\n(PDF-fil ikke funnet)';
            } else if (error.message?.includes('fetch') || error.message?.includes('Load failed')) {
                errorMsg += '\n(Nettverksfeil)';
            }
            this.showPdfMessage(errorMsg);
            this.totalPages = 0;
            this.updatePageInfo();
        }
    }

    async renderPage(pageNum) {
        if (!this.pdfDoc || this.isRendering) {
            console.log('Cannot render: pdfDoc=', !!this.pdfDoc, 'isRendering=', this.isRendering);
            return;
        }

        this.isRendering = true;
        console.log('Rendering page', pageNum);

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const canvas = this.elements.pdfCanvas;
            const ctx = canvas.getContext('2d', { alpha: false });

            // Minimum 2x resolution for sharp text, use device DPR if higher
            const renderMultiplier = Math.max(2, window.devicePixelRatio || 1);
            const baseViewport = page.getViewport({ scale: 1 });

            // Calculate container size
            const container = this.elements.pdfViewer;
            const maxWidth = container.clientWidth - 100;
            const maxHeight = container.clientHeight - 20;

            // Calculate scale to fit container
            const widthFit = maxWidth / baseViewport.width;
            const heightFit = maxHeight / baseViewport.height;
            const scale = Math.max(0.55, Math.min(widthFit, heightFit));

            const viewport = page.getViewport({ scale });

            // CSS display size
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';

            // Canvas internal resolution (always at least 2x for sharpness)
            canvas.width = Math.floor(viewport.width * renderMultiplier);
            canvas.height = Math.floor(viewport.height * renderMultiplier);

            // Use transform for high-res rendering
            const transform = [renderMultiplier, 0, 0, renderMultiplier, 0, 0];

            console.log('Scale:', scale.toFixed(2), 'Multiplier:', renderMultiplier, 'Canvas:', canvas.width, 'x', canvas.height, 'Display:', canvas.style.width, 'x', canvas.style.height);

            await page.render({
                canvasContext: ctx,
                viewport: viewport,
                transform: transform
            }).promise;

            console.log('Page rendered successfully');
            this.updatePageInfo();

        } catch (error) {
            console.error('Error rendering page:', error);
            this.showPdfMessage('Kunne ikke vise siden');
        } finally {
            this.isRendering = false;
        }
    }

    async preloadNextPdf() {
        const nextIndex = this.currentWorkIndex + 1;
        if (nextIndex >= this.data.notes.length) return;

        const nextWork = this.data.notes[nextIndex];
        const pdfUrl = this.data.baseUrls.pdf + encodeURIComponent(nextWork.pdfFilename);

        if (!this.pdfDocCache.has(pdfUrl)) {
            try {
                const doc = await pdfjsLib.getDocument(pdfUrl).promise;
                this.pdfDocCache.set(pdfUrl, doc);
            } catch (e) {
                // Ignore preload errors
            }
        }
    }

    showPdfMessage(text) {
        if (this.elements.pdfMessage && this.elements.pdfMessageText) {
            this.elements.pdfMessageText.textContent = text;
            this.elements.pdfMessage.hidden = false;
        }
    }

    hidePdfMessage() {
        if (this.elements.pdfMessage) {
            this.elements.pdfMessage.hidden = true;
        }
    }

    // ==========================================================================
    // AUDIO HANDLING
    // ==========================================================================
    async loadAudio() {
        if (!this.data?.notes?.length || !this.currentVoice) return;

        const work = this.data.notes[this.currentWorkIndex];
        const audioFile = work.audio?.[this.currentVoice];

        // Frigjør eventuell gammel blob-URL
        this.revokeAudioBlobUrl();

        if (audioFile) {
            const audioUrl = this.data.baseUrls.audio + encodeURIComponent(audioFile);
            await this.loadAudioFromUrl(audioUrl);
            this.elements.audioStatus.textContent = '';
            this.elements.audioStatus.classList.remove('no-audio');
        } else {
            this.elements.audioPlayer.src = '';
            this.elements.audioStatus.textContent = 'Ingen lydfil';
            this.elements.audioStatus.classList.add('no-audio');
        }

        this.updateAudioView();
        this.updatePlayPauseButton();
    }

    async loadAudioFromUrl(audioUrl) {
        // Sjekk offline-cache kun hvis den faktisk eksisterer
        if ('caches' in window) {
            try {
                const cacheExists = await caches.has(OFFLINE_CACHE_NAME);
                if (cacheExists) {
                    const cache = await caches.open(OFFLINE_CACHE_NAME);
                    const cachedResponse = await cache.match(audioUrl);
                    if (cachedResponse) {
                        console.log('Using offline-cached audio');
                        const blob = await cachedResponse.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        this.currentBlobUrl = blobUrl;
                        this.elements.audioPlayer.src = blobUrl;
                        return;
                    }
                }
            } catch (e) {
                console.warn('[Ovelse] Cache lookup failed, falling back to network:', e);
            }
        }
        // Fall back to network
        this.elements.audioPlayer.src = audioUrl;
    }

    revokeAudioBlobUrl() {
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
    }

    togglePlayback() {
        const player = this.elements.audioPlayer;
        if (!player.src) return;

        if (player.paused) {
            player.play().catch(e => console.log('Playback failed:', e));
        } else {
            player.pause();
        }
    }

    onAudioPlay() {
        this.isPlaying = true;
        this.updatePlayPauseButton();
        this.elements.audioIcon?.classList.add('playing');
    }

    onAudioPause() {
        this.isPlaying = false;
        this.updatePlayPauseButton();
        this.elements.audioIcon?.classList.remove('playing');
    }

    updatePlayPauseButton() {
        if (this.elements.playPauseBtn) {
            this.elements.playPauseBtn.textContent = this.isPlaying ? '⏸' : '▶';
            this.elements.playPauseBtn.classList.toggle('playing', this.isPlaying);
        }
    }

    updateAudioProgress() {
        const player = this.elements.audioPlayer;
        if (!player.duration) return;

        const progress = (player.currentTime / player.duration) * 100;

        // Update bottom controls progress
        if (this.elements.audioProgressFill) {
            this.elements.audioProgressFill.style.width = `${progress}%`;
        }
        if (this.elements.audioTimeDisplay) {
            this.elements.audioTimeDisplay.textContent = `${this.formatTime(player.currentTime)} / ${this.formatTime(player.duration)}`;
        }

        // Update audio view progress (if visible)
        if (this.elements.audioProgressBar) {
            this.elements.audioProgressBar.style.width = `${progress}%`;
        }
        if (this.elements.audioTime) {
            this.elements.audioTime.textContent = `${this.formatTime(player.currentTime)} / ${this.formatTime(player.duration)}`;
        }

        // Autoblading - check for page turns
        this.checkAutoPageTurn(player.currentTime);
    }

    updateAudioView() {
        if (!this.data?.notes?.length) return;

        const work = this.data.notes[this.currentWorkIndex];

        if (this.elements.audioViewTitle) {
            this.elements.audioViewTitle.textContent = work.noteTitle;
        }
        if (this.elements.audioViewVoice) {
            const hasAudio = work.audio?.[this.currentVoice];
            this.elements.audioViewVoice.textContent = hasAudio
                ? this.currentVoice
                : `${this.currentVoice} (ingen lydfil)`;
        }
    }

    seekAudio(e) {
        const player = this.elements.audioPlayer;
        if (!player.duration) return;

        const rect = this.elements.audioProgressClickable.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        player.currentTime = percentage * player.duration;

        // Reset autoblading index based on new position
        this.resetAutoTurnIndex(player.currentTime);
    }

    onAudioEnded() {
        this.isPlaying = false;
        this.updatePlayPauseButton();

        // Auto-advance to next work for continuous practice
        if (this.currentWorkIndex < this.data.notes.length - 1) {
            this.currentWorkIndex++;
            const player = this.elements.audioPlayer;
            player.addEventListener('canplay', () => {
                player.play().catch(e => console.log('Auto-play failed:', e));
            }, { once: true });
            this.loadCurrentWork();
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==========================================================================
    // NAVIGATION
    // ==========================================================================
    async prevPage() {
        this.nextPageTurnIndex = Math.max(0, this.currentPage - 2);
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.renderPage(this.currentPage);
        } else if (this.currentWorkIndex > 0) {
            // Go to previous work, last page
            this.currentWorkIndex--;
            await this.loadCurrentWork();
            // Go to last page of previous work
            if (this.totalPages > 1) {
                this.currentPage = this.totalPages;
                await this.renderPage(this.currentPage);
            }
        }
    }

    async nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            await this.renderPage(this.currentPage);
            // Update autoturn index to match current page
            this.syncAutoTurnIndexToPage();
        } else if (this.currentWorkIndex < this.data.notes.length - 1) {
            // Go to next work
            this.currentWorkIndex++;
            await this.loadCurrentWork();
        }
    }

    async prevWork() {
        if (this.currentWorkIndex > 0) {
            this.currentWorkIndex--;
            await this.loadCurrentWork();
        }
    }

    async nextWork() {
        if (this.currentWorkIndex < this.data.notes.length - 1) {
            this.currentWorkIndex++;
            await this.loadCurrentWork();
        }
    }

    updateWorkInfo() {
        if (!this.data?.notes?.length) return;

        const work = this.data.notes[this.currentWorkIndex];

        if (this.elements.currentTitle) {
            this.elements.currentTitle.textContent = work.noteTitle;
        }
        if (this.elements.workInfo) {
            this.elements.workInfo.textContent = `Sang ${this.currentWorkIndex + 1} av ${this.data.notes.length}`;
        }

        // Update work nav button states
        if (this.elements.prevWork) {
            this.elements.prevWork.disabled = this.currentWorkIndex === 0;
        }
        if (this.elements.nextWork) {
            this.elements.nextWork.disabled = this.currentWorkIndex === this.data.notes.length - 1;
        }
    }

    updatePageInfo() {
        if (this.elements.pageInfo) {
            this.elements.pageInfo.textContent = `Side ${this.currentPage}/${this.totalPages || 1}`;
        }

        // Update page nav button states
        if (this.elements.prevPage) {
            this.elements.prevPage.disabled = this.currentPage <= 1 && this.currentWorkIndex === 0;
        }
        if (this.elements.nextPage) {
            this.elements.nextPage.disabled = this.currentPage >= this.totalPages &&
                this.currentWorkIndex >= this.data.notes.length - 1;
        }
        if (this.elements.pdfPrevPage) {
            this.elements.pdfPrevPage.disabled = this.currentPage <= 1 && this.currentWorkIndex === 0;
        }
        if (this.elements.pdfNextPage) {
            this.elements.pdfNextPage.disabled = this.currentPage >= this.totalPages &&
                this.currentWorkIndex >= this.data.notes.length - 1;
        }
    }

    // ==========================================================================
    // KEYBOARD HANDLING
    // ==========================================================================
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.prevPage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextPage();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.prevWork();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.nextWork();
                break;
            case ' ':
                e.preventDefault();
                this.togglePlayback();
                break;
        }
    }

    // ==========================================================================
    // RESIZE HANDLING
    // ==========================================================================
    handleResize() {
        if (this.pdfDoc && !this.isRendering && this.currentMode !== 'audio') {
            this.renderPage(this.currentPage);
        }
    }

    // ==========================================================================
    // LOADER
    // ==========================================================================
    showLoader() {
        this.elements.loader?.classList.add('active');
    }

    hideLoader() {
        this.elements.loader?.classList.remove('active');
    }

    // ==========================================================================
    // OFFLINE DOWNLOAD
    // ==========================================================================
    async downloadForOffline() {
        if (this.isDownloading || !this.data?.notes?.length || !this.currentVoice) return;
        if (!('caches' in window)) {
            alert('Nettleseren din støtter ikke offline-lagring.');
            return;
        }

        this.isDownloading = true;
        this.elements.offlineDownloadBtn.disabled = true;

        // Collect all URLs to download
        const urls = [];
        for (const note of this.data.notes) {
            // PDF
            if (note.pdfFilename) {
                urls.push(this.data.baseUrls.pdf + encodeURIComponent(note.pdfFilename));
            }
            // Audio for selected voice
            const audioFile = note.audio?.[this.currentVoice];
            if (audioFile) {
                urls.push(this.data.baseUrls.audio + encodeURIComponent(audioFile));
            }
        }

        // Show progress
        this.elements.offlineProgress.hidden = false;
        let completed = 0;
        const total = urls.length;
        this.updateOfflineProgress(completed, total);

        try {
            const cache = await caches.open(OFFLINE_CACHE_NAME);

            for (const url of urls) {
                try {
                    // Check if already cached
                    const existing = await cache.match(url);
                    if (!existing) {
                        const response = await fetch(url, { mode: 'cors' });
                        if (response.ok) {
                            await cache.put(url, response);
                        }
                    }
                } catch (e) {
                    console.warn('Could not cache:', url, e);
                }
                completed++;
                this.updateOfflineProgress(completed, total);
            }

            // Lagre data (inkl. pageTurns) i localStorage for offline-bruk
            localStorage.setItem('korportal-practice-data', JSON.stringify(this.data));

            // Done
            this.elements.offlineDownloadBtn.querySelector('span').textContent = '✅';
            this.elements.offlineDownloadBtn.title = 'Nedlastet for offline';
            this.elements.offlineDownloadBtn.classList.add('offline-ready');
            this.elements.offlineClearBtn.hidden = false;
        } catch (error) {
            console.error('Offline download failed:', error);
            alert('Nedlasting feilet. Prøv igjen.');
        } finally {
            this.isDownloading = false;
            this.elements.offlineDownloadBtn.disabled = false;
            // Hide progress after a short delay
            setTimeout(() => {
                this.elements.offlineProgress.hidden = true;
            }, 2000);
        }
    }

    updateOfflineProgress(completed, total) {
        const pct = total > 0 ? (completed / total) * 100 : 0;
        if (this.elements.offlineProgressFill) {
            this.elements.offlineProgressFill.style.width = `${pct}%`;
        }
        if (this.elements.offlineProgressText) {
            this.elements.offlineProgressText.textContent = `${completed} av ${total} filer`;
        }
    }

    async checkOfflineStatus() {
        if (!('caches' in window)) return;

        try {
            const cacheExists = await caches.has(OFFLINE_CACHE_NAME);
            if (cacheExists) {
                const cache = await caches.open(OFFLINE_CACHE_NAME);
                const keys = await cache.keys();
                if (keys.length > 0) {
                    this.elements.offlineDownloadBtn.querySelector('span').textContent = '✅';
                    this.elements.offlineDownloadBtn.title = 'Nedlastet for offline';
                    this.elements.offlineDownloadBtn.classList.add('offline-ready');
                    this.elements.offlineClearBtn.hidden = false;
                }
            }
        } catch (e) {
            // Ignore
        }
    }

    async clearOfflineCache() {
        if (!confirm('Er du sikker på at du vil slette alle offline-filer?')) return;

        try {
            await caches.delete(OFFLINE_CACHE_NAME);
            localStorage.removeItem('korportal-practice-data');
            this.elements.offlineDownloadBtn.querySelector('span').textContent = '⬇️';
            this.elements.offlineDownloadBtn.title = 'Last ned for offline';
            this.elements.offlineDownloadBtn.classList.remove('offline-ready');
            this.elements.offlineClearBtn.hidden = true;
        } catch (e) {
            console.error('Failed to clear offline cache:', e);
        }
    }

    // ==========================================================================
    // AUTOBLADING (Auto Page Turn)
    // ==========================================================================
    toggleAutoTurn() {
        this.autoTurnEnabled = !this.autoTurnEnabled;
        localStorage.setItem('korportal-autoturn', this.autoTurnEnabled);
        this.updateAutoTurnButton();

        // Show message if enabled but no data for current work
        if (this.autoTurnEnabled) {
            const work = this.data?.notes?.[this.currentWorkIndex];
            if (!work?.pageTurns?.length) {
                this.showAutoTurnMessage('Autoblading er ikke tilgjengelig for dette verket');
            }
        } else {
            this.hideAutoTurnMessage();
        }
    }

    updateAutoTurnButton() {
        if (this.elements.autoTurnBtn) {
            this.elements.autoTurnBtn.classList.toggle('autoturn-active', this.autoTurnEnabled);
            this.elements.autoTurnBtn.title = this.autoTurnEnabled ? 'Autoblading: PÅ' : 'Autoblading: AV';
        }
    }

    checkAutoPageTurn(currentTime) {
        if (!this.autoTurnEnabled) return;
        if (this.currentMode === 'audio') return;

        const work = this.data?.notes?.[this.currentWorkIndex];
        if (!work?.pageTurns?.length) return;

        const pageTurns = work.pageTurns;

        // Check if we've passed the next page turn time
        if (this.nextPageTurnIndex < pageTurns.length) {
            const entry = pageTurns[this.nextPageTurnIndex];
            if (currentTime >= entry.time) {
                this.nextPageTurnIndex++;
                const targetPage = entry.page;
                if (targetPage >= 1 && targetPage <= this.totalPages && targetPage !== this.currentPage) {
                    this.currentPage = targetPage;
                    this.renderPage(this.currentPage);
                }
            }
        }
    }

    resetAutoTurnIndex(currentTime) {
        const work = this.data?.notes?.[this.currentWorkIndex];
        if (!work?.pageTurns?.length) {
            this.nextPageTurnIndex = 0;
            return;
        }

        // Find the correct index based on current time
        this.nextPageTurnIndex = 0;
        for (let i = 0; i < work.pageTurns.length; i++) {
            if (currentTime >= work.pageTurns[i].time) {
                this.nextPageTurnIndex = i + 1;
            } else {
                break;
            }
        }
    }

    syncAutoTurnIndexToPage() {
        // When user manually navigates, find next page turn after current time
        if (!this.elements.audioPlayer?.duration) return;
        this.resetAutoTurnIndex(this.elements.audioPlayer.currentTime);
    }

    showAutoTurnMessage(text) {
        if (this.elements.autoTurnMessage && this.elements.autoTurnMessageText) {
            this.elements.autoTurnMessageText.textContent = text;
            this.elements.autoTurnMessage.hidden = false;
            setTimeout(() => this.hideAutoTurnMessage(), 3000);
        }
    }

    hideAutoTurnMessage() {
        if (this.elements.autoTurnMessage) {
            this.elements.autoTurnMessage.hidden = true;
        }
    }

    // ==========================================================================
    // ADMIN: PAGE TURN RECORDER
    // ==========================================================================
    setupAdminTools() {
        const userRole = getCurrentUserRole();
        if (hasRole(userRole, 'styre')) {
            this.elements.adminGroup.hidden = false;
        }
    }

    showPageTurnRecorder() {
        if (!this.data?.notes?.length) return;

        const work = this.data.notes[this.currentWorkIndex];
        this.elements.recorderWorkName.textContent = work.noteTitle;
        this.recordedPageTurns = [];
        this.updateRecorderList();
        this.updateRecorderButtons(false);
        if (this.elements.recorderListWrapper) this.elements.recorderListWrapper.hidden = true;

        // Show recorder bar above bottom controls
        const bottomHeight = document.getElementById('bottomControls').offsetHeight;
        this.elements.pageTurnRecorder.style.bottom = bottomHeight + 'px';
        this.elements.pageTurnRecorder.hidden = false;
    }

    startRecording() {
        const player = this.elements.audioPlayer;
        if (!player.src) {
            alert('Ingen lydfil er lastet. Velg en stemme først.');
            return;
        }

        this.isRecording = true;
        this.recordedPageTurns = [];
        this.updateRecorderList();

        // Reset PDF to page 1
        if (this.currentMode !== 'audio' && this.totalPages > 0) {
            this.currentPage = 1;
            this.renderPage(this.currentPage);
        }

        // Ensure jump UI is hidden
        this.hideJumpUI();
        this.jumpPendingTime = null;

        // Reset and play audio from start
        player.currentTime = 0;
        player.play().catch(e => console.log('Playback failed:', e));

        this.updateRecorderButtons(true);
    }

    markNextPage() {
        if (!this.isRecording) return;

        const currentTime = parseFloat(this.elements.audioPlayer.currentTime.toFixed(1));
        const targetPage = this.currentPage + 1;

        this.recordedPageTurns.push({ time: currentTime, page: targetPage });
        this.updateRecorderList();

        // Advance PDF to next page
        if (targetPage >= 1 && targetPage <= this.totalPages && this.currentMode !== 'audio') {
            this.currentPage = targetPage;
            this.renderPage(this.currentPage);
        }
    }

    startJump() {
        if (!this.isRecording) return;

        // Pause audio and record the time
        this.elements.audioPlayer.pause();
        this.jumpPendingTime = parseFloat(this.elements.audioPlayer.currentTime.toFixed(1));

        // Show OK button, hide Jump/Next/Stop – let user navigate PDF freely
        this.elements.recorderJump.hidden = true;
        this.elements.recorderJumpOk.hidden = false;
        this.elements.recorderNext.disabled = true;
        this.elements.recorderStop.disabled = true;
    }

    confirmJump() {
        // Register current page (user has navigated there manually)
        this.recordedPageTurns.push({ time: this.jumpPendingTime, page: this.currentPage });
        this.updateRecorderList();

        // Hide jump UI, restore buttons
        this.hideJumpUI();

        // Resume audio
        this.elements.audioPlayer.play().catch(e => console.log('Playback failed:', e));
    }

    hideJumpUI() {
        this.elements.recorderJump.hidden = false;
        this.elements.recorderPageLabel.hidden = true;
        this.elements.recorderTargetPage.hidden = true;
        this.elements.recorderTargetPage.disabled = true;
        this.elements.recorderJumpOk.hidden = true;
        this.jumpPendingTime = null;

        // Re-enable buttons
        this.elements.recorderNext.disabled = false;
        this.elements.recorderStop.disabled = false;
    }

    undoLastPageTurn() {
        if (this.recordedPageTurns.length > 0) {
            this.recordedPageTurns.pop();
            this.updateRecorderList();

            // Revert PDF to the page before the removed entry
            const prevPage = this.recordedPageTurns.length > 0
                ? this.recordedPageTurns[this.recordedPageTurns.length - 1].page
                : 1;
            if (this.currentMode !== 'audio' && prevPage <= this.totalPages) {
                this.currentPage = prevPage;
                this.renderPage(this.currentPage);
            }
        }
    }

    async stopAndSave() {
        this.isRecording = false;
        this.elements.audioPlayer.pause();

        if (this.recordedPageTurns.length === 0) {
            alert('Ingen sideskift ble registrert.');
            this.updateRecorderButtons(false);
            return;
        }

        const work = this.data.notes[this.currentWorkIndex];

        try {
            this.elements.recorderStop.disabled = true;
            this.elements.recorderStop.textContent = 'Lagrer...';

            await sharePointAPI.savePracticePageTurns(work.id, this.recordedPageTurns);

            // Update local data
            work.pageTurns = this.recordedPageTurns.map(e => ({ ...e }));

            // Oppdater offline-data i localStorage hvis den finnes
            if (localStorage.getItem('korportal-practice-data')) {
                localStorage.setItem('korportal-practice-data', JSON.stringify(this.data));
            }

            alert(`Sideskifttidspunkter lagret for "${work.noteTitle}"!`);
            this.elements.pageTurnRecorder.hidden = true;
            // bottomControls forblir synlig under opptak
        } catch (error) {
            console.error('Failed to save page turns:', error);
            // Show the data so user can copy it manually
            const dataStr = JSON.stringify({ workId: work.id, pageTurns: this.recordedPageTurns });
            alert(`Kunne ikke lagre. Kopier data manuelt:\n\n${dataStr}`);
        } finally {
            this.updateRecorderButtons(false);
            this.elements.recorderStop.textContent = 'Stopp og lagre';
        }
    }

    cancelRecording() {
        this.isRecording = false;
        this.elements.audioPlayer.pause();
        this.recordedPageTurns = [];
        this.hideJumpUI();
        this.elements.pageTurnRecorder.hidden = true;
        document.getElementById('bottomControls').hidden = false;
    }

    updateRecorderList() {
        const list = this.elements.recorderList;
        if (list) {
            list.innerHTML = '';
            this.recordedPageTurns.forEach((entry, i) => {
                const li = document.createElement('li');
                li.textContent = `→ s.${entry.page} ved ${this.formatTime(entry.time)} (${entry.time.toFixed(1)}s)`;
                list.appendChild(li);
            });
        }

        if (this.elements.recorderTurnsInfo) {
            const n = this.recordedPageTurns.length;
            this.elements.recorderTurnsInfo.textContent = `${n} skift`;
        }

        if (this.elements.recorderUndo) {
            this.elements.recorderUndo.disabled = this.recordedPageTurns.length === 0;
        }
    }

    toggleRecorderList() {
        const wrapper = this.elements.recorderListWrapper;
        if (wrapper) {
            wrapper.hidden = !wrapper.hidden;
        }
    }

    updateRecorderButtons(recording) {
        if (this.elements.recorderStart) {
            this.elements.recorderStart.disabled = recording;
        }
        if (this.elements.recorderNext) {
            this.elements.recorderNext.disabled = !recording;
        }
        if (this.elements.recorderJump) {
            this.elements.recorderJump.disabled = !recording;
        }
        if (this.elements.recorderStop) {
            this.elements.recorderStop.disabled = !recording;
        }
    }
}

// ==========================================================================
// INITIALIZE
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const app = new PracticeApp();
    app.init();
});

export { PracticeApp };
export default PracticeApp;
