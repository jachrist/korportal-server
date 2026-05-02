/**
 * Musikk - JavaScript
 * Viser konsertopptak med bildekarusell og MP3-spiller
 *
 * @module Musikk
 * @version 2.0.0
 */

import { initNavigation } from './navigation.js';
import sharePointAPI from './sharepoint-api.js';

// Mock mode for testing - evalueres lazy for å sikre at env.js har lastet
const useMock = () => !window.ENV?.POWER_AUTOMATE_MUSIC_URL;

// ==========================================================================
// MOCK DATA - Laster fra JSON-fil i produksjon
// ==========================================================================
const MOCK_DATA = [
    {
        "id": "1",
        "title": "Vårkonsert 2024",
        "date": "2024-05-15",
        "location": "Vålerenga kirke",
        "images": [
            { "url": "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80", "caption": "Koret synger" },
            { "url": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80", "caption": "Konsertsal" },
            { "url": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&q=80", "caption": "Publikum" }
        ],
        "tracks": [
            { "id": 1, "title": "Våren", "duration": 245, "audioUrl": "https://musikk.example.com/vaaren.mp3" },
            { "id": 2, "title": "Når himmelen faller ned", "duration": 210, "audioUrl": "https://musikk.example.com/himmelen.mp3" },
            { "id": 3, "title": "Nordnorsk julesalme", "duration": 195, "audioUrl": "https://musikk.example.com/nordnorsk.mp3" },
            { "id": 4, "title": "Immortal Bach", "duration": 320, "audioUrl": "https://musikk.example.com/bach.mp3" }
        ]
    },
    {
        "id": "2",
        "title": "Julekonsert 2023",
        "date": "2023-12-12",
        "location": "Oslo Domkirke",
        "images": [
            { "url": "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=800&q=80", "caption": "Julekonsert" }
        ],
        "tracks": [
            { "id": 1, "title": "Det hev ei rose sprunge", "duration": 230, "audioUrl": "https://musikk.example.com/rose.mp3" },
            { "id": 2, "title": "Deilig er jorden", "duration": 185, "audioUrl": "https://musikk.example.com/deilig.mp3" }
        ]
    }
];

// ==========================================================================
// SVG ICONS
// ==========================================================================
const ICONS = {
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    prev: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
    next: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
    chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`
};

// ==========================================================================
// MUSIKK APP
// ==========================================================================
class MusikkApp {
    constructor() {
        this.elements = {};
        this.data = null;
        this.players = new Map(); // Map of concert ID to player state
    }

    async init() {
        initNavigation();
        this.cacheElements();
        this.setCurrentYear();
        await this.loadData();
    }

    cacheElements() {
        this.elements = {
            loader: document.getElementById('loader'),
            concertsContainer: document.getElementById('concertsContainer'),
            currentYear: document.getElementById('currentYear')
        };
    }

    setCurrentYear() {
        if (this.elements.currentYear) {
            this.elements.currentYear.textContent = new Date().getFullYear();
        }
    }

    async loadData() {
        this.showLoader();

        try {
            if (useMock()) {
                // Bruk mock-data for testing
                await new Promise(resolve => setTimeout(resolve, 500));
                this.data = MOCK_DATA;
            } else {
                // Bruk SharePoint API
                this.data = await sharePointAPI.getMusicConcerts();
                if (!this.data) {
                    throw new Error('Ingen data mottatt');
                }
            }
            this.renderConcerts();
        } catch (error) {
            console.error('Feil ved lasting av musikk:', error);
            // Fallback til mock-data ved feil
            this.data = MOCK_DATA;
            this.renderConcerts();
            console.warn('Bruker mock-data som fallback');
        } finally {
            this.hideLoader();
        }
    }

    renderConcerts() {
        if (!this.elements.concertsContainer) return;

        if (!this.data?.length) {
            this.elements.concertsContainer.innerHTML = `
                <section class="card content">
                    <div class="music-empty">
                        <div class="music-empty__icon">🎵</div>
                        <p class="music-empty__text">Ingen innspillinger tilgjengelig ennå.</p>
                    </div>
                </section>
            `;
            return;
        }

        // Bruk array-indeks som unik nøkkel (concert.id kan være duplikat)
        const html = this.data.map((concert, index) => this.createConcertCard(concert, index)).join('');
        this.elements.concertsContainer.innerHTML = html;

        // Initialize players and galleries for each concert
        this.data.forEach((concert, index) => {
            this.initGallery(index, concert.images);
            this.initPlayer(index, concert.tracks);
        });
    }

    createConcertCard(concert, index) {
        const galleryHtml = this.createGalleryHtml(index, concert.images);
        const playerHtml = this.createPlayerHtml(index, concert.tracks);

        const metaItems = [];
        if (concert.date) {
            const d = new Date(concert.date);
            if (!isNaN(d)) {
                metaItems.push(`<span class="concert-meta__item"><span>📅</span><span>${d.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })}</span></span>`);
            }
        }
        if (concert.location) {
            metaItems.push(`<span class="concert-meta__item"><span>📍</span><span>${this.escapeHtml(concert.location)}</span></span>`);
        }
        metaItems.push(`<span class="concert-meta__item"><span>🎵</span><span>${concert.tracks.length} spor</span></span>`);

        return `
            <section class="card content concert-music-card" data-concert-index="${index}">
                <div class="concert-header">
                    <h2 class="concert-title">${this.escapeHtml(concert.title)}</h2>
                    <div class="concert-meta">
                        ${metaItems.join('')}
                    </div>
                </div>

                ${galleryHtml}
                ${playerHtml}
            </section>
        `;
    }

    // ==========================================================================
    // IMAGE GALLERY
    // ==========================================================================
    createGalleryHtml(index, images) {
        if (!images?.length) return '';

        const slidesHtml = images.map((image, i) => `
            <div class="gallery-slide" data-index="${i}">
                <img src="${this.escapeHtml(image.url)}"
                     alt="${this.escapeHtml(image.caption)}"
                     loading="lazy">
            </div>
        `).join('');

        const thumbsHtml = images.length > 1 ? `
            <div class="gallery-thumbs">
                ${images.map((image, i) => `
                    <button class="gallery-thumb ${i === 0 ? 'gallery-thumb--active' : ''}"
                            data-index="${i}">
                        <img src="${this.escapeHtml(image.url)}" alt="">
                    </button>
                `).join('')}
            </div>
        ` : '';

        const navHtml = images.length > 1 ? `
            <button class="gallery-nav gallery-nav--prev" data-dir="prev" aria-label="Forrige bilde">
                ${ICONS.chevronLeft}
            </button>
            <button class="gallery-nav gallery-nav--next" data-dir="next" aria-label="Neste bilde">
                ${ICONS.chevronRight}
            </button>
        ` : '';

        return `
            <div class="concert-gallery" data-gallery-id="${index}">
                <div class="gallery-container">
                    <div class="gallery-track">
                        ${slidesHtml}
                    </div>
                    ${navHtml}
                </div>
                ${thumbsHtml}
            </div>
        `;
    }

    initGallery(index, images) {
        if (!images?.length || images.length <= 1) return;

        const gallery = document.querySelector(`[data-gallery-id="${index}"]`);
        if (!gallery) return;

        const track = gallery.querySelector('.gallery-track');
        const thumbs = gallery.querySelectorAll('.gallery-thumb');
        const prevBtn = gallery.querySelector('.gallery-nav--prev');
        const nextBtn = gallery.querySelector('.gallery-nav--next');

        let currentIndex = 0;

        const goToSlide = (index) => {
            currentIndex = Math.max(0, Math.min(index, images.length - 1));
            track.style.transform = `translateX(-${currentIndex * 100}%)`;

            thumbs.forEach((thumb, i) => {
                thumb.classList.toggle('gallery-thumb--active', i === currentIndex);
            });
        };

        prevBtn?.addEventListener('click', () => goToSlide(currentIndex - 1));
        nextBtn?.addEventListener('click', () => goToSlide(currentIndex + 1));

        thumbs.forEach(thumb => {
            thumb.addEventListener('click', () => {
                goToSlide(parseInt(thumb.dataset.index));
            });
        });
    }

    // ==========================================================================
    // AUDIO PLAYER
    // ==========================================================================
    createPlayerHtml(index, tracks) {
        if (!tracks?.length) return '';

        const firstTrack = tracks[0];

        const tracklistHtml = tracks.map((track, i) => `
            <div class="tracklist-item ${i === 0 ? 'tracklist-item--active' : ''}"
                 data-track-index="${i}">
                <span class="tracklist-number">${i + 1}</span>
                <div class="tracklist-info">
                    <div class="tracklist-name">${this.escapeHtml(track.title)}</div>
                </div>
                <div class="tracklist-playing-icon">
                    <div class="playing-bars">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `).join('');

        return `
            <div class="audio-player" data-player-id="${index}">
                <div class="player-now-playing">
                    <div class="player-track-number">Spor <span class="current-track-num">1</span> av ${tracks.length}</div>
                    <h3 class="player-track-title">${this.escapeHtml(firstTrack.title)}</h3>
                </div>

                <div class="player-progress">
                    <div class="player-progress-bar">
                        <div class="player-progress-fill"></div>
                    </div>
                    <div class="player-time">
                        <span class="player-time-current">0:00</span>
                        <span class="player-time-duration">0:00</span>
                    </div>
                </div>

                <div class="player-controls">
                    <button class="player-btn player-btn--skip" data-action="prev" aria-label="Forrige spor">
                        ${ICONS.prev}
                    </button>
                    <button class="player-btn player-btn--play" data-action="play" aria-label="Spill av">
                        ${ICONS.play}
                    </button>
                    <button class="player-btn player-btn--skip" data-action="next" aria-label="Neste spor">
                        ${ICONS.next}
                    </button>
                </div>

                <div class="player-tracklist">
                    <div class="tracklist-title">Spilleliste</div>
                    <div class="tracklist">
                        ${tracklistHtml}
                    </div>
                </div>

                <audio class="player-audio" preload="metadata"></audio>
            </div>
        `;
    }

    initPlayer(playerIndex, tracks) {
        if (!tracks?.length) return;

        const playerEl = document.querySelector(`[data-player-id="${playerIndex}"]`);
        if (!playerEl) return;

        const audio = playerEl.querySelector('.player-audio');
        const playBtn = playerEl.querySelector('[data-action="play"]');
        const prevBtn = playerEl.querySelector('[data-action="prev"]');
        const nextBtn = playerEl.querySelector('[data-action="next"]');
        const progressBar = playerEl.querySelector('.player-progress-bar');
        const progressFill = playerEl.querySelector('.player-progress-fill');
        const timeCurrent = playerEl.querySelector('.player-time-current');
        const timeDuration = playerEl.querySelector('.player-time-duration');
        const trackTitle = playerEl.querySelector('.player-track-title');
        const trackNum = playerEl.querySelector('.current-track-num');
        const tracklistItems = playerEl.querySelectorAll('.tracklist-item');

        const state = {
            currentIndex: 0,
            isPlaying: false,
            tracks: tracks
        };

        this.players.set(playerIndex, state);

        const loadTrack = (index) => {
            state.currentIndex = index;
            const track = tracks[index];

            // Update UI
            trackTitle.textContent = track.title;
            trackNum.textContent = index + 1;

            // Update tracklist active state
            tracklistItems.forEach((item, i) => {
                item.classList.toggle('tracklist-item--active', i === index);
                item.classList.remove('tracklist-item--playing');
            });

            // Load audio
            audio.src = track.audioUrl;
            progressFill.style.width = '0%';
            timeCurrent.textContent = '0:00';
        };

        const play = () => {
            // Pause all other players
            this.players.forEach((otherState, otherId) => {
                if (otherId !== playerIndex && otherState.isPlaying) {
                    const otherPlayer = document.querySelector(`[data-player-id="${otherId}"]`);
                    const otherAudio = otherPlayer?.querySelector('.player-audio');
                    const otherPlayBtn = otherPlayer?.querySelector('[data-action="play"]');
                    if (otherAudio) {
                        otherAudio.pause();
                        otherState.isPlaying = false;
                        if (otherPlayBtn) otherPlayBtn.innerHTML = ICONS.play;
                        otherPlayer.querySelectorAll('.tracklist-item').forEach(item => {
                            item.classList.remove('tracklist-item--playing');
                        });
                    }
                }
            });

            audio.play().catch(() => { /* ignore AbortError from rapid track switching */ });
            state.isPlaying = true;
            playBtn.innerHTML = ICONS.pause;
            tracklistItems[state.currentIndex].classList.add('tracklist-item--playing');
        };

        const pause = () => {
            audio.pause();
            state.isPlaying = false;
            playBtn.innerHTML = ICONS.play;
            tracklistItems[state.currentIndex].classList.remove('tracklist-item--playing');
        };

        const togglePlay = () => {
            if (state.isPlaying) {
                pause();
            } else {
                play();
            }
        };

        const prevTrack = () => {
            if (state.currentIndex > 0) {
                loadTrack(state.currentIndex - 1);
                if (state.isPlaying) play();
            }
        };

        const nextTrack = () => {
            if (state.currentIndex < tracks.length - 1) {
                loadTrack(state.currentIndex + 1);
                if (state.isPlaying) play();
            } else {
                // Last track ended - stop
                pause();
            }
        };

        const formatTime = (seconds) => {
            if (isNaN(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Event listeners
        playBtn.addEventListener('click', togglePlay);
        prevBtn.addEventListener('click', prevTrack);
        nextBtn.addEventListener('click', nextTrack);

        audio.addEventListener('timeupdate', () => {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = `${progress}%`;
            timeCurrent.textContent = formatTime(audio.currentTime);
        });

        audio.addEventListener('loadedmetadata', () => {
            timeDuration.textContent = formatTime(audio.duration);
        });

        audio.addEventListener('ended', () => {
            nextTrack();
        });

        audio.addEventListener('error', () => {
            console.warn('Kunne ikke laste lydfil:', tracks[state.currentIndex].audioUrl);
            // Show placeholder duration for demo
            timeDuration.textContent = '3:45';
        });

        // Progress bar click to seek
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audio.currentTime = percent * audio.duration;
        });

        // Tracklist item click
        tracklistItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                loadTrack(index);
                play();
            });
        });

        // Load first track
        loadTrack(0);
    }

    // ==========================================================================
    // UTILITIES
    // ==========================================================================
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
    const app = new MusikkApp();
    app.init();
});

export { MusikkApp };
export default MusikkApp;
