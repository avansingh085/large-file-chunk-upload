const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const { pool } = require('../config/db');

const uploadsDir = path.join(__dirname, '../../uploads');

exports.handshake = async (req, res) => {
  const { fileName, fileSize } = req.query;
  if (!fileName || !fileSize) return res.status(400).send("Missing params");

  const uploadId = Buffer.from(`${fileName}-${fileSize}`).toString('base64');
  
  try {
    const [rows] = await pool.query('SELECT chunk_index FROM chunks WHERE upload_id = ?', [uploadId]);
    res.json({ uploadId, uploadedChunks: rows.map(r => r.chunk_index) });
  } catch (err) {
    res.status(500).send("Database error");
  }
};

exports.uploadChunk = async (req, res) => {

if (Math.random() < 0.3) {
    console.log("Simulating network failure (408 Timeout)");
    return res.status(408).send("Simulated Network Timeout");
  }
  
  const uploadId = req.headers['x-upload-id'];
  const chunkIndex = parseInt(req.headers['x-chunk-index']);
  const startOffset = parseInt(req.headers['x-offset']);
  const filePath = path.join(uploadsDir, uploadId);

  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, Buffer.alloc(0));

  const writeStream = fs.createWriteStream(filePath, { flags: 'r+', start: startOffset });
  req.pipe(writeStream);

  writeStream.on('finish', async () => {
    try {
      await pool.query('INSERT IGNORE INTO chunks (upload_id, chunk_index, status) VALUES (?, ?, ?)', 
      [uploadId, chunkIndex, 'SUCCESS']);
      res.sendStatus(200);
    } catch (err) {
      res.status(500).send("DB Error");
    }
  });
};

exports.mergeChunks = async (req, res) => {


    
  const { uploadId, fileName } = req.body;
  const tempFilePath = path.join(uploadsDir, uploadId);
  const finalFilePath = path.join(uploadsDir, fileName);

  try {
    if (fs.existsSync(tempFilePath)) {
      fs.renameSync(tempFilePath, finalFilePath);
      res.send({ message: "File merged successfully" });
    } else {
      res.status(404).send("Temp file not found");
    }
  } catch (err) {
    res.status(500).send("Merge failed");
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

      if (name.startsWith(folderPrefix)) {
       
        const internalPath = name.substring(folderPrefix.length);

        if (internalPath.length > 0) {
         
          const parts = internalPath.split('/');
          const displayName = parts[0] + (parts.length > 1 ? '/' : '');
          contents.add(displayName);
        }
      } else {
       
        const parts = name.split('/');
        contents.add(parts[0] + (parts.length > 1 ? '/' : ''));
      }

      zipfile.readEntry();
    });

    zipfile.on("end", () => {
      res.json({ 
        fileName, 
        contents: Array.from(contents).sort() 
      });
    });
  });
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
              
                const [rows] = await pool.query('SELECT 1 FROM chunks WHERE upload_id = ? LIMIT 1', [file]);

                if (rows.length > 0) {
                    fs.unlinkSync(filePath); 
                    await pool.query('DELETE FROM chunks WHERE upload_id = ?', [file]); 
                    console.log(`Successfully cleaned up: ${file}`);
                }
            }
        }
    } catch (err) {
        console.error("Cleanup job failed:", err);
    }
};