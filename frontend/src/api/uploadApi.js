import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });
export const uploadApi = {
  getFiles: () => api.get('/files'),
  handshake: (fileName, fileSize) => api.get('/handshake', { params: { fileName, fileSize } }),
  uploadChunk: (chunk, headers) => api.post('/upload-chunk', chunk, { headers }),
  mergeChunks: (payload) => api.post('/merge-chunks', payload),
  getDownloadUrl: (fileName) => `http://localhost:3001/api/download/${fileName}`,
  peekZip: (fileName) => api.get(`/peek/${fileName}`), 
};