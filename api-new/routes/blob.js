const express = require('express');
const router = express.Router();
const { successResponse, errorResponse, validateRequired } = require('../lib/helpers');

/**
 * POST /api/blob/last-opp
 * Request: { files: [ { id, url, navn } ] }
 * Copies files from source URLs to Azure Blob Storage.
 * Response: { success: true, uploadedCount: 2 }
 */
router.post('/last-opp', async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return errorResponse(res, 'Ingen filer å laste opp.');
    }

    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_BLOB_CONTAINER || 'sanger';
    const blobService = BlobServiceClient.fromConnectionString(blobConnectionString);
    const container = blobService.getContainerClient(containerName);

    let uploadedCount = 0;
    for (const file of files) {
      try {
        const blobClient = container.getBlockBlobClient(file.navn);
        // Copy from source URL
        await blobClient.syncCopyFromURL(file.url);
        uploadedCount++;
      } catch (copyErr) {
        console.error(`Kunne ikke kopiere ${file.navn}:`, copyErr.message);
      }
    }

    return successResponse(res, { uploadedCount });
  } catch (err) {
    console.error('blob last-opp error:', err);
    return errorResponse(res, 'Kunne ikke laste opp til blob storage.', 500);
  }
});

/**
 * POST /api/blob/tom
 * Request: { action: "clear_all" }
 * Deletes all blobs in the container.
 * Response: { success: true, deletedCount: 15 }
 */
router.post('/tom', async (req, res) => {
  try {
    if (req.body.action !== 'clear_all') {
      return errorResponse(res, 'Ugyldig handling. Bruk action: "clear_all".');
    }

    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_BLOB_CONTAINER || 'sanger';
    const blobService = BlobServiceClient.fromConnectionString(blobConnectionString);
    const container = blobService.getContainerClient(containerName);

    let deletedCount = 0;
    for await (const blob of container.listBlobsFlat()) {
      await container.deleteBlob(blob.name);
      deletedCount++;
    }

    return successResponse(res, { deletedCount, message: `${deletedCount} filer slettet fra blob storage.` });
  } catch (err) {
    console.error('blob tom error:', err);
    return errorResponse(res, 'Kunne ikke tømme blob storage.', 500);
  }
});

module.exports = router;
