const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { successResponse, errorResponse } = require('../lib/helpers');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * POST /api/blob/last-opp
 * Request: { files: [ { id, url, navn } ] }
 * Downloads files from source URLs and saves to local filesystem.
 * Response: { success: true, uploadedCount: 2 }
 */
router.post('/last-opp', async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return errorResponse(res, 'Ingen filer å laste opp.');
    }

    let uploadedCount = 0;
    for (const file of files) {
      try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = path.join(uploadDir, file.navn);
        fs.writeFileSync(filePath, buffer);
        uploadedCount++;
      } catch (copyErr) {
        console.error(`Kunne ikke laste ned ${file.navn}:`, copyErr.message);
      }
    }

    return successResponse(res, { uploadedCount });
  } catch (err) {
    console.error('blob last-opp error:', err);
    return errorResponse(res, 'Kunne ikke laste opp filer.', 500);
  }
});

/**
 * POST /api/blob/tom
 * Request: { action: "clear_all" }
 * Deletes all files in the upload directory.
 * Response: { success: true, deletedCount: 15 }
 */
router.post('/tom', async (req, res) => {
  try {
    if (req.body.action !== 'clear_all') {
      return errorResponse(res, 'Ugyldig handling. Bruk action: "clear_all".');
    }

    const entries = fs.readdirSync(uploadDir);
    let deletedCount = 0;
    for (const entry of entries) {
      const fullPath = path.join(uploadDir, entry);
      if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        deletedCount++;
      }
    }

    return successResponse(res, { deletedCount, message: `${deletedCount} filer slettet.` });
  } catch (err) {
    console.error('blob tom error:', err);
    return errorResponse(res, 'Kunne ikke tømme filmappen.', 500);
  }
});

module.exports = router;
