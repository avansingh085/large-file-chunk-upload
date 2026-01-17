import { useState, useRef } from 'react';
import { uploadApi } from '../api/uploadApi';

const CHUNK_SIZE = 1024 * 1024 * 5;
const CONCURRENCY_LIMIT = 3;

export function useUpload(onSuccess) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMap, setStatusMap] = useState({});
  const [metrics, setMetrics] = useState({ speed: 0, eta: 0 });

  const uploadStartTime = useRef(null);
  const pauseRef = useRef(false);

  const calculateHash = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  };

  const updateProgress = (currentMap, totalChunks) => {
    const successCount = Object.values(currentMap).filter(v => v === 'SUCCESS').length;
    const percent = Math.round((successCount / totalChunks) * 100);
    setProgress(percent);

    const elapsed = (Date.now() - uploadStartTime.current) / 1000;
    const bytesUploaded = successCount * CHUNK_SIZE;
    const speed = elapsed > 0 ? bytesUploaded / elapsed / (1024 * 1024) : 0;
    const remainingBytes = (totalChunks - successCount) * CHUNK_SIZE;
    const eta = speed > 0 ? remainingBytes / (speed * 1024 * 1024) : 0;
    setMetrics({ speed: speed.toFixed(1), eta: Math.ceil(eta) });
  };

  const startUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setIsPaused(false);
    pauseRef.current = false;
    uploadStartTime.current = Date.now();

    try {

      const finalHash = await calculateHash(file);
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      const { data } = await uploadApi.handshake(file.name, file.size, totalChunks, finalHash);
      const { uploadId, uploadedChunks } = data;

      let queue = [];
      const initialMap = {};
      for (let i = 0; i < totalChunks; i++) {
        const done = uploadedChunks.includes(i);
        initialMap[i] = done ? 'SUCCESS' : 'PENDING';
        if (!done) queue.push(i);
      }
      setStatusMap(initialMap);

      const processQueue = async () => {
        while (true) {
          if (pauseRef.current) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          if (queue.length === 0) break;

          const index = queue.shift();
          if (index === undefined) break;

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
            console.error(`Chunk ${index} upload failed:`, err);
            queue.push(index);
            setStatusMap(prev => ({ ...prev, [index]: 'FAILED' }));
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      };

      const concurrentWorkers = Math.min(CONCURRENCY_LIMIT, totalChunks);
      await Promise.all(
        Array.from({ length: concurrentWorkers }).map(() => processQueue())
      );

      await uploadApi.mergeChunks({ uploadId, fileName: file.name });

      setIsUploading(false);
      onSuccess?.();
    } catch (err) {
      console.error("Upload failed:", err);
      setIsUploading(false);
      alert("Integrity check or network error occurred.");
    }
  };

  return { startUpload, togglePause, isPaused, isUploading, progress, statusMap, metrics };
}