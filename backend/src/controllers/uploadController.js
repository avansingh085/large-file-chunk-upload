const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');
const { pool } = require('../config/db');

const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const calculateFileHash = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
};

exports.handshake = async (req, res) => {
    const { fileName, fileSize, totalChunks, finalHash } = req.query;
    if (!fileName || !fileSize || !finalHash) {
        return res.status(400).send("Missing required parameters (fileName, fileSize, finalHash)");
    }


    const uploadId = crypto.createHash('md5').update(`${fileName}-${fileSize}-${finalHash}`).digest('hex');

    try {

        await pool.query(
            `INSERT IGNORE INTO uploads (id, filename, total_size, total_chunks, status, final_hash) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uploadId, fileName, fileSize, totalChunks, 'UPLOADING', finalHash]
        );


        const [rows] = await pool.query(
            'SELECT chunk_index FROM chunks WHERE upload_id = ? AND status = "SUCCESS"',
            [uploadId]
        );

        res.json({
            uploadId,
            uploadedChunks: rows.map(r => r.chunk_index)
        });
    } catch (err) {
        console.error("Handshake Error:", err);
        res.status(500).send("Database error");
    }
};

exports.uploadChunk = async (req, res) => {
    const uploadId = req.headers['x-upload-id'];
    const chunkIndex = parseInt(req.headers['x-chunk-index']);
    const startOffset = parseInt(req.headers['x-offset']);
    const filePath = path.join(uploadsDir, uploadId);

    if (!uploadId) return res.status(400).send("Missing Upload ID");

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, Buffer.alloc(0));
    }

    const writeStream = fs.createWriteStream(filePath, { flags: 'r+', start: startOffset });
    req.pipe(writeStream);

    let hasResponded = false;

    req.on('error', (err) => {
        writeStream.destroy();
        console.error("Request stream error:", err);
        if (!hasResponded) {
            hasResponded = true;
            res.status(500).send("Upload stream error");
        }
    });

    writeStream.on('finish', async () => {
        if (hasResponded) return;
        try {
            await pool.query(
                `INSERT INTO chunks (upload_id, chunk_index, status, received_at) 
                 VALUES (?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE status = 'SUCCESS', received_at = NOW()`,
                [uploadId, chunkIndex, 'SUCCESS']
            );
            hasResponded = true;
            res.sendStatus(200);
        } catch (err) {
            console.error("Chunk DB Error:", err);
            hasResponded = true;
            res.status(500).send("DB Error");
        }
    });

    writeStream.on('error', (err) => {
        console.error("Write stream error:", err);
        if (!hasResponded) {
            hasResponded = true;
            res.status(500).send("File Write Error");
        }
    });
};

exports.mergeChunks = async (req, res) => {
    const { uploadId, fileName } = req.body;
    const tempFilePath = path.join(uploadsDir, uploadId);
    const finalFilePath = path.join(uploadsDir, fileName);

    try {
        if (!fs.existsSync(tempFilePath)) {
            return res.status(404).send("Temporary file not found");
        }

        await pool.query('UPDATE uploads SET status = "PROCESSING" WHERE id = ?', [uploadId]);

        fs.renameSync(tempFilePath, finalFilePath);

        const [rows] = await pool.query('SELECT final_hash FROM uploads WHERE id = ?', [uploadId]);
        const expectedHash = rows[0]?.final_hash;

        const actualHash = await calculateFileHash(finalFilePath);

        if (expectedHash && actualHash !== expectedHash) {
            await pool.query('UPDATE uploads SET status = "FAILED" WHERE id = ?', [uploadId]);

            return res.status(422).json({
                error: "Integrity check failed",
                expected: expectedHash,
                actual: actualHash
            });
        }


        await pool.query('UPDATE uploads SET status = "COMPLETED" WHERE id = ?', [uploadId]);
        res.json({ message: "File merged and verified successfully" });

    } catch (err) {
        console.error("Merge Error:", err);
        await pool.query('UPDATE uploads SET status = "FAILED" WHERE id = ?', [uploadId]);
        res.status(500).send("Merge failed");
    }
};

exports.cleanupOrphanedUploads = async () => {
    const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    try {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);

            if (now - stats.mtimeMs > GRACE_PERIOD_MS) {

                const [rows] = await pool.query('SELECT status FROM uploads WHERE id = ?', [file]);

                if (rows.length > 0 && rows[0].status !== 'COMPLETED') {
                    fs.unlinkSync(filePath);
                    await pool.query('DELETE FROM uploads WHERE id = ?', [file]);
                    await pool.query('DELETE FROM chunks WHERE upload_id = ?', [file]);
                    console.log(`Cleaned up: ${file}`);
                }
            }
        }
    } catch (err) {
        console.error("Cleanup job failed:", err);
    }
};

exports.listFiles = (req, res) => {
    const files = fs.readdirSync(uploadsDir);
    res.json({ files });
};

exports.downloadFile = (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(uploadsDir, fileName);

    if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

    const { size: fileSize } = fs.statSync(filePath);
    const range = req.headers.range;

    if (!range) {
        res.writeHead(200, { "Content-Length": fileSize, "Content-Type": "application/octet-stream" });
        return fs.createReadStream(filePath).pipe(res);
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": "application/octet-stream"
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
};

exports.peekZip = (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(uploadsDir, fileName);
    const folderPrefix = path.parse(fileName).name + "/";

    if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

    const contents = new Set();
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return res.status(500).send("Error reading ZIP");

        zipfile.readEntry();
        zipfile.on("entry", (entry) => {
            const name = entry.fileName;
            const parts = name.startsWith(folderPrefix)
                ? name.substring(folderPrefix.length).split('/')
                : name.split('/');

            const displayName = parts[0] + (parts.length > 1 ? '/' : '');
            if (displayName) contents.add(displayName);
            zipfile.readEntry();
        });

        zipfile.on("end", () => {
            res.json({ fileName, contents: Array.from(contents).sort() });
        });
    });
};