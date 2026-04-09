/**
 * WAV-til-MP3 konverteringsverktøy
 * Konverterer flere WAV-filer til MP3 og pakker dem i en ZIP.
 * Bruker lamejs for encoding og JSZip for ZIP-pakking.
 *
 * @module WavMp3Tool
 */

const MP3_BITRATE = 128;

/**
 * Initialiserer WAV→MP3-verktøyet på admin-siden.
 * Kalles fra admin.js.
 */
export function initWavMp3Tool() {
    const section = document.getElementById('wav-mp3-tool');
    if (!section) return;

    const dropzone = section.querySelector('.mxml-dropzone');
    const fileInput = section.querySelector('input[type="file"]');
    const fileList = section.querySelector('.wav-file-list');
    const fileCount = section.querySelector('.wav-file-count');
    const clearAllBtn = section.querySelector('.wav-clear-all');
    const processBtn = section.querySelector('.mxml-btn--primary');
    const downloadBtn = section.querySelector('.mxml-btn--download');
    const resultDiv = section.querySelector('.mxml-result');
    const progressDiv = section.querySelector('.wav-progress');
    const progressBar = section.querySelector('.wav-progress__bar');
    const progressText = section.querySelector('.wav-progress__text');

    let wavFiles = [];
    let zipBlob = null;

    // --- Event listeners ---

    fileInput?.addEventListener('change', (e) => {
        addFiles(e.target.files);
        fileInput.value = '';
    });

    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        addFiles(e.dataTransfer.files);
    });

    clearAllBtn?.addEventListener('click', clearAll);
    processBtn?.addEventListener('click', convert);
    downloadBtn?.addEventListener('click', download);

    // --- Functions ---

    function addFiles(files) {
        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.wav')) continue;
            if (wavFiles.some(f => f.name === file.name)) continue;
            wavFiles.push(file);
        }
        updateFileList();
    }

    function removeFile(index) {
        wavFiles.splice(index, 1);
        updateFileList();
    }

    function clearAll() {
        wavFiles = [];
        zipBlob = null;
        updateFileList();
        hideResult();
        setProgress(0, '');
        progressDiv.hidden = true;
        downloadBtn.disabled = true;
    }

    function updateFileList() {
        fileCount.textContent = wavFiles.length === 0
            ? 'Ingen filer valgt'
            : `${wavFiles.length} fil${wavFiles.length !== 1 ? 'er' : ''} valgt`;

        fileList.innerHTML = wavFiles.map((f, i) => `
            <div class="wav-file-item">
                <span class="wav-file-item__name">${escapeHtml(f.name)}</span>
                <button class="mxml-file-remove" data-index="${i}" title="Fjern">&times;</button>
            </div>
        `).join('');

        fileList.hidden = wavFiles.length === 0;
        clearAllBtn.hidden = wavFiles.length === 0;
        processBtn.disabled = wavFiles.length === 0;
        downloadBtn.disabled = true;
        zipBlob = null;
    }

    fileList?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-index]');
        if (btn) removeFile(Number(btn.dataset.index));
    });

    async function convert() {
        if (wavFiles.length === 0) return;

        processBtn.classList.add('processing');
        processBtn.disabled = true;
        downloadBtn.disabled = true;
        hideResult();
        progressDiv.hidden = false;
        setProgress(0, 'Laster biblioteker...');

        try {
            // Lazy-load vendor libs
            await loadVendorLibs();

            const zip = new JSZip();
            const total = wavFiles.length;

            for (let i = 0; i < total; i++) {
                const file = wavFiles[i];
                setProgress(
                    Math.round((i / total) * 100),
                    `Konverterer ${i + 1} av ${total}: ${file.name}`
                );

                const arrayBuffer = await file.arrayBuffer();
                const mp3Data = encodeWavToMp3(arrayBuffer);
                const mp3Name = file.name.replace(/\.wav$/i, '.mp3');
                zip.file(mp3Name, mp3Data);
            }

            setProgress(95, 'Pakker ZIP...');
            zipBlob = await zip.generateAsync({ type: 'blob' });

            setProgress(100, 'Ferdig!');
            showResult(`${total} fil${total !== 1 ? 'er' : ''} konvertert til MP3 (${MP3_BITRATE} kbps).`, 'success');
            downloadBtn.disabled = false;

        } catch (error) {
            console.error('WAV→MP3 conversion failed:', error);
            showResult(`Feil: ${error.message}`, 'error');
        } finally {
            processBtn.classList.remove('processing');
            processBtn.disabled = wavFiles.length === 0;
        }
    }

    function download() {
        if (!zipBlob) return;
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mp3-filer.zip';
        a.click();
        URL.revokeObjectURL(url);
    }

    function setProgress(percent, text) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = text;
    }

    function showResult(message, type) {
        resultDiv.hidden = false;
        resultDiv.className = `mxml-result mxml-result--${type}`;
        resultDiv.textContent = message;
    }

    function hideResult() {
        resultDiv.hidden = true;
    }
}

// ==========================================================================
// WAV PARSING & MP3 ENCODING
// ==========================================================================

let vendorLoaded = false;

async function loadVendorLibs() {
    if (vendorLoaded) return;

    await Promise.all([
        loadScript('/js/vendor/lamejs.min.js'),
        loadScript('/js/vendor/jszip.min.js'),
    ]);
    vendorLoaded = true;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Kunne ikke laste ${src}`));
        document.head.appendChild(s);
    });
}

function encodeWavToMp3(arrayBuffer) {
    const view = new DataView(arrayBuffer);

    // Parse WAV header
    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);

    // Find data chunk
    let dataOffset = 12;
    while (dataOffset < view.byteLength - 8) {
        const chunkId = String.fromCharCode(
            view.getUint8(dataOffset),
            view.getUint8(dataOffset + 1),
            view.getUint8(dataOffset + 2),
            view.getUint8(dataOffset + 3)
        );
        const chunkSize = view.getUint32(dataOffset + 4, true);
        if (chunkId === 'data') {
            dataOffset += 8;
            break;
        }
        dataOffset += 8 + chunkSize;
    }

    // Read PCM samples as Int16
    const bytesPerSample = bitsPerSample / 8;
    const numSamples = Math.floor((arrayBuffer.byteLength - dataOffset) / (bytesPerSample * numChannels));

    let left, right;

    if (bitsPerSample === 16) {
        left = new Int16Array(numSamples);
        right = numChannels === 2 ? new Int16Array(numSamples) : null;
        for (let i = 0; i < numSamples; i++) {
            const offset = dataOffset + i * numChannels * 2;
            left[i] = view.getInt16(offset, true);
            if (right) right[i] = view.getInt16(offset + 2, true);
        }
    } else if (bitsPerSample === 24) {
        left = new Int16Array(numSamples);
        right = numChannels === 2 ? new Int16Array(numSamples) : null;
        for (let i = 0; i < numSamples; i++) {
            const offset = dataOffset + i * numChannels * 3;
            // Convert 24-bit to 16-bit by taking high 2 bytes
            left[i] = (view.getUint8(offset + 1) | (view.getInt8(offset + 2) << 8));
            if (right) {
                right[i] = (view.getUint8(offset + 4) | (view.getInt8(offset + 5) << 8));
            }
        }
    } else {
        throw new Error(`Ustøttet bit-dybde: ${bitsPerSample}. Kun 16-bit og 24-bit WAV støttes.`);
    }

    // Encode to MP3
    const encoder = numChannels === 2
        ? new lamejs.Mp3Encoder(2, sampleRate, MP3_BITRATE)
        : new lamejs.Mp3Encoder(1, sampleRate, MP3_BITRATE);

    const mp3Chunks = [];
    const blockSize = 1152;

    for (let i = 0; i < numSamples; i += blockSize) {
        const leftChunk = left.subarray(i, i + blockSize);
        let mp3buf;
        if (numChannels === 2) {
            const rightChunk = right.subarray(i, i + blockSize);
            mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
        } else {
            mp3buf = encoder.encodeBuffer(leftChunk);
        }
        if (mp3buf.length > 0) mp3Chunks.push(mp3buf);
    }

    const end = encoder.flush();
    if (end.length > 0) mp3Chunks.push(end);

    // Concatenate
    const totalLength = mp3Chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const mp3Data = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of mp3Chunks) {
        mp3Data.set(chunk, offset);
        offset += chunk.length;
    }

    return mp3Data;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
