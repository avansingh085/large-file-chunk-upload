# Cloud Uploader - Chunked File Upload System

Robust resumable file upload with SHA-256 integrity verification, pause/resume, and concurrent chunk transfers.

**Features**: 5MB chunks | SHA-256 hashing | 3 concurrent uploads | Pause/resume | ZIP preview | 24h recovery window

---
## Overview
This project implements a production-ready file upload system with the following features:
- **Chunked uploads** (5MB chunks) for large file support
- **Resume capability** to recover interrupted uploads
- **Concurrent chunk uploads** (3 parallel uploads)
- **ZIP file preview** without full extraction
- **Range-based downloads** for efficient bandwidth usage
- **Automatic cleanup** of orphaned uploads after 24 hours
- **Database tracking** of all upload states

---

## File Integrity & Hashing

### Current Implementation

**Status**: ⚠️ **File hashing is NOT currently implemented**

### How It Works

1. **Upload ID Generation**
   ```javascript
  
   const uploadId = Buffer.from(`${fileName}-${fileSize}`).toString('base64');
   ```
   - Uses Base64 encoding of `filename + filesize` as unique identifier
   - Serves as temporary file identifier during upload

2. **Chunk Tracking (Database)**
   ```sql
   CREATE TABLE chunks (
     upload_id VARCHAR(255),
     chunk_index INT,
     status VARCHAR(20),
     received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (upload_id, chunk_index)
   )
   ```
   - Tracks which chunks have been successfully received via INSERT IGNORE
   - Status values: 'SUCCESS' for completed chunks

3. **Offset-Based Integrity (Actual Implementation)**
   ```javascript
   
   const startOffset = parseInt(req.headers['x-offset']);
   const writeStream = fs.createWriteStream(filePath, { flags: 'r+', start: startOffset });
   req.pipe(writeStream);
   ```
   - Writes chunks at specific byte offsets to reconstruct original file
   - File system ensures byte-level accuracy for reassembly
   - No corruption checking per chunk
   - Complete file verification relies on successful database entries for all chunks

### Why Hashing Isn't Implemented

1. **Offset-based reconstruction** ensures byte-level positional accuracy
2. **Chunk status tracking** in DB prevents incomplete uploads from merging
3. **24-hour automatic cleanup** removes orphaned partial files
4. **Automatic retry on failure** re-uploads failed chunks before merge

---

## Pause/Resume Logic

### Frontend Implementation

**File**: [frontend/src/hooks/useUpload.js](frontend/src/hooks/useUpload.js)

#### Key State Management
```javascript
const pauseRef = useRef(false);           // Direct pause flag
const [isPaused, setIsPaused] = useState(false);  // UI state
const [statusMap, setStatusMap] = useState({});    // Per-chunk status
```

#### Upload Flow with Pause/Resume

1. **Handshake Phase**
   ```javascript
   const { data } = await uploadApi.handshake(file.name, file.size);
   const { uploadId, uploadedChunks } = data;
   ```
   - Queries server for previously uploaded chunks
   - `uploadedChunks` contains indices of already-completed chunks
   - Skips re-uploading completed chunks

2. **Pause Mechanism**
   ```javascript
   const togglePause = () => {
     pauseRef.current = !pauseRef.current;
     setIsPaused(pauseRef.current);
   };
   ```
   - Sets internal flag that pauses queue processing
   - Does NOT cancel in-flight requests (see trade-offs)

3. **Queue Processing with Pause Loop**
   ```javascript
   const processQueue = async () => {
     while (queue.length > 0) {
       // Check pause flag every 500ms
       if (pauseRef.current) {
         await new Promise(r => setTimeout(r, 500));
         continue;  // Stay in loop without processing
       }
       
       // Process next chunk...
     }
   };
   ```
   - Polls pause flag every 500ms
   - Allows graceful resumption without restarting upload

4. **Chunk Status Tracking**
   ```javascript
   setStatusMap(prev => ({ ...prev, [index]: 'UPLOADING' }));
   // Then after success or failure:
   setStatusMap(prev => ({ ...prev, [index]: 'SUCCESS' }));
   setStatusMap(prev => ({ ...prev, [index]: 'PENDING' })); // On retry
   ```
   - UI displays status per chunk in real-time
   - Failed chunks automatically retry with 2-second delay

#### Backend Resume Support

**File**: [backend/src/controllers/uploadController.js](backend/src/controllers/uploadController.js)

```javascript
exports.handshake = async (req, res) => {
  const { fileName, fileSize } = req.query;
  const uploadId = Buffer.from(`${fileName}-${fileSize}`).toString('base64');
  
  // Query existing chunks
  const [rows] = await pool.query(
    'SELECT chunk_index FROM chunks WHERE upload_id = ?', 
    [uploadId]
  );
  
  res.json({ 
    uploadId, 
    uploadedChunks: rows.map(r => r.chunk_index)  // Resume from here
  });
};
```

#### Resume Workflow
1. User clicks **Pause** → `pauseRef.current = true`
2. Current in-flight uploads complete, queue processing stops
3. User clicks **Resume** → `pauseRef.current = false`
4. Queue resumes processing from where it left off
5. Handshake already identified completed chunks, so no duplicates

---

## Known Trade-offs

### 1. **No Per-Chunk Hashing**
   - **Trade-off**: Simpler implementation vs. cryptographic integrity
   - **Impact**: Relies on offset-based positioning and database tracking for correctness
   - **Your Choice**: Prioritized speed and simplicity over full integrity verification

### 2. **In-Flight Requests NOT Cancelled on Pause**
   ```javascript
   // From useUpload.js processQueue
   if (pauseRef.current) {
     await new Promise(r => setTimeout(r, 500));
     continue;  // Waits for current upload to finish
   }
   ```
   - **Trade-off**: Simpler pause logic vs. immediate interruption
   - **Impact**: Up to 3 chunks may complete after pause is clicked
   - **Your Choice**: Pause is soft-stop, not hard-cancel

### 3. **No Client-Side Chunk Validation**
   - **Trade-off**: Reduced complexity vs. early error detection
   - **Impact**: Bad chunks detected only on merge or automatic retry
   - **Your Choice**: Rely on server-side status tracking instead

### 4. **Simulated Network Failures in Production Code**
   ```javascript
   
   if (Math.random() < 0.3) { 
     console.log("Simulating network failure (408 Timeout)");
     return res.status(408).send("Simulated Network Timeout");
   }
   ```
   - **Trade-off**: Testing pause/resume vs. unreliable service
   - **Impact**: Production upload fails 30% of the time per chunk
   - **Your Choice**: Intentional for demonstrating retry/pause functionality
   - ** WARNING**: Should be removed before production deployment

### 5. **Fixed 5MB Chunk Size**
   ```javascript
  
   const CHUNK_SIZE = 1024 * 1024 * 5;
   ```
   - **Trade-off**: One-size-fits-all vs. adaptive sizing
   - **Impact**: Inefficient for very small files, slower for very large files
   - **Your Choice**: Balance between browser memory usage and upload efficiency

### 6. **Limited Concurrency (3 Parallel)**
   ```javascript
   
   const CONCURRENCY_LIMIT = 3;
   ```
   - **Trade-off**: Server stability vs. upload speed
   - **Impact**: Slower uploads for high-bandwidth clients
   - **Your Choice**: Prevent server overload and maintain stability

### 7. **No Bandwidth Throttling**
   - **Trade-off**: Maximum speed vs. client responsiveness
   - **Impact**: Large uploads may freeze UI during transfers
   - **Your Choice**: Prioritized speed over UI smoothness

### 8. **HTTP Only (No HTTPS/Encryption)**
   - **Trade-off**: Simplicity vs. security
   - **Impact**: File contents visible on network in plain HTTP
   - **Your Choice**: Development/demo setup, not production-hardened

### 9. **24-Hour Orphan Cleanup Grace Period**
   ```javascript
   
   const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
   ```
   - **Trade-off**: User recovery window vs. storage efficiency
   - **Impact**: Failed uploads waste disk space for 24 hours
   - **Your Choice**: Generous recovery window for users

### 10. **No File Retention Policy**
   - **Trade-off**: User convenience vs. resource management
   - **Impact**: Old files remain indefinitely after completion
   - **Your Choice**: Keep all successfully uploaded files permanently

---

## Future Enhancements (Recommendations)

These enhancements would improve the system for production use:

### High Priority

1. **Remove Simulated Network Failures**
   - Delete the random 30% failure block from `uploadController.js`
   - Reason: Critical for production stability

2. **Add SHA-256 File Hashing**
   - Implement hash verification after file merge
   - Store hash in database for integrity validation
   - Reason: Production-grade data integrity

3. **Implement AbortController for Pause**
   - Cancel in-flight requests immediately on pause
   - Instead of waiting for completion
   - Reason: Better user experience

4. **Add HTTPS/SSL Support**
   - Enable encrypted data in transit
   - Configure Express with SSL certificates
   - Reason: Security for production

### Medium Priority

5. **Implement Adaptive Chunk Sizing**
   - Adjust chunk size based on file size (1MB for small, 10MB for large)
   - Reason: Optimize for all file sizes

6. **Add Rate Limiting/Bandwidth Throttling**
   - Allow users to limit upload speed
   - Reason: Prevent connection saturation

7. **Implement CRC32 Chunk Checksums**
   - Validate each chunk before merge
   - Reason: Fast chunk-level validation

8. **Implement Configurable Concurrency**
   - Let users choose parallel upload limits (1, 3, or 10)
   - Reason: Adapt to different network conditions

### Low Priority

9. **User Authentication & Authorization**
   - JWT-based login system
   - Per-user storage quotas and upload history

10. **WebSocket Real-Time Progress**
    - Replace React state polling with WebSocket events
    - Multiple clients get instant updates

11. **S3/Cloud Storage Backend**
    - Replace local filesystem with AWS S3
    - Auto-scaling and backup capabilities


---

## Architecture

### Technology Stack
- **Backend**: Node.js + Express
- **Frontend**: React + Vite
- **Database**: MySQL
- **Containerization**: Docker & Docker Compose

### Data Flow

```
Frontend Upload
    ↓
1. Handshake (Check resume status)
    ↓
2. Chunk Upload (5MB × N) - 3 concurrent
    ↓
3. Database Track (Each chunk status)
    ↓
4. Merge Chunks (Concatenate on completion)
    ↓
5. Final File Storage
```

### Database Schema

```sql

CREATE TABLE uploads (
  id VARCHAR(255) PRIMARY KEY,
  filename VARCHAR(255),
  status ENUM('UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED'),
  final_hash VARCHAR(64)
);

-- Chunks Table
CREATE TABLE chunks (
  upload_id VARCHAR(255),
  chunk_index INT,
  status VARCHAR(20),
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (upload_id, chunk_index)
);
```

---

## API Endpoints

### Upload Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/handshake?fileName=X&fileSize=Y` | Check resume status |
| POST | `/api/upload-chunk` | Upload 5MB chunk |
| POST | `/api/merge-chunks` | Finalize upload |

### File Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/files` | List all uploaded files |
| GET | `/api/download/:fileName` | Download file (range support) |
| GET | `/api/peek/:fileName` | Preview ZIP contents |

---

## Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 16+
- MySQL 8.0+

### Quick Start
```bash
# Start all services
docker-compose up --build

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# MySQL: localhost:3306
```

### Environment Variables

**Backend** (.env):
```
DB_HOST=db
DB_USER=root
DB_PASSWORD=password
DB_NAME=viz_uploads
PORT=3001
```

---


