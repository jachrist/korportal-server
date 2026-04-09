const express = require('express');
const router = express.Router();
const { listEntities, getEntity, upsertEntity, buildEntity } = require('../lib/table-client');
const { successResponse, errorResponse, validateRequired, generateId, now } = require('../lib/helpers');

/**
 * GET /api/filer
 * Response: { filer: [ { id, navn, kategori, url, sortering, verk, stemme, anledning } ] }
 */
router.get('/filer', async (req, res) => {
  try {
    const items = await listEntities('Files');

    const filer = items.map(item => ({
      id: item.id,
      navn: item.navn,
      kategori: item.kategori || '',
      url: item.url || '',
      sortering: item.sortering || 999,
      verk: item.verk || '',
      stemme: item.stemme || '',
      anledning: item.anledning || '',
    }));

    filer.sort((a, b) => a.sortering - b.sortering);
    return res.json({ filer });
  } catch (err) {
    console.error('filer error:', err);
    return errorResponse(res, 'Kunne ikke hente filer.', 500);
  }
});

/**
 * POST /api/filer/oppdater
 * Single file update: { id, kategori, verk, stemme, sortering, anledning }
 * Batch update:       { fileIds: ["1","2"], kategori, verk, stemme, sortering, anledning }
 * Response: { success: true }
 */
router.post('/filer/oppdater', async (req, res) => {
  try {
    const { id, fileIds, kategori, verk, stemme, sortering, anledning } = req.body;
    const ids = fileIds || (id ? [id] : []);

    if (ids.length === 0) {
      return errorResponse(res, 'Ingen fil-IDer angitt.');
    }

    const updates = {};
    if (kategori !== undefined) updates.kategori = kategori;
    if (verk !== undefined) updates.verk = verk;
    if (stemme !== undefined) updates.stemme = stemme;
    if (sortering !== undefined) updates.sortering = sortering;
    if (anledning !== undefined) updates.anledning = anledning;

    for (const fileId of ids) {
      const entity = await getEntity('Files', 'file', fileId);
      if (entity) {
        const updated = { ...entity, ...updates };
        await upsertEntity('Files', buildEntity('file', fileId, {
          kategori: updated.kategori || '',
          verk: updated.verk || '',
          anledning: updated.anledning || '',
        }, updated));
      }
    }

    return successResponse(res, { message: `${ids.length} fil(er) oppdatert.` });
  } catch (err) {
    console.error('filer oppdater error:', err);
    return errorResponse(res, 'Kunne ikke oppdatere filer.', 500);
  }
});

/**
 * POST /api/filer/batch-oppdater
 * Request: { fileIds: ["1","2"], kategori, verk, stemme, sortering, anledning }
 * Response: { success: true }
 * Note: same logic as /oppdater — accepts fileIds for batch operations.
 */
router.post('/filer/batch-oppdater', async (req, res) => {
  try {
    const { fileIds, kategori, verk, stemme, sortering, anledning } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return errorResponse(res, 'Ingen fil-IDer angitt.');
    }

    const updates = {};
    if (kategori !== undefined) updates.kategori = kategori;
    if (verk !== undefined) updates.verk = verk;
    if (stemme !== undefined) updates.stemme = stemme;
    if (sortering !== undefined) updates.sortering = sortering;
    if (anledning !== undefined) updates.anledning = anledning;

    for (const fileId of fileIds) {
      const entity = await getEntity('Files', 'file', fileId);
      if (entity) {
        const updated = { ...entity, ...updates };
        await upsertEntity('Files', buildEntity('file', fileId, {
          kategori: updated.kategori || '',
          verk: updated.verk || '',
          anledning: updated.anledning || '',
        }, updated));
      }
    }

    return successResponse(res, { message: `${fileIds.length} fil(er) oppdatert.` });
  } catch (err) {
    console.error('batch-oppdater error:', err);
    return errorResponse(res, 'Kunne ikke batch-oppdatere filer.', 500);
  }
});

/**
 * GET /api/filer/synk-blob
 * Lists all blobs in Azure Blob Storage and creates a Files table entry for each
 * blob that doesn't already exist (matched by navn).
 * Response: { success: true, synced: 5, skipped: 10 }
 */
router.get('/filer/synk-blob', async (req, res) => {
  try {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_BLOB_CONTAINER || 'sanger';
    const blobService = BlobServiceClient.fromConnectionString(blobConnectionString);
    const container = blobService.getContainerClient(containerName);

    // Get existing file names from table
    const existingItems = await listEntities('Files');
    const existingNames = new Set(existingItems.map(item => item.navn));

    let synced = 0;
    let skipped = 0;

    for await (const blob of container.listBlobsFlat()) {
      if (existingNames.has(blob.name)) {
        skipped++;
        continue;
      }

      const id = generateId('FIL');
      const blobUrl = `${container.url}/${encodeURIComponent(blob.name)}`;

      await upsertEntity('Files', buildEntity('file', id, {
        kategori: '',
        verk: '',
        anledning: '',
      }, {
        id,
        navn: blob.name,
        url: blobUrl,
        kategori: '',
        verk: '',
        stemme: '',
        sortering: 999,
        anledning: '',
        syncedAt: now(),
      }));

      synced++;
    }

    return successResponse(res, { synced, skipped, message: `${synced} nye filer synkronisert, ${skipped} allerede i tabellen.` });
  } catch (err) {
    console.error('filer synk-blob error:', err);
    return errorResponse(res, 'Kunne ikke synkronisere fra blob storage.', 500);
  }
});

/**
 * POST /api/filer/last-opp
 * Request: { filer: [ { navn: "file.pdf", innhold: "<base64>" } ] }
 * Response: { success: true, uploadedCount: 2 }
 */
router.post('/filer/last-opp', async (req, res) => {
  try {
    const { filer } = req.body;
    if (!filer || !Array.isArray(filer) || filer.length === 0) {
      return errorResponse(res, 'Ingen filer å laste opp.');
    }

    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_BLOB_CONTAINER || 'sanger';
    const blobService = BlobServiceClient.fromConnectionString(blobConnectionString);
    const container = blobService.getContainerClient(containerName);

    let uploadedCount = 0;
    for (const fil of filer) {
      const err = validateRequired(fil, ['navn', 'innhold']);
      if (err) continue;

      // Upload to blob storage
      const blobClient = container.getBlockBlobClient(fil.navn);
      const buffer = Buffer.from(fil.innhold, 'base64');
      await blobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: guessMimeType(fil.navn) },
      });

      // Create file entry in table
      const id = generateId('FIL');
      const blobUrl = `${container.url}/${encodeURIComponent(fil.navn)}`;
      await upsertEntity('Files', buildEntity('file', id, {
        kategori: '',
        verk: '',
        anledning: '',
      }, {
        id,
        navn: fil.navn,
        url: blobUrl,
        kategori: '',
        verk: '',
        stemme: '',
        sortering: 999,
        anledning: '',
        uploadedAt: now(),
      }));

      uploadedCount++;
    }

    return successResponse(res, { uploadedCount });
  } catch (err) {
    console.error('filer last-opp error:', err);
    return errorResponse(res, 'Kunne ikke laste opp filer.', 500);
  }
});

function guessMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    pdf: 'application/pdf',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    xml: 'application/xml',
    musicxml: 'application/vnd.recordare.musicxml+xml',
  };
  return types[ext] || 'application/octet-stream';
}

module.exports = router;
