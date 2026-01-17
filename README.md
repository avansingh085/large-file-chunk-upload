# File Upload System - Full Stack Application

A production-ready chunked file upload system with pause/resume, integrity verification, and ZIP preview capabilities.

## Features
- **Chunked Upload**: Files split into 5MB chunks for reliable upload
- **Resume Support**: Upload interruptions can be resumed from last successful chunk
- **Pause/Resume Logic**: Users can pause and resume uploads anytime
- **File Integrity**: SHA-256 hashing validates file hasn't been corrupted
- **Concurrent Uploads**: 3 concurrent chunks upload at same time for speed
- **ZIP Preview**: Peek into ZIP file contents without extracting
- **Auto Cleanup**: Orphaned incomplete uploads deleted after 24 hours
- **Download Support**: Range request support for resumable downloads

---

## File Integrity (SHA-256 Hashing)

### How It Works:
1. **Frontend Hash Calculation**: Before upload starts, entire file is hashed using Web Crypto API
   ```javascript
   const finalHash = await crypto.subtle.digest('SHA-256', arrayBuffer);
   ```
2. **Handshake Phase**: Hash sent to backend in initial handshake request
3. **Database Storage**: Expected hash stored in `uploads` table
4. **Chunk Upload**: Individual chunks uploaded at specified file offsets (no hash per chunk)
5. **Merge Verification**: After all chunks merged, final file is re-hashed
6. **Validation**: Actual hash compared against expected hash
   -  Match = Upload successful, status set to `COMPLETED`
   -  Mismatch = Upload failed, integrity check error returned

### Location in Code:
- Backend: [uploadController.js](backend/src/controllers/uploadController.js#L12-L20) - `calculateFileHash()` function
- Backend: [uploadController.js](backend/src/controllers/uploadController.js#L130-L148) - Hash verification in `mergeChunks()`
- Frontend: [useUpload.js](frontend/src/hooks/useUpload.js#L16-L21) - Client-side hashing

---

## Pause/Resume Logic

### How It Works:
1. **Frontend State**: `pauseRef` (React ref) holds pause status, doesn't trigger re-renders
   ```javascript
   pauseRef.current = !pauseRef.current;
   ```
2. **Queue System**: Failed/pending chunks stay in queue, can be retried
3. **Pause Loop**: When paused, worker thread polls every 500ms checking if still paused
   ```javascript
   if (pauseRef.current) {
     await new Promise(r => setTimeout(r, 500));
     continue; // Skip to next loop iteration
   }
   ```
4. **Concurrent Workers**: 3 parallel workers (configurable) process chunk queue
5. **Chunk Status Tracking**: Each chunk tracked as `PENDING` → `UPLOADING` → `SUCCESS` or `FAILED`
6. **Resume**: Toggle pause again, workers wake up and continue with remaining chunks
7. **Server State**: Backend stores which chunks succeeded in `chunks` table, client auto-recovers on page reload

### Location in Code:
- Frontend: [useUpload.js](frontend/src/hooks/useUpload.js#L26-L27) - `togglePause()` function
- Frontend: [useUpload.js](frontend/src/hooks/useUpload.js#L65-L73) - Pause check and loop
- Frontend: [useUpload.js](frontend/src/hooks/useUpload.js#L60-L95) - `processQueue()` with retry logic

---

## Known Trade-offs

| Trade-off | Reason | Impact |
|-----------|--------|--------|
| **Fixed 5MB chunk size** | Prevents memory overflow on large files and balances upload speed | Larger files take longer, more HTTP requests |
| **SHA-256 for entire file** | Only verified after all chunks merged, not per-chunk | Corrupted individual chunks detected late (after merge) |
| **3 concurrent chunks** | Balances network load and server resources | Slower than max concurrency, but stable |
| **24-hour cleanup grace period** | Allows pause/resume within a day | Incomplete uploads use disk space temporarily |
| **File stored with uploadId name** | Simple temp file tracking without extra metadata | uploadId folder created if multiple retries on same chunk |
| **No encryption in transit** | Adds complexity for interview project | HTTPS recommended in production |
| **In-memory queue** | Paused state lost on browser refresh | User must re-pause after page reload |

---

## Further Enhancements

### Backend Improvements:
1. **Per-chunk hash validation** - Calculate MD5 per chunk, client sends hash in header for early corruption detection
2. **S3/Cloud storage** - Move uploads to S3 instead of local disk for scalability
3. **Multi-part upload API** - Implement AWS S3 multipart upload for true parallel uploads
4. **Compression** - Gzip chunks before upload to reduce bandwidth
5. **Rate limiting** - Add IP-based rate limiting to prevent abuse
6. **File size limits** - Enforce max file size at handshake stage
7. **Virus scanning** - Scan uploaded files with ClamAV or similar

### Frontend Improvements:
1. **Drag-and-drop UI** - Better UX for file selection
2. **Upload queue** - Multiple file uploads queued and processed sequentially
3. **Network detection** - Detect connection loss and auto-pause
4. **Progress bar animation** - Smooth animations for better UX
5. **Pause duration timer** - Show how long upload has been paused
6. **Bandwidth throttling** - Allow users to limit upload speed
7. **Retry with exponential backoff** - Retry failed chunks with increasing delays

### Security:
1. **Token authentication** - Require auth token for uploads
2. **File type validation** - Whitelist allowed file extensions
3. **Signature verification** - Sign uploads server-side, verify on client
4. **CORS hardening** - Stricter origin checking

### Database:
1. **Indexes on upload_id and status** - Faster queries for cleanup/resume
2. **Soft deletes** - Mark uploads as deleted instead of removing
3. **User association** - Track uploads by user_id for multi-user support
4. **Audit logging** - Log all upload/download events

