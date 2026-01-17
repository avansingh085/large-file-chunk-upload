import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

export const uploadApi = {
  // 1. Fetch list of files from server
  getFiles: () => api.get('/files'),

  // 2. Updated Handshake: Now includes totalChunks and finalHash
  handshake: (fileName, fileSize, totalChunks, finalHash) => 
    api.get('/handshake', { 
      params: { fileName, fileSize, totalChunks, finalHash } 
    }),

  // 3. Upload Chunk: Ensures binary data handling
  uploadChunk: (chunk, headers) => 
    api.post('/upload-chunk', chunk, { 
      headers: {
        ...headers,
        'Content-Type': 'application/octet-stream'
      } 
    }),

  // 4. Merge Chunks: Payload includes uploadId and fileName
  mergeChunks: (payload) => api.post('/merge-chunks', payload),

  // 5. Download URL
  getDownloadUrl: (fileName) => `http://localhost:3001/api/download/${fileName}`,

  // 6. Peek inside ZIP files
  peekZip: (fileName) => api.get(`/peek/${fileName}`), 
};