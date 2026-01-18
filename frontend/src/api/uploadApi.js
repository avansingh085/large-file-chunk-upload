import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

export const uploadApi = {
  
  getFiles: () => api.get('/files'),

  handshake: (fileName, fileSize, totalChunks, finalHash) => 
    api.get('/handshake', { 
      params: { fileName, fileSize, totalChunks, finalHash } 
    }),

  uploadChunk: (chunk, headers) => 
    api.post('/upload-chunk', chunk, { 
      headers: {
        ...headers,
        'Content-Type': 'application/octet-stream'
      } 
    }),

  mergeChunks: (payload) => api.post('/merge-chunks', payload),

  getDownloadUrl: (fileName) => `http://localhost:3001/api/download/${fileName}`,

  peekZip: (fileName) => api.get(`/peek/${fileName}`), 
};