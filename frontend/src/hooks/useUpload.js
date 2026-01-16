import { useState, useRef } from 'react';
import { uploadApi } from '../api/uploadApi';

const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks
const CONCURRENCY_LIMIT = 3;

const waitForOnline = () => {
  if (navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('online', resolve, { once: true });
  });
};

export function useUpload(onSuccess) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMap, setStatusMap] = useState({});
  const [metrics, setMetrics] = useState({ speed: 0, eta: 0 });
  const uploadStartTime = useRef(null);

  const updateProgress = (currentMap, totalChunks) => {
    const successCount = Object.values(currentMap).filter(v => v === 'SUCCESS').length;
    const percent = Math.round((successCount / totalChunks) * 100);
    setProgress(percent);

    const elapsed = (Date.now() - uploadStartTime.current) / 1000;
    const speed = (successCount * CHUNK_SIZE) / elapsed / (1024 * 1024);
    const eta = speed > 0 ? ((totalChunks - successCount) * CHUNK_SIZE) / (speed * 1024 * 1024) : 0;
    setMetrics({ speed: speed.toFixed(1), eta: Math.ceil(eta) });
  };

  const uploadChunk = async (file, index, uploadId, totalChunks, retry = 0) => {
    const start = index * CHUNK_SIZE;
    const chunk = file.slice(start, start + CHUNK_SIZE);
    setStatusMap(prev => ({ ...prev, [index]: 'UPLOADING' }));

    try {
      await uploadApi.uploadChunk(chunk, { 
        'x-upload-id': uploadId, 
        'x-chunk-index': index, 
        'x-offset': start 
      });
      setStatusMap(prev => {
        const newMap = { ...prev, [index]: 'SUCCESS' };
        updateProgress(newMap, totalChunks);
        return newMap;
      });
    } catch (err) {
      if (!navigator.onLine) {
        await waitForOnline();
        return uploadChunk(file, index, uploadId, totalChunks, retry);
      }
      if (retry < 3) return uploadChunk(file, index, uploadId, totalChunks, retry + 1);
      setStatusMap(prev => ({ ...prev, [index]: 'ERROR' }));
      throw err;
    }
  };

  const startUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setProgress(0);
    uploadStartTime.current = Date.now();
    
    try {
      const { data } = await uploadApi.handshake(file.name, file.size);
      const { uploadId, uploadedChunks } = data;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      const initialMap = {};
      const queue = [];
      for (let i = 0; i < totalChunks; i++) {
        const done = uploadedChunks.includes(i);
        initialMap[i] = done ? 'SUCCESS' : 'PENDING';
        if (!done) queue.push(i);
      }
      
      setStatusMap(initialMap);

      const processQueue = async () => {
        while (queue.length > 0) {
          if (!navigator.onLine) await waitForOnline();
          const index = queue.shift();
          try {
            await uploadChunk(file, index, uploadId, totalChunks);
          } catch (err) {
            queue.unshift(index); 
            await waitForOnline();
          }
        }
      };

      await Promise.all(Array(Math.min(CONCURRENCY_LIMIT, queue.length)).fill().map(processQueue));
      await uploadApi.mergeChunks({ uploadId, totalChunks, fileName: file.name });

      setIsUploading(false);
      onSuccess();
    } catch (err) {
      setIsUploading(false);
    }
  };

  return { startUpload, isUploading, progress, statusMap, metrics };
}