/**
 * Migreringsscript: JSON-filer → Azure Table Storage
 *
 * Leser ferdigtransformert JSON (output fra Power Automate GET-flytene)
 * og skriver til Azure Table Storage.
 *
 * Steg:
 *   1. Kjør hver GET-flyt (via nettleser/Postman/REST Client)
 *   2. Lagre responsen som JSON-fil i data/-mappen med tabellnavnet som filnavn
 *   3. Kjør dette scriptet
 *
 * Bruk:
 *   node migrate.js [--dry-run] [--table=Navigation,Messages,...]
 *
 * Filnavn i data/-mappen:
 *   navigation.json, messages.json, posts.json, quicklinks.json,
 *   articles.json, members.json, contacts.json, concerts.json,
 *   ticketreservations.json, downloads.json, music.json,
 *   practice.json, events.json
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { upsertEntity, buildEntity, ensureTables } = require('./lib/table-client');
const { generateId } = require('./lib/helpers');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const tableArg = args.find(a => a.startsWith('--table='));
const ONLY_TABLES = tableArg ? tableArg.split('=')[1].split(',').map(s => s.toLowerCase()) : null;

const DATA_DIR = path.join(__dirname, 'data');

// --- Transformeringer ---
// Hver funksjon tar ett element fra Power Automate-output og returnerer
// { tableName, partitionKey, rowKey, searchableFields, fullData }

const MIGRATIONS = {

  navigation: {
    tableName: 'Navigation',
    transform(item) {
      const id = item.id ? `nav-${item.id}` : generateId('NAV');
      const role = typeof item.role === 'object' ? item.role.Value : (item.role || item.minRole || 'anonym');
      return {
        partitionKey: 'navigation',
        rowKey: id,
        searchableFields: {
          order: item.order || item.Order || 0,
          role,
        },
        fullData: {
          id,
          title: item.title || item.Title,
          url: item.url || item.URL,
          icon: item.icon || item.Icon || '',
          order: item.order || item.Order || 0,
          openInNewTab: item.openInNewTab || item.OpenInNewTab || false,
          minRole: role,
          hideWhenLoggedIn: item.hideWhenLoggedIn || item.HideWhenLoggedIn || false,
          isLogout: item.isLogout || item.IsLogout || false,
        },
      };
    },
  },

  messages: {
    tableName: 'Messages',
    transform(item) {
      const id = item.id ? `MSG-${item.id}` : generateId('MSG');
      return {
        partitionKey: 'message',
        rowKey: id,
        searchableFields: {
          publishedAt: item.publishedAt || item.PublishDate || '',
          isPinned: item.isPinned || item.IsPinned || false,
        },
        fullData: {
          id,
          title: item.title || item.Title,
          content: item.content || '',
          format: item.format || 'markdown',
          author: item.author || 'Styret',
          publishedAt: item.publishedAt || item.PublishDate || '',
          imageUrl: item.imageUrl || '',
          isImportant: item.isImportant || item.IsImportant || false,
          isPinned: item.isPinned || item.IsPinned || false,
          comments: (item.comments || []).map((c, i) => ({
            id: c.id || `CMT-${id}-${i}`,
            author: c.author || c.authorName,
            email: c.email || c.authorEmail || '',
            text: c.text,
            createdAt: c.createdAt || c.date || '',
          })),
        },
      };
    },
  },

  posts: {
    tableName: 'Posts',
    transform(item) {
      const id = item.id ? `POST-${item.id}` : generateId('POST');
      const author = item.author || {};
      return {
        partitionKey: 'post',
        rowKey: id,
        searchableFields: {
          createdAt: item.createdAt || item.PublishDate || '',
        },
        fullData: {
          id,
          title: item.title || item.Title,
          content: item.content || '',
          author: typeof author === 'object' ? author : { id: '', name: author },
          authorEmail: item.authorEmail || '',
          authorVoice: item.authorVoice || '',
          createdAt: item.createdAt || item.PublishDate || '',
          comments: (item.comments || []).map((c, i) => ({
            id: c.id || `CMT-${id}-${i}`,
            author: c.author || c.authorName,
            email: c.email || c.authorEmail || '',
            text: c.text,
            createdAt: c.createdAt || c.date || '',
          })),
        },
      };
    },
  },

  quicklinks: {
    tableName: 'QuickLinks',
    transform(item) {
      const id = item.id ? `ql-${item.id}` : generateId('QL');
      return {
        partitionKey: 'quicklink',
        rowKey: id,
        searchableFields: {
          order: item.order || item.Order || 0,
        },
        fullData: {
          id,
          title: item.title || item.Title,
          url: item.url || item.URL,
          icon: item.icon || item.Icon || '',
          description: item.description || item.Description || '',
          order: item.order || item.Order || 0,
          openInNewTab: item.openInNewTab !== undefined ? item.openInNewTab : (item.OpenInNewTab !== false),
        },
      };
    },
  },

  articles: {
    tableName: 'Articles',
    transform(item, index) {
      // Første artikkel uten slug antas å være forsideartikkelen
      const slug = item.slug || item.Slug || item.page || item.Page
        || (index === 0 ? 'frontpage' : `article-${item.id || generateId('ART')}`);
      return {
        partitionKey: 'article',
        rowKey: slug,
        searchableFields: {
          page: slug,
        },
        fullData: {
          id: slug,
          title: item.title || item.Title,
          text: item.text || item.content || '',
          format: item.format || 'markdown',
          imageUrl: item.imageUrl || '',
          imagePlacement: item.imagePlacement || 'over',
          slug,
          published: item.published || item.Created || '',
          author: item.author || null,
        },
      };
    },
  },

  members: {
    tableName: 'Members',
    transform(item) {
      const id = item.id ? `MBR-${item.id}` : generateId('MBR');
      const email = (item.email || item.Email || '').toLowerCase().trim();
      return {
        partitionKey: 'member',
        rowKey: id,
        searchableFields: {
          email,
          role: item.role || item.Role || 'medlem',
          voice: item.voice || item.Voice || '',
        },
        fullData: {
          id,
          name: item.name || item.Title || item.navn || '',
          email,
          phone: item.phone || item.Phone || item.telefon || '',
          voice: item.voice || item.Voice || item.stemme || '',
          role: item.role || item.Role || 'medlem',
          kontingentBetalt: item.kontingentBetalt || item.KontingentBetalt || false,
          joinedAt: item.joinedAt || item.JoinedAt || item.Created || '',
          varsler: item.varsler || { innlegg: true, arrangementer: true, meldinger: true },
          preferanser: item.preferanser || { tema: 'light' },
        },
      };
    },
  },

  contacts: {
    tableName: 'Contacts',
    transform(item) {
      const id = item.id ? `contact-${item.id}` : generateId('KON');
      return {
        partitionKey: 'contact',
        rowKey: id,
        searchableFields: {
          kontaktrolle: item.kontaktrolle || item.Kontaktrolle || '',
        },
        fullData: {
          id,
          name: item.name || item.Title,
          email: item.email || item.Email || '',
          phone: item.phone || item.Phone || '',
          kontaktrolle: item.kontaktrolle || item.Kontaktrolle || '',
          image: item.image || item.Picture || null,
          order: item.order || item.Order || 0,
        },
      };
    },
  },

  concerts: {
    tableName: 'Concerts',
    transform(item) {
      const id = item.id ? `concert-${item.id}` : generateId('CON');
      return {
        partitionKey: 'concert',
        rowKey: id,
        searchableFields: {
          date: item.date || '',
          isPublic: item.isPublic !== false,
        },
        fullData: {
          id,
          title: item.title || item.Title,
          date: item.date || '',
          time: item.time || '',
          location: item.location || item.Location || '',
          address: item.address || '',
          description: item.description || '',
          imageUrl: item.imageUrl || null,
          ticketPrice: item.ticketPrice || item.Price || 0,
          ticketsAvailable: item.ticketsAvailable || 0,
          ticketUrl: item.ticketUrl || null,
          isPublic: item.isPublic !== false,
          status: item.status || 'available',
          category: item.category || item.Category || null,
        },
      };
    },
  },

  ticketreservations: {
    tableName: 'TicketReservations',
    transform(item) {
      const id = item.id ? `BIL-${item.id}` : generateId('BIL');
      const refNumber = item.ticketId || item.bookingReference || item.referenceNumber || item.Title || id;
      const isPaid = item.isPaid || item.PaymentStatus === 'Betalt' || false;
      return {
        partitionKey: 'reservation',
        rowKey: id,
        searchableFields: {
          concertId: String(item.concertId || item.ConcertId || ''),
          isPaid,
          referenceNumber: refNumber,
        },
        fullData: {
          id,
          ticketId: refNumber,
          bookingReference: refNumber,
          referenceNumber: refNumber,
          concertId: item.concertId || item.ConcertId || '',
          concertTitle: item.concertTitle || '',
          name: item.name || item.Name || '',
          email: item.email || item.Email || '',
          phone: item.phone || item.Phone || '',
          ticketCount: item.ticketCount || item.TicketCount || 1,
          message: item.message || item.Message || '',
          totalPrice: item.totalPrice || item.TotalPrice || 0,
          reservationDate: item.reservationDate || item.ReservationDate || '',
          isPaid,
          isCheckedIn: item.isCheckedIn || false,
        },
      };
    },
  },

  downloads: {
    tableName: 'Downloads',
    transform(item) {
      const id = item.id ? `dl-${item.id}` : generateId('DL');
      return {
        partitionKey: 'download',
        rowKey: id,
        searchableFields: {
          category: item.category || item.Category || '',
        },
        fullData: {
          id,
          title: item.title || item.Title,
          fileUrl: item.fileUrl || item.FileURL || '',
          filename: item.filename || item.Filename || item.title || item.Title || '',
          category: item.category || item.Category || '',
          fileSize: item.fileSize || item.FileSize || null,
          uploadedAt: item.uploadedAt || item.UploadDate || null,
          sortOrder: item.sortOrder || item.SortOrder || item.Order || 999,
        },
      };
    },
  },

  music: {
    tableName: 'Music',
    transform(item) {
      const id = item.id ? `music-${item.id}` : generateId('MUS');
      return {
        partitionKey: 'music',
        rowKey: id,
        searchableFields: {
          date: item.date || '',
        },
        fullData: {
          id,
          title: item.title || item.Title,
          date: item.date || '',
          location: item.location || item.Location || '',
          images: item.images || [],
          tracks: item.tracks || [],
        },
      };
    },
  },

  practice: {
    tableName: 'Practice',
    // Øvelsesdata er én stor JSON — lagres som individuelle noter
    transformAll(data) {
      const results = [];

      // Lagre program-metadata
      results.push({
        partitionKey: 'program',
        rowKey: 'meta',
        searchableFields: {},
        fullData: {
          title: data.title || '',
          voice: data.voice || 'tutti',
          baseUrls: data.baseUrls || { pdf: '', audio: '' },
        },
      });

      // Lagre hver note separat
      const notes = data.notes || [];
      for (const note of notes) {
        const id = note.id || generateId('NOTE');
        results.push({
          partitionKey: 'practice',
          rowKey: id,
          searchableFields: {},
          fullData: {
            id,
            noteTitle: note.noteTitle || note.title || '',
            pdfFilename: note.pdfFilename || '',
            audio: note.audio || {},
            pageTurns: note.pageTurns || [],
            sortOrder: note.sortOrder || 0,
          },
        });
      }

      return results;
    },
  },

  events: {
    tableName: 'Events',
    // events.json kan inneholde hele medlemssideresponsen { article, events }
    // eller et rent array av events
    preprocess(data) {
      // Hvis data har article+events (medlemsside-format), ekstraher events
      // og lagre artikkel som members-artikkel i Articles-tabellen
      if (data.article && data.events) {
        // Lagre artikkelen separat (håndteres i transformAll)
        this._membersArticle = data.article;
        return data.events;
      }
      return Array.isArray(data) ? data : [data];
    },
    transformAll(data) {
      const items = this.preprocess(data);
      const results = [];

      // Migrer medlemsside-artikkelen til Articles-tabellen
      if (this._membersArticle) {
        const art = this._membersArticle;
        results.push({
          tableName: 'Articles',
          partitionKey: 'article',
          rowKey: 'members',
          searchableFields: { page: 'members' },
          fullData: {
            id: 'members',
            title: art.title || '',
            text: art.text || '',
            format: art.format || 'markdown',
            imageUrl: art.imageUrl || '',
            imagePlacement: art.imagePlacement || 'over',
            slug: 'members',
            published: '',
            author: null,
          },
        });
        console.log('  Fant medlemsside-artikkel, migrerer til Articles-tabellen');
      }

      for (const item of items) {
        const id = item.id ? `EVT-${item.id}` : generateId('EVT');
        results.push({
          partitionKey: 'event',
          rowKey: id,
          searchableFields: {
            date: item.date || '',
          },
          fullData: {
            id,
            title: item.title || item.Title,
            description: item.description || '',
            date: item.date || '',
            startTime: item.startTime || '',
            endTime: item.endTime || '',
            location: item.location || '',
            attendees: item.attendees || [],
            createdAt: item.createdAt || '',
          },
        });
      }

      return results;
    },
  },

};

// --- Hjelpefunksjoner ---

function readJsonFile(filename) {
  // Prøv eksakt filnavn først, deretter case-insensitiv match
  let filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    const files = fs.readdirSync(DATA_DIR);
    const match = files.find(f => f.toLowerCase() === filename.toLowerCase());
    if (match) {
      filePath = path.join(DATA_DIR, match);
    } else {
      return null;
    }
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let parsed = JSON.parse(raw);

  // Unwrap Power Automate envelope
  if (parsed.body) parsed = parsed.body;
  if (parsed.data) parsed = parsed.data;
  if (parsed.value) parsed = parsed.value;
  if (parsed.filer) parsed = parsed.filer; // Files-endepunktet

  return parsed;
}

// --- Hovedfunksjon ---

async function migrate() {
  console.log('=== Migrering: JSON-filer → Azure Table Storage ===');
  console.log(`Modus: ${DRY_RUN ? 'DRY RUN (ingen skriving)' : 'LIVE'}`);
  console.log(`Data-mappe: ${DATA_DIR}`);
  console.log('');

  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.error('FEIL: AZURE_STORAGE_CONNECTION_STRING mangler i .env');
    process.exit(1);
  }

  // Sjekk at data-mappen finnes
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`FEIL: Data-mappen "${DATA_DIR}" finnes ikke.`);
    console.error('Opprett mappen og legg JSON-filer der (se instruksjoner nedenfor).');
    process.exit(1);
  }

  // Opprett tabeller
  if (!DRY_RUN) {
    console.log('Oppretter tabeller...');
    await ensureTables();
    console.log('');
  }

  // List tilgjengelige filer
  const availableFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  console.log(`Fant ${availableFiles.length} JSON-fil(er) i data/:  ${availableFiles.join(', ')}`);
  console.log('');

  const stats = { total: 0, success: 0, errors: 0, skipped: 0 };

  for (const [key, config] of Object.entries(MIGRATIONS)) {
    // Sjekk filter
    if (ONLY_TABLES && !ONLY_TABLES.includes(key)) continue;

    const filename = `${key}.json`;
    const data = readJsonFile(filename);

    if (data === null) {
      console.log(`--- ${key} --- HOPPET OVER (${filename} ikke funnet)`);
      stats.skipped++;
      console.log('');
      continue;
    }

    console.log(`--- ${key} → ${config.tableName} ---`);

    try {
      let entities;

      if (config.transformAll) {
        // Spesialbehandling (f.eks. practice)
        entities = config.transformAll(data);
        console.log(`  Transformerte til ${entities.length} entiteter`);
      } else {
        // Standard: array av elementer
        const items = Array.isArray(data) ? data : [data];
        console.log(`  Leste ${items.length} elementer fra ${filename}`);
        entities = items.map((item, index) => config.transform(item, index));
      }

      for (const entity of entities) {
        try {
          stats.total++;
          if (DRY_RUN) {
            const preview = JSON.stringify(entity.fullData).substring(0, 100);
            console.log(`  [DRY] ${entity.rowKey}: ${preview}...`);
          } else {
            await upsertEntity(
              entity.tableName || config.tableName,
              buildEntity(entity.partitionKey, entity.rowKey, entity.searchableFields, entity.fullData)
            );
          }
          stats.success++;
        } catch (err) {
          stats.errors++;
          console.log(`  FEIL ved ${entity.rowKey}: ${err.message}`);
        }
      }

      console.log(`  OK: ${entities.length} entiteter behandlet`);
    } catch (err) {
      console.log(`  FEIL: ${err.message}`);
    }

    console.log('');
  }

  console.log('=== Ferdig ===');
  console.log(`Behandlet: ${stats.total} | OK: ${stats.success} | Feil: ${stats.errors} | Hoppet over: ${stats.skipped}`);

  if (DRY_RUN) {
    console.log('\nDette var en dry run. Kjør uten --dry-run for å utføre migreringen.');
  }
}

migrate().catch(err => {
  console.error('Fatal feil:', err);
  process.exit(1);
});
