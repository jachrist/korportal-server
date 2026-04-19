/**
 * SharePoint API Helper Class
 * Kommuniserer med SharePoint-lister via Power Automate HTTP-endepunkter
 *
 * @module SharePointAPI
 * @version 1.0.0
 */

/**
 * Konfigurasjon for API-endepunkter
 * Disse verdiene hentes fra miljøvariabler eller config
 */
/**
 * Konfigurasjon leses lazy fra window.ENV for å sikre at env.js
 * har kjørt ferdig før verdiene leses.
 */
const CONFIG = {
    get endpoints() {
        // Les fra window.ENV ved første tilgang, ikke ved modulparsing
        const env = window.ENV || {};
        return {
            navigation: env.POWER_AUTOMATE_NAVIGATION_URL || '',
            announcements: env.POWER_AUTOMATE_ANNOUNCEMENTS_URL || '',
            quickLinks: env.POWER_AUTOMATE_QUICKLINKS_URL || '',
            concerts: env.POWER_AUTOMATE_CONCERTS_URL || '',
            ticketReservations: env.POWER_AUTOMATE_TICKET_RESERVATIONS_URL || '',
            ticketAdmin: env.POWER_AUTOMATE_TICKET_ADMIN_URL || '',
            ticketAdminUpdate: env.POWER_AUTOMATE_TICKET_ADMIN_UPDATE_URL || '',
            ticketValidate: env.POWER_AUTOMATE_TICKET_VALIDATE_URL || '',
            practice: env.POWER_AUTOMATE_PRACTICE_URL || '',
            articles: env.POWER_AUTOMATE_ARTICLES_URL || '',
            contactPersons: env.POWER_AUTOMATE_CONTACTS_URL || '',
            messages: env.POWER_AUTOMATE_MESSAGES_URL || '',
            messageComments: env.POWER_AUTOMATE_MESSAGE_COMMENTS_URL || '',
            posts: env.POWER_AUTOMATE_POSTS_URL || '',
            createPost: env.POWER_AUTOMATE_CREATE_POST_URL || '',
            createMessage: env.POWER_AUTOMATE_CREATE_MESSAGE_URL || '',
            createEvent: env.POWER_AUTOMATE_CREATE_EVENT_URL || '',
            postComments: env.POWER_AUTOMATE_POST_COMMENTS_URL || '',
            downloads: env.POWER_AUTOMATE_DOWNLOADS_URL || '',
            music: env.POWER_AUTOMATE_MUSIC_URL || '',
            membersPage: env.POWER_AUTOMATE_MEMBERS_PAGE_URL || '',
            membersPageRsvp: env.POWER_AUTOMATE_MEMBERS_PAGE_RSVP_URL || '',
            authSendCode: env.POWER_AUTOMATE_AUTH_SEND_CODE_URL || '',
            authVerifyCode: env.POWER_AUTOMATE_AUTH_VERIFY_CODE_URL || '',
            practicePageTurns: env.POWER_AUTOMATE_PRACTICE_PAGETURNS_URL || '',
            files: env.POWER_AUTOMATE_FILES_URL || '',
            filesUpdate: env.POWER_AUTOMATE_FILES_UPDATE_URL || '',
            blobClear: env.POWER_AUTOMATE_BLOB_CLEAR_URL || '',
            blobUpload: env.POWER_AUTOMATE_BLOB_UPLOAD_URL || '',
            ticketAdminDelete: env.POWER_AUTOMATE_TICKET_ADMIN_DELETE_URL || '',
            styreMembers: env.POWER_AUTOMATE_STYRE_MEMBERS_URL || '',
            styreRegisterMember: env.POWER_AUTOMATE_STYRE_REGISTER_MEMBER_URL || '',
            styreUpdateMember: env.POWER_AUTOMATE_STYRE_UPDATE_MEMBER_URL || '',
            styreDeleteMember: env.POWER_AUTOMATE_STYRE_DELETE_MEMBER_URL || '',
            styreSendEmail: env.POWER_AUTOMATE_STYRE_SEND_EMAIL_URL || ''
        };
    },
    cache: {
        enabled: true,
        duration: 5 * 60 * 1000 // 5 minutter
    }
};

/**
 * Enkel cache-implementasjon
 */
class CacheManager {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Henter data fra cache hvis gyldig
     * @param {string} key - Cache-nøkkel
     * @returns {any|null} - Cachet data eller null
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    /**
     * Lagrer data i cache
     * @param {string} key - Cache-nøkkel
     * @param {any} data - Data som skal caches
     * @param {number} duration - Varighet i millisekunder
     */
    set(key, data, duration = CONFIG.cache.duration) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + duration
        });
    }

    /**
     * Fjerner en spesifikk cache-entry
     * @param {string} key - Cache-nøkkel
     */
    invalidate(key) {
        this.cache.delete(key);
    }

    /**
     * Tømmer hele cachen
     */
    clear() {
        this.cache.clear();
    }
}

/**
 * Hovedklasse for SharePoint API-kommunikasjon
 */
class SharePointAPI {
    constructor() {
        this.cache = new CacheManager();
        this.pendingRequests = new Map();
    }

    /**
     * Pakker ut data fra standard responsformat { success, data } eller SharePoint { value }
     * @private
     */
    unwrap(response) {
        if (response?.body !== undefined) response = response.body;
        if (response?.data !== undefined) return response.data;
        if (response?.value !== undefined) return response.value;
        return response;
    }

    /**
     * Generisk fetch-wrapper med feilhåndtering og caching
     * @param {string} endpoint - API-endepunkt URL
     * @param {Object} options - Fetch-opsjoner
     * @returns {Promise<any>} - API-respons
     */
    async fetch(endpoint, options = {}) {
        const cacheKey = `${options.method || 'GET'}-${endpoint}-${JSON.stringify(options.body || '')}`;

        // Sjekk cache for GET-forespørsler
        if (CONFIG.cache.enabled && (!options.method || options.method === 'GET')) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.debug('[SharePointAPI] Returning cached data for:', endpoint);
                return cached;
            }
        }

        // Dedupliser samtidige forespørsler
        if (this.pendingRequests.has(cacheKey)) {
            console.debug('[SharePointAPI] Returning pending request for:', endpoint);
            return this.pendingRequests.get(cacheKey);
        }

        const fetchPromise = this.executeRequest(endpoint, options, cacheKey);
        this.pendingRequests.set(cacheKey, fetchPromise);

        try {
            return await fetchPromise;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Utfører selve HTTP-forespørselen
     * @private
     */
    async executeRequest(endpoint, options, cacheKey) {
        const method = options.method || 'GET';
        const defaultHeaders = {
            'Accept': 'application/json'
        };
        // Bare sett Content-Type for requests med body
        if (method !== 'GET' && method !== 'HEAD') {
            defaultHeaders['Content-Type'] = 'application/json';
        }

        const mergedOptions = {
            method,
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };

        try {
            const response = await fetch(endpoint, mergedOptions);

            if (!response.ok) {
                throw new SharePointAPIError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    endpoint
                );
            }

            const text = await response.text();
            const data = text ? JSON.parse(text) : {};

            // Cache GET-forespørsler
            if (CONFIG.cache.enabled && mergedOptions.method === 'GET') {
                this.cache.set(cacheKey, data);
            }

            return data;
        } catch (error) {
            if (error instanceof SharePointAPIError) {
                throw error;
            }
            throw new SharePointAPIError(
                error.message || 'Nettverksfeil',
                0,
                endpoint
            );
        }
    }

    /**
     * Henter navigasjonsmeny fra SharePoint
     * @returns {Promise<Array>} - Navigasjonselementer
     */
    async getNavigation() {
        if (!CONFIG.endpoints.navigation) {
            console.warn('[SharePointAPI] Navigation endpoint not configured');
            return [];
        }

        const response = await this.fetch(CONFIG.endpoints.navigation);
        return this.transformNavigationData(response);
    }

    /**
     * Transformerer navigasjonsdata fra SharePoint-format
     * @private
     */
    transformNavigationData(data) {
        const items = this.unwrap(data) || [];

        return items.map(item => ({
            id: item.id,
            title: item.title,
            url: item.url || '#',
            icon: typeof item.icon === 'string' ? item.icon.trim() : null,
            order: item.order || 0,
            openInNewTab: item.openInNewTab === true || item.openInNewTab === 'true',
            minRole: item.minRole || (typeof item.role === 'object' ? item.role?.Value : item.role) || 'anonym',
            hideWhenLoggedIn: item.hideWhenLoggedIn === true || item.hideWhenLoggedIn === 'true',
            isLogout: item.isLogout === true || item.isLogout === 'true'
        })).sort((a, b) => a.order - b.order);
    }

    /**
     * Henter kunngjøringer fra SharePoint
     * @param {Object} options - Filtreringsopsjoner
     * @returns {Promise<Array>} - Kunngjøringer
     */
    async getAnnouncements(options = {}) {
        if (!CONFIG.endpoints.announcements) {
            console.warn('[SharePointAPI] Announcements endpoint not configured');
            return [];
        }

        const params = new URLSearchParams();
        if (options.limit) params.append('$top', options.limit);
        if (options.category) params.append('category', options.category);

        const sep = CONFIG.endpoints.announcements.includes('?') ? '&' : '?';
        const url = params.toString()
            ? `${CONFIG.endpoints.announcements}${sep}${params}`
            : CONFIG.endpoints.announcements;

        const response = await this.fetch(url);
        return this.transformAnnouncementsData(response);
    }

    /**
     * Transformerer kunngjøringsdata
     * @private
     */
    transformAnnouncementsData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            title: item.title,
            content: item.content || '',
            excerpt: item.excerpt || this.createExcerpt(item.content || ''),
            date: new Date(item.publishDate || item.createdAt),
            isImportant: item.isImportant || false,
            category: item.category || null,
            author: item.author || null
        })).sort((a, b) => b.date - a.date);
    }

    /**
     * Lager utdrag fra innhold
     * @private
     */
    createExcerpt(content, maxLength = 150) {
        const text = content.replace(/<[^>]*>/g, '').trim();
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    /**
     * Henter hurtiglenker fra SharePoint
     * @returns {Promise<Array>} - Hurtiglenker
     */
    async getQuickLinks() {
        if (!CONFIG.endpoints.quickLinks) {
            console.warn('[SharePointAPI] QuickLinks endpoint not configured');
            return [];
        }

        const response = await this.fetch(CONFIG.endpoints.quickLinks);
        return this.transformQuickLinksData(response);
    }

    /**
     * Transformerer hurtiglenkedata
     * @private
     */
    transformQuickLinksData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            title: item.title,
            url: item.url,
            icon: item.icon || '🔗',
            description: item.description || '',
            order: item.order || 0,
            openInNewTab: item.openInNewTab ?? true
        })).sort((a, b) => a.order - b.order);
    }

    /**
     * Henter konserter fra SharePoint
     * @param {Object} options - Filtreringsopsjoner
     * @returns {Promise<Array>} - Konserter
     */
    async getConcerts(options = {}) {
        if (!CONFIG.endpoints.concerts) {
            console.warn('[SharePointAPI] Concerts endpoint not configured');
            return [];
        }

        const params = new URLSearchParams();
        if (options.upcoming !== undefined) params.append('upcoming', options.upcoming);
        if (options.limit) params.append('$top', options.limit);

        const sep = CONFIG.endpoints.concerts.includes('?') ? '&' : '?';
        const url = params.toString()
            ? `${CONFIG.endpoints.concerts}${sep}${params}`
            : CONFIG.endpoints.concerts;

        const response = await this.fetch(url);
        return this.transformConcertsData(response);
    }

    /**
     * Transformerer konsertdata fra SharePoint-format
     * @private
     */
    transformConcertsData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            title: item.title,
            date: item.date,
            time: item.time || '',
            location: item.location || '',
            address: item.address || '',
            description: item.description || '',
            imageUrl: item.imageUrl || null,
            ticketPrice: item.ticketPrice || 0,
            ticketsAvailable: item.ticketsAvailable || 0,
            ticketUrl: item.ticketUrl || null,
            isPublic: item.isPublic ?? true,
            status: item.ticketsAvailable > 0 ? 'available' : 'soldout',
            category: item.category || null
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Oppretter billettreservasjon
     * @param {Object} reservationData - Reservasjonsdata
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async createTicketReservation(reservationData) {
        if (!CONFIG.endpoints.ticketReservations) {
            throw new SharePointAPIError(
                'Ticket reservations endpoint not configured',
                400,
                'ticketReservations'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.ticketReservations, {
            method: 'POST',
            body: JSON.stringify({
                concertId: reservationData.concertId,
                name: reservationData.name,
                email: reservationData.email,
                phone: reservationData.phone || '',
                ticketCount: reservationData.ticketCount,
                message: reservationData.message || '',
                totalPrice: reservationData.totalPrice,
                reservationDate: new Date().toISOString()
            })
        });

        // Invalider konsert-cache for å oppdatere billettantall
        this.cache.clear();

        // Pakk ut Power Automate-format: { body: [...] } eller { body: { ... } }
        const items = response?.body || response?.data || response;
        return Array.isArray(items) ? items[0] : items;
    }

    /**
     * Henter øvelsesdata fra SharePoint/Power Automate
     * @returns {Promise<Object>} - Øvelsesdata med noter og lydfiler
     */
    async getPracticeData(anledning) {
        if (!CONFIG.endpoints.practice) {
            console.warn('[SharePointAPI] Practice endpoint not configured');
            return null;
        }

        let url = CONFIG.endpoints.practice;
        if (anledning) {
            url += (url.includes('?') ? '&' : '?') + 'anledning=' + encodeURIComponent(anledning);
        }
        const response = await this.fetch(url);
        return this.transformPracticeData(response);
    }

    /**
     * Transformerer øvelsesdata fra Power Automate-format
     * @private
     */
    transformPracticeData(data) {
        const practiceData = this.unwrap(data) || data;

        return {
            title: practiceData.title || 'Øvelse',
            voice: practiceData.voice || 'tutti',
            baseUrls: {
                pdf: practiceData.baseUrls?.pdf || '',
                audio: practiceData.baseUrls?.audio || ''
            },
            notes: (practiceData.notes || []).map(note => ({
                id: note.id,
                noteTitle: note.noteTitle || note.title,
                pdfFilename: note.pdfFilename || note.pdf,
                audio: note.audio || {},
                pageTurns: note.pageTurns || [],
                sortOrder: note.sortOrder ?? 999
            })).sort((a, b) => a.sortOrder - b.sortOrder)
        };
    }

    /**
     * Lagrer sideskifttidspunkter for et verk
     * @param {string} workId - Verk-ID
     * @param {Array<{time: number, page: number}>} pageTurns - Sideskift med tid og sidenummer
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async savePracticePageTurns(workId, pageTurns) {
        if (!CONFIG.endpoints.practicePageTurns) {
            throw new SharePointAPIError(
                'Practice page turns endpoint not configured',
                400,
                'practicePageTurns'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.practicePageTurns, {
            method: 'POST',
            body: JSON.stringify({ workId, pageTurns })
        });

        this.cache.clear();
        return response?.body || response;
    }

    // =========================================================================
    // BILLETTADMINISTRASJON (Ticket Admin)
    // =========================================================================

    /**
     * Henter ubetalte billettreservasjoner for admin
     * @returns {Promise<Array>} - Reservasjoner
     */
    async getTicketAdminReservations() {
        if (!CONFIG.endpoints.ticketAdmin) {
            console.warn('[SharePointAPI] Ticket admin endpoint not configured');
            return [];
        }

        const response = await this.fetch(CONFIG.endpoints.ticketAdmin);
        return this.transformTicketAdminData(response);
    }

    /**
     * Transformerer billettadmin-data fra Power Automate-format
     * @private
     */
    transformTicketAdminData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            ticketId: item.ticketId || item.bookingReference || '',
            concertId: item.concertId,
            concertTitle: item.concertTitle || '',
            concertDate: item.concertDate || '',
            name: item.name || '',
            email: item.email || '',
            phone: item.phone || '',
            ticketCount: item.ticketCount || 0,
            totalPrice: item.totalPrice || 0,
            reservationDate: item.reservationDate || '',
            isPaid: item.isPaid === true || item.isPaid === 'true'
        }));
    }

    /**
     * Markerer reservasjoner som betalt
     * @param {Array} reservationIds - Liste med reservasjons-IDer
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async markReservationsAsPaid(reservationIds) {
        if (!CONFIG.endpoints.ticketAdminUpdate) {
            throw new SharePointAPIError(
                'Ticket admin update endpoint not configured',
                400,
                'ticketAdminUpdate'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.ticketAdminUpdate, {
            method: 'POST',
            body: JSON.stringify({ reservationIds })
        });

        // Invalider cache
        this.cache.clear();

        return response?.body || response;
    }

    /**
     * Sletter reservasjoner som ikke er betalt
     * @param {Array} reservationIds - Liste med reservasjons-IDer
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async deleteReservations(reservationIds) {
        if (!CONFIG.endpoints.ticketAdminDelete) {
            throw new SharePointAPIError(
                'Ticket admin delete endpoint not configured',
                400,
                'ticketAdminDelete'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.ticketAdminDelete, {
            method: 'POST',
            body: JSON.stringify({ reservationIds })
        });

        this.cache.clear();

        return response?.body || response;
    }

    // =========================================================================
    // BILLETTKONTROLL (Ticket Validation / Check-in)
    // =========================================================================

    /**
     * Validerer en billettreferanse og registrerer innsjekk
     * @param {string} referenceNumber - Referansenummer fra QR-kode
     * @returns {Promise<Object>} - { status: 'valid'|'already_checked_in'|'not_found'|'not_paid' }
     */
    async validateTicket(referenceNumber) {
        if (!CONFIG.endpoints.ticketValidate) {
            console.warn('[SharePointAPI] Ticket validate endpoint not configured');
            return null;
        }

        const response = await this.fetch(CONFIG.endpoints.ticketValidate, {
            method: 'POST',
            body: JSON.stringify({ referenceNumber })
        });

        return this.unwrap(response) || response;
    }

    // =========================================================================
    // FILER OG BLOB-STORAGE
    // =========================================================================

    /**
     * Henter alle filer fra files-endepunkt
     * @returns {Promise<Array>} - Filer
     */
    async getFiles() {
        if (!CONFIG.endpoints.files) {
            console.warn('[SharePointAPI] Files endpoint not configured');
            return [];
        }

        const response = await this.fetch(CONFIG.endpoints.files);
        return this.transformFilesData(response);
    }

    /**
     * Transformerer fildata fra Power Automate-format
     * @private
     */
    transformFilesData(data) {
        let items = data?.body || data?.filer || data;
        if (typeof items === 'string') {
            items = JSON.parse(items);
        }
        items = [].concat(items || []);

        return items.map(item => ({
            id: item.id,
            navn: item.navn || '',
            kategori: item.kategori || '',
            url: item.url || '',
            sortering: item.sortering ?? null,
            verk: item.verk || '',
            stemme: item.stemme || '',
            anledning: item.anledning || ''
        })).sort((a, b) => {
            const sa = a.sortering ?? Infinity;
            const sb = b.sortering ?? Infinity;
            if (sa !== sb) return sa - sb;
            return (a.navn || '').localeCompare(b.navn || '', 'no');
        });
    }

    /**
     * Sender batch-oppdatering av metadata for flere filer
     * @param {Object} params - { fileIds, kategori?, verk?, stemme?, sortering?, anledning? }
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async updateFilesMetadata({ fileIds, ...metadata }) {
        if (!CONFIG.endpoints.filesUpdate) {
            throw new SharePointAPIError(
                'Files update endpoint not configured',
                400,
                'filesUpdate'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.filesUpdate, {
            method: 'POST',
            body: JSON.stringify({ fileIds, ...metadata })
        });

        this.cache.clear();
        return response?.body || response;
    }

    /**
     * Tømmer all blob-storage
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async clearBlobStorage() {
        if (!CONFIG.endpoints.blobClear) {
            throw new SharePointAPIError(
                'Blob clear endpoint not configured',
                400,
                'blobClear'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.blobClear, {
            method: 'POST',
            body: JSON.stringify({ action: 'clear_all' })
        });

        return response?.body || response;
    }

    /**
     * Laster opp markerte filer til Azure Blob
     * @param {Array} fileReferences - Array med fil-IDer/URLer
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async uploadToBlob(fileReferences) {
        if (!CONFIG.endpoints.blobUpload) {
            throw new SharePointAPIError(
                'Blob upload endpoint not configured',
                400,
                'blobUpload'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.blobUpload, {
            method: 'POST',
            body: JSON.stringify({ files: fileReferences })
        });

        return response?.body || response;
    }

    /**
     * Sender data til SharePoint via Power Automate
     * @param {string} listName - Navn på listen
     * @param {Object} data - Data som skal sendes
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async createItem(listName, data) {
        const endpoint = CONFIG.endpoints[listName];
        if (!endpoint) {
            throw new SharePointAPIError(
                `Ukjent liste: ${listName}`,
                400,
                listName
            );
        }

        return this.fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Oppdaterer element i SharePoint via Power Automate
     * @param {string} listName - Navn på listen
     * @param {number} itemId - ID på elementet
     * @param {Object} data - Data som skal oppdateres
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async updateItem(listName, itemId, data) {
        const endpoint = CONFIG.endpoints[listName];
        if (!endpoint) {
            throw new SharePointAPIError(
                `Ukjent liste: ${listName}`,
                400,
                listName
            );
        }

        return this.fetch(`${endpoint}/${itemId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    /**
     * Sletter element i SharePoint via Power Automate
     * @param {string} listName - Navn på listen
     * @param {number|string} itemId - ID på elementet
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async deleteItem(listName, itemId) {
        const endpoint = CONFIG.endpoints[listName];
        if (!endpoint) {
            throw new SharePointAPIError(
                `Ukjent liste: ${listName}`,
                400,
                listName
            );
        }

        return this.fetch(`${endpoint}/${itemId}`, {
            method: 'DELETE',
            body: JSON.stringify({ action: 'delete', id: itemId })
        });
    }

    /**
     * Invaliderer cache for en spesifikk liste
     * @param {string} listName - Navn på listen
     */
    invalidateCache(listName) {
        this.cache.clear();
    }

    /**
     * Henter artikkel fra SharePoint
     * @param {string} slug - Artikkel-slug (f.eks. 'frontpage')
     * @returns {Promise<Object|null>} - Artikkeldata
     */
    async getArticle(slug) {
        if (!CONFIG.endpoints.articles) {
            console.warn('[SharePointAPI] Articles endpoint not configured');
            return null;
        }

        const separator = CONFIG.endpoints.articles.includes('?') ? '&' : '?';
        const url = slug
            ? `${CONFIG.endpoints.articles}${separator}slug=${encodeURIComponent(slug)}`
            : CONFIG.endpoints.articles;

        const response = await this.fetch(url);
        return this.transformArticleData(response);
    }

    /**
     * Transformerer artikkeldata fra SharePoint-format
     * @private
     */
    transformArticleData(data) {
        // Artikkel kan være objekt eller array med ett element
        const unwrapped = this.unwrap(data);
        const item = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;

        if (!item) return null;

        return {
            id: item.id,
            title: item.title || '',
            text: item.text || '',
            format: item.format || 'text',
            imageUrl: item.imageUrl || null,
            imagePlacement: item.imagePlacement || 'over',
            slug: item.slug || 'frontpage',
            published: new Date(item.published || item.createdAt || Date.now()),
            author: item.author || null
        };
    }

    /**
     * Henter kontaktpersoner fra SharePoint
     * @returns {Promise<Array>} - Kontaktpersoner
     */
    async getContactPersons() {
        if (!CONFIG.endpoints.contactPersons) {
            console.warn('[SharePointAPI] ContactPersons endpoint not configured');
            return [];
        }

        const response = await this.fetch(CONFIG.endpoints.contactPersons);
        return this.transformContactPersonsData(response);
    }

    /**
     * Transformerer kontaktpersondata fra SharePoint-format
     * @private
     */
    transformContactPersonsData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            name: item.name,
            email: item.email,
            phone: item.phone,
            kontaktrolle: item.kontaktrolle || '',
            image: item.image || null,
            order: item.order || 0
        })).filter(c => c.kontaktrolle)
          .sort((a, b) => a.order - b.order);
    }

    // =========================================================================
    // MELDINGER (Messages from board)
    // =========================================================================

    /**
     * Henter meldinger fra styret
     * @param {Object} options - Filtreringsopsjoner
     * @returns {Promise<Array>} - Meldinger
     */
    async getMessages(options = {}) {
        if (!CONFIG.endpoints.messages) {
            console.warn('[SharePointAPI] Messages endpoint not configured');
            return [];
        }

        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const sep = CONFIG.endpoints.messages.includes('?') ? '&' : '?';
        const url = params.toString()
            ? `${CONFIG.endpoints.messages}${sep}${params}`
            : CONFIG.endpoints.messages;

        const response = await this.fetch(url);
        return this.transformMessagesData(response);
    }

    /**
     * Transformerer meldingsdata fra SharePoint-format
     * @private
     */
    transformMessagesData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            title: item.title,
            content: item.content || '',
            format: item.format || 'text',
            author: item.author || '',
            publishedAt: item.publishedAt,
            imageUrl: item.imageUrl || '',
            isImportant: item.isImportant || false,
            isPinned: item.isPinned || false,
            commentCount: item.commentCount || 0,
            comments: this.transformCommentsData(item.comments || [])
        })).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    }

    /**
     * Transformerer kommentardata
     * @private
     */
    transformCommentsData(comments) {
        if (!Array.isArray(comments)) return [];

        return comments.map(c => ({
            id: c.id,
            author: c.author,
            email: c.email || '',
            text: c.text || '',
            createdAt: c.createdAt
        }));
    }

    /**
     * Legger til kommentar på en melding
     * @param {Object} commentData - Kommentardata
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async addMessageComment(commentData) {
        if (!CONFIG.endpoints.messageComments) {
            throw new SharePointAPIError(
                'Message comments endpoint not configured',
                400,
                'messageComments'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.messageComments, {
            method: 'POST',
            body: JSON.stringify({
                messageId: String(commentData.messageId),
                text: commentData.text,
                authorName: commentData.authorName,
                authorEmail: commentData.authorEmail
            })
        });

        // Invalider meldinger-cache
        this.cache.invalidate('messages');

        return response?.body || response;
    }

    // =========================================================================
    // INNLEGG (Member posts)
    // =========================================================================

    /**
     * Henter innlegg fra medlemmer
     * @param {Object} options - Filtreringsopsjoner
     * @returns {Promise<Array>} - Innlegg
     */
    async getPosts(options = {}) {
        if (!CONFIG.endpoints.posts) {
            console.warn('[SharePointAPI] Posts endpoint not configured');
            return [];
        }

        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const sep = CONFIG.endpoints.posts.includes('?') ? '&' : '?';
        const url = params.toString()
            ? `${CONFIG.endpoints.posts}${sep}${params}`
            : CONFIG.endpoints.posts;

        const response = await this.fetch(url);
        return this.transformPostsData(response);
    }

    /**
     * Transformerer innleggsdata fra SharePoint-format
     * @private
     */
    transformPostsData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            title: item.title,
            content: item.content || '',
            author: item.author || {},
            createdAt: item.createdAt,
            commentCount: item.commentCount || 0,
            comments: this.transformCommentsData(item.comments || [])
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Oppretter nytt innlegg
     * @param {Object} postData - Innleggsdata
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async createPost(postData) {
        if (!CONFIG.endpoints.createPost) {
            throw new SharePointAPIError(
                'Create post endpoint not configured',
                400,
                'createPost'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.createPost, {
            method: 'POST',
            body: JSON.stringify({
                title: postData.title,
                content: postData.content,
                authorId: postData.authorId,
                authorName: postData.authorName,
                authorEmail: postData.authorEmail,
                authorVoice: postData.authorVoice || ''
            })
        });

        // Invalider innlegg-cache
        this.cache.invalidate('posts');

        return response?.body || response;
    }

    /**
     * Oppretter ny melding fra styret
     * @param {Object} messageData - Meldingsdata
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async createMessage(messageData) {
        if (!CONFIG.endpoints.createMessage) {
            throw new SharePointAPIError(
                'Create message endpoint not configured',
                400,
                'createMessage'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.createMessage, {
            method: 'POST',
            body: JSON.stringify({
                title: messageData.title,
                content: messageData.content,
                authorName: messageData.authorName,
                authorEmail: messageData.authorEmail
            })
        });

        // Invalider meldinger-cache
        this.cache.invalidate('messages');

        return response?.body || response;
    }

    /**
     * Oppretter nytt arrangement
     * @param {Object} eventData - Arrangementsdata
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async createEvent(eventData) {
        if (!CONFIG.endpoints.createEvent) {
            throw new SharePointAPIError(
                'Create event endpoint not configured',
                400,
                'createEvent'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.createEvent, {
            method: 'POST',
            body: JSON.stringify({
                title: eventData.title,
                description: eventData.description || '',
                date: eventData.date,
                startTime: eventData.startTime || '',
                endTime: eventData.endTime || '',
                location: eventData.location || '',
                authorName: eventData.authorName,
                authorEmail: eventData.authorEmail
            })
        });

        // Invalider medlemsside-cache
        this.cache.invalidate('membersPage');

        return this.unwrap(response) || response;
    }

    /**
     * Legger til kommentar på et innlegg
     * @param {Object} commentData - Kommentardata
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async addPostComment(commentData) {
        if (!CONFIG.endpoints.postComments) {
            throw new SharePointAPIError(
                'Post comments endpoint not configured',
                400,
                'postComments'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.postComments, {
            method: 'POST',
            body: JSON.stringify({
                postId: String(commentData.postId),
                text: commentData.text,
                authorName: commentData.authorName,
                authorEmail: commentData.authorEmail
            })
        });

        // Invalider innlegg-cache
        this.cache.invalidate('posts');

        return response?.body || response;
    }

    // =========================================================================
    // NEDLASTING (Downloads)
    // =========================================================================

    /**
     * Henter nedlastbare filer
     * @returns {Promise<Array>} - Filer
     */
    async getDownloads() {
        if (!CONFIG.endpoints.downloads) {
            console.warn('[SharePointAPI] Downloads endpoint not configured');
            return [];
        }

        const response = await this.fetch(CONFIG.endpoints.downloads);
        return this.transformDownloadsData(response);
    }

    /**
     * Transformerer nedlastingsdata fra SharePoint-format
     * @private
     */
    transformDownloadsData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            title: item.title,
            fileUrl: item.fileUrl,
            filename: item.filename || '',
            category: item.category || '',
            fileSize: item.fileSize || null,
            uploadedAt: item.uploadedAt || null,
            sortOrder: item.sortOrder ?? 999
        })).sort((a, b) => (a.sortOrder - b.sortOrder) || a.title.localeCompare(b.title, 'no'));
    }

    // =========================================================================
    // MUSIKK (Music/Recordings)
    // =========================================================================

    /**
     * Henter innspilte konserter
     * @returns {Promise<Object>} - Musikkdata med konserter
     */
    async getMusicConcerts() {
        if (!CONFIG.endpoints.music) {
            console.warn('[SharePointAPI] Music endpoint not configured');
            return null;
        }

        const response = await this.fetch(CONFIG.endpoints.music);
        return this.transformMusicData(response);
    }

    /**
     * Transformerer musikkdata fra SharePoint-format
     * @private
     */
    transformMusicData(data) {
        const items = this.unwrap(data) || [];
        if (!Array.isArray(items)) return [];

        return items.map(concert => ({
            id: concert.id,
            title: concert.title,
            date: concert.date,
            location: concert.location,
            images: (concert.images || []).map(img => ({
                url: img.url,
                caption: img.caption || ''
            })),
            tracks: (concert.tracks || []).map(track => ({
                id: track.id,
                title: track.title,
                duration: track.duration || 0,
                audioUrl: this.fixBlobAudioUrl(track.audioUrl)
            })).sort((a, b) => a.id - b.id)
        }));
    }

    /**
     * Fikser audio-URL fra Power Automate til å bruke riktig blob storage-konto
     * og URL-encoder filnavnet (mellomrom osv.)
     * @private
     */
    fixBlobAudioUrl(url) {
        if (!url) return url;
        // Korriger feil storage-kontonavn (Power Automate kan returnere "storage" i stedet for "utsiktenblob")
        const correctBase = 'https://utsiktenblob.blob.core.windows.net/';
        url = url.replace(/^https?:\/\/[^/]*\.blob\.core\.windows\.net\//, correctBase);
        // URL-encode filnavnet (siste segment) for å håndtere mellomrom og spesialtegn
        const lastSlash = url.lastIndexOf('/');
        if (lastSlash >= 0) {
            const base = url.substring(0, lastSlash + 1);
            const filename = url.substring(lastSlash + 1);
            // Decode først i tilfelle delvis encodet, så encode på nytt
            const decoded = decodeURIComponent(filename);
            url = base + encodeURIComponent(decoded);
        }
        return url;
    }

    // =========================================================================
    // MEDLEMSSIDE (Members Page)
    // =========================================================================

    /**
     * Henter medlemsside-data (artikkel og arrangementer)
     * @returns {Promise<Object>} - { article, events }
     */
    async getMembersPageData() {
        if (!CONFIG.endpoints.membersPage) {
            console.warn('[SharePointAPI] Members page endpoint not configured');
            return null;
        }

        const response = await this.fetch(CONFIG.endpoints.membersPage);
        return this.transformMembersPageData(response);
    }

    /**
     * Transformerer medlemsside-data fra Power Automate-format
     * @private
     */
    transformMembersPageData(data) {
        const unwrapped = this.unwrap(data) || data;

        const article = unwrapped.article ? {
            title: unwrapped.article.title || '',
            text: unwrapped.article.text || '',
            format: unwrapped.article.format || 'text',
            imageUrl: unwrapped.article.imageUrl || null,
            imagePlacement: unwrapped.article.imagePlacement || 'over'
        } : null;

        const events = (unwrapped.events || []).map(event => ({
            id: event.id,
            title: event.title || '',
            description: event.description || '',
            date: event.date,
            startTime: event.startTime || '',
            endTime: event.endTime || '',
            location: event.location || '',
            attendees: (event.attendees || []).map(a => ({
                name: a.name,
                email: a.email,
                status: a.status || 'not_responded'
            })),
            totalMembers: event.totalMembers || 0
        }));

        return { article, events };
    }

    /**
     * Sender RSVP for et arrangement
     * @param {number} eventId - Arrangement-ID
     * @param {string} action - 'attending' eller 'not_attending'
     * @param {Object} member - { name, email }
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async submitEventRsvp(eventId, action, member) {
        if (!CONFIG.endpoints.membersPageRsvp) {
            throw new SharePointAPIError(
                'Members page RSVP endpoint not configured',
                400,
                'membersPageRsvp'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.membersPageRsvp, {
            method: 'POST',
            body: JSON.stringify({
                eventId,
                action,
                memberName: member.name,
                memberEmail: member.email
            })
        });

        // Invalider cache
        this.cache.clear();

        return response?.body || response;
    }

    // =========================================================================
    // STYRESIDER (Board admin)
    // =========================================================================

    /**
     * Henter alle medlemmer for styreadministrasjon
     * @returns {Promise<Array>} - Medlemsliste
     */
    async getStyreMembers() {
        if (!CONFIG.endpoints.styreMembers) {
            console.warn('[SharePointAPI] Styre members endpoint not configured');
            return [];
        }

        const response = await this.fetch(CONFIG.endpoints.styreMembers);
        return this.transformStyreMembersData(response);
    }

    /**
     * Transformerer styremedlemsdata
     * @private
     */
    transformStyreMembersData(data) {
        const items = [].concat(this.unwrap(data) || []);

        return items.map(item => ({
            id: item.id,
            name: item.name || '',
            email: item.email || '',
            phone: item.phone || '',
            voice: item.voice || '',
            role: item.role || 'medlem',
            kontingentBetalt: item.kontingentBetalt === true || item.kontingentBetalt === 'true',
            joinedAt: item.joinedAt || ''
        }));
    }

    /**
     * Registrerer nytt medlem
     * @param {Object} data - { name, email, phone, voice, role }
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async registerStyremember(data) {
        if (!CONFIG.endpoints.styreRegisterMember) {
            throw new SharePointAPIError(
                'Styre register member endpoint not configured',
                400,
                'styreRegisterMember'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.styreRegisterMember, {
            method: 'POST',
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                phone: data.phone || '',
                voice: data.voice,
                role: data.role,
                kontingentBetalt: !!data.kontingentBetalt
            })
        });

        this.cache.clear();
        return response?.body || response;
    }

    /**
     * Oppdaterer et eksisterende medlem
     * @param {string} id - Medlems-ID
     * @param {Object} data - Oppdaterte felt
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async updateStyremember(id, data) {
        if (!CONFIG.endpoints.styreUpdateMember) {
            throw new SharePointAPIError(
                'Styre update member endpoint not configured',
                400,
                'styreUpdateMember'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.styreUpdateMember, {
            method: 'POST',
            body: JSON.stringify({
                memberId: id,
                ...data
            })
        });

        this.cache.clear();
        return response?.body || response;
    }

    /**
     * Sletter et medlem
     * @param {string} id - Medlems-ID
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async deleteStyremember(id) {
        if (!CONFIG.endpoints.styreDeleteMember) {
            throw new SharePointAPIError(
                'Styre delete member endpoint not configured',
                400,
                'styreDeleteMember'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.styreDeleteMember, {
            method: 'POST',
            body: JSON.stringify({ memberId: id })
        });

        this.cache.clear();
        return response?.body || response;
    }

    /**
     * Sender e-post til valgte medlemmer
     * @param {Object} params - { recipients, subject, message }
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async sendStyreEmail({ recipients, subject, message }) {
        if (!CONFIG.endpoints.styreSendEmail) {
            throw new SharePointAPIError(
                'Styre send email endpoint not configured',
                400,
                'styreSendEmail'
            );
        }

        const response = await this.fetch(CONFIG.endpoints.styreSendEmail, {
            method: 'POST',
            body: JSON.stringify({ recipients, subject, message })
        });

        return response?.body || response;
    }

    // =========================================================================
    // AUTENTISERING (Authentication)
    // =========================================================================

    /**
     * Sender engangskode til e-post
     * @param {string} email - E-postadresse
     * @returns {Promise<Object>} - Respons fra Power Automate
     */
    async sendAuthCode(email) {
        if (!CONFIG.endpoints.authSendCode) {
            throw new SharePointAPIError(
                'Auth send code endpoint not configured',
                400,
                'authSendCode'
            );
        }

        const result = await this.fetch(CONFIG.endpoints.authSendCode, {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        // Unwrap Power Automate response: { statusCode, body: { success, ... } }
        return result?.body || result;
    }

    /**
     * Verifiserer engangskode
     * @param {string} email - E-postadresse
     * @param {string} code - Engangskode
     * @returns {Promise<Object>} - Respons med medlemsdata ved suksess
     */
    async verifyAuthCode(email, code) {
        if (!CONFIG.endpoints.authVerifyCode) {
            throw new SharePointAPIError(
                'Auth verify code endpoint not configured',
                400,
                'authVerifyCode'
            );
        }

        const result = await this.fetch(CONFIG.endpoints.authVerifyCode, {
            method: 'POST',
            body: JSON.stringify({ email, code })
        });

        // Unwrap Power Automate response: { statusCode, body: { success, token, member } }
        return result?.body || result;
    }
}

/**
 * Custom Error-klasse for SharePoint API-feil
 */
class SharePointAPIError extends Error {
    constructor(message, statusCode, endpoint) {
        super(message);
        this.name = 'SharePointAPIError';
        this.statusCode = statusCode;
        this.endpoint = endpoint;
        this.timestamp = new Date();
    }
}

// Eksporter singleton-instans
const sharePointAPI = new SharePointAPI();

export { sharePointAPI, SharePointAPI, SharePointAPIError, CONFIG };
export default sharePointAPI;
