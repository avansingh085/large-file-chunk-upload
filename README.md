# Cloud Uploader - File Upload & Download Application

A full-stack web application for uploading, managing, and downloading files with chunked upload support, offline capability, and Docker containerization.

## Project Overview

**Cloud Uploader** is a modern web application built with React (frontend) and Node.js/Express (backend) that allows users to:
- Upload large files with chunked upload support
- View uploaded files with metadata
- Download and preview files
- Work offline with automatic synchronization
- Manage files through a clean, intuitive UI

---

## Architecture

### Directory Structure

```
Uploaders/
├── docker-compose.yml          # Docker orchestration for all services
├── backend/                     # Node.js/Express backend
│   ├── Dockerfile              # Backend Docker image configuration
│   ├── package.json            # Backend dependencies
│   ├── server.js               # Main Express server
│   └── src/
│       ├── config/
│       │   └── db.js           # MySQL database configuration
│       ├── controllers/
│       │   └── uploadController.js   # Upload logic & handlers
│       ├── routes/
│       │   └── uploadRoutes.js       # API route definitions
│       └── utils/              # Utility functions
└── frontend/                    # React/Vite frontend
    ├── Dockerfile              # Frontend Docker image configuration
    ├── package.json            # Frontend dependencies
    ├── vite.config.js          # Vite bundler configuration
    ├── eslint.config.js        # ESLint rules
    ├── index.html              # HTML entry point
    └── src/
        ├── App.jsx             # Main React component
        ├── main.jsx            # React DOM entry point
        ├── App.css             # Main stylesheet
        ├── index.css           # Global styles
        ├── api/
        │   └── uploadApi.js    # API client for backend communication
        ├── components/
        │   ├── UploadCard.jsx  # File upload component
        │   └── FileList.jsx    # Display list of uploaded files
        └── hooks/
            └── useUpload.js    # Custom hook for upload logic
```

---

## Backend Details

### Technology Stack
- **Runtime:** Node.js
- **Framework:** Express.js v5.2.1
- **Database:** MySQL 8
- **File Handling:** Multer v2.0.2, unzipper v0.12.3
- **CORS:** Enabled for frontend communication

### Key Features
1. **Chunked Upload** - Split large files into manageable chunks
2. **Merge Functionality** - Reassemble chunks into complete files
3. **File Management** - List, download, and preview files
4. **ZIP Preview** - Peek into ZIP files without extraction
5. **Automatic Cleanup** - Orphaned files removed every 12 hours
6. **Database Persistence** - File metadata stored in MySQL

### Environment Variables
```env
DB_HOST=db              # Database host (Docker service name)
DB_USER=root            # Database user
DB_PASSWORD=password    # Database password
DB_NAME=viz_uploads     # Database name
PORT=3001               # Backend server port
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/handshake` | Health check endpoint |
| POST | `/api/upload-chunk` | Upload a file chunk |
| POST | `/api/merge-chunks` | Merge uploaded chunks |
| GET | `/api/files` | List all uploaded files |
| GET | `/api/peek/:fileName` | Preview ZIP file contents |
| GET | `/api/download/:fileName` | Download a file |

### Important Files

**[server.js](backend/server.js)** - Main server entry point
- Initializes Express app
- Sets up CORS middleware
- Creates uploads directory
- Schedules cleanup task (every 12 hours)
- Initializes database connection

**[db.js](backend/src/config/db.js)** - Database configuration
- Establishes MySQL connection
- Initializes database schema
- Handles connection pooling

**[uploadController.js](backend/src/controllers/uploadController.js)** - Core upload logic
- `uploadChunk()` - Handles individual chunk uploads
- `mergeChunks()` - Combines chunks into final file
- `listFiles()` - Retrieves file metadata
- `peekZip()` - Previews ZIP contents
- `downloadFile()` - Serves files for download
- `cleanupOrphanedUploads()` - Removes incomplete uploads

**[uploadRoutes.js](backend/src/routes/uploadRoutes.js)** - API route definitions
- Maps HTTP requests to controller methods
- Configures middleware for each route

---

## Frontend Details

### Technology Stack
- **Framework:** React 19.2.0
- **Build Tool:** Vite 7.2.4
- **Styling:** Tailwind CSS 4.1.18
- **HTTP Client:** Axios 1.13.2
- **Icons:** Lucide React 0.562.0
- **Package Manager:** npm

### Key Features
1. **Drag & Drop Upload** - Intuitive file selection
2. **Real-time Progress** - Visual upload progress indicators
3. **Chunked Uploads** - Handles large files efficiently
4. **Offline Support** - Works offline with automatic sync on reconnect
5. **Responsive Design** - Mobile-friendly UI with Tailwind CSS
6. **File Preview** - Download and preview uploaded files

### Important Files

**[App.jsx](frontend/src/App.jsx)** - Main React component
- Manages application state
- Handles online/offline status
- Fetches and displays uploaded files
- Integrates upload and file list components

**[uploadApi.js](frontend/src/api/uploadApi.js)** - API client
- Axios instance for backend communication
- Methods for chunked uploads
- File listing and download endpoints
- Error handling and retries

**[useUpload.js](frontend/src/hooks/useUpload.js)** - Custom upload hook
- Manages upload state (progress, status, metrics)
- Splits files into chunks
- Handles chunk upload logic
- Tracks upload performance

**[UploadCard.jsx](frontend/src/components/UploadCard.jsx)** - Upload component
- File input and drag-drop interface
- Real-time progress display
- Status messages and error handling
- Upload metrics visualization

**[FileList.jsx](frontend/src/components/FileList.jsx)** - File display component
- Lists uploaded files with metadata
- Download buttons
- File size and date information

---

## Database Schema

### MySQL Database: `viz_uploads`

**files table**
| Column | Type | Description |
|--------|------|-------------|
| id | INT PRIMARY KEY | Unique file identifier |
| filename | VARCHAR(255) | Name of the uploaded file |
| original_name | VARCHAR(255) | Original file name from upload |
| file_size | BIGINT | File size in bytes |
| upload_date | TIMESTAMP | When file was uploaded |
| status | VARCHAR(50) | Upload status (complete/pending) |
| path | VARCHAR(255) | Server file path |

---

## Setup & Installation

### Prerequisites
- **Docker & Docker Compose** (recommended)
- **Node.js 16+** and npm (for local development)
- **MySQL 8** (if running without Docker)
- **Git**

### Option 1: Docker Compose (Recommended)

1. **Clone or navigate to the project directory:**
   ```bash
   cd Uploaders
   ```

2. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - MySQL: localhost:3306

4. **Stop services:**
   ```bash
   docker-compose down
   ```


### Upload Flow

1. **User selects a file** via drag-drop or file input in UploadCard
2. **File is split into chunks** (default size defined in useUpload hook)
3. **Each chunk is uploaded** to `/api/upload-chunk` endpoint
4. **Progress is tracked** with real-time updates
5. **After all chunks uploaded**, merge request sent to `/api/merge-chunks`
6. **Server reassembles chunks** into complete file
7. **Metadata stored in MySQL** database
8. **File listed** in FileList component

### Chunked Upload Benefits
-  Handles large files (> 100MB)
-  Resume capability (only failed chunks need re-upload)
-  Better bandwidth utilization
-  Server stability

### Offline Functionality
- User actions queued when offline
- Automatic sync when connection restored
- Status indicators show online/offline state
- Prevents data loss

---


### Adding New Routes

1. Create controller method in `backend/src/controllers/uploadController.js`
2. Add route in `backend/src/routes/uploadRoutes.js`
3. Call API method from `frontend/src/api/uploadApi.js`





### CORS Errors
- Verify frontend URL in backend `cors()` middleware (currently `http://localhost:3000`)
- Check backend is accessible from frontend

### Upload Failures
- Check backend `/api/handshake` endpoint responds
- Verify `uploads/` directory exists and is writable
- Check MySQL for file records

---

## Performance Optimization

### Frontend
- Images lazy-loaded with Lucide React
- CSS optimized with Tailwind purging
- Vite provides fast HMR during development

### Backend
- Connection pooling for MySQL
- Cleanup task removes orphaned files
- Chunked uploads reduce memory usage
- CORS pre-flight requests cached

### Database
- Indexed filename for fast lookups
- Optimized queries in controllers

---

## Security Considerations

### Current Implementation
-  CORS enabled for localhost
-  File uploads validated
-  Database credentials in environment variables

### Recommended Enhancements
- [ ] Add authentication (JWT tokens)
- [ ] Validate file types and sizes
- [ ] Implement rate limiting
- [ ] Add HTTPS/TLS in production
- [ ] Use environment-specific CORS settings
- [ ] Sanitize file names

---

## Deployment

### Docker Deployment
```bash
# Build production images
docker-compose -f docker-compose.yml build

# Push to registry
docker tag uploaders-frontend:latest your-registry/uploaders-frontend:latest
docker push your-registry/uploaders-frontend:latest
```

### Environment Variables (Production)
Update in `docker-compose.yml`:
```yaml
environment:
  - DB_PASSWORD=secure_password
  - NODE_ENV=production
```

---



