import React, { useState, useEffect } from 'react';
import { uploadApi } from './api/uploadApi';
import { useUpload } from './hooks/useUpload';
import UploadCard from './components/UploadCard';
import FileList from './components/FileList';

export default function App() {
  const [file, setFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const fetchFiles = async () => {
    try {
      const { data } = await uploadApi.getFiles();
      setUploadedFiles(data.files || []);
    } catch (err) {
      console.error("Fetch failed");
    }
  };

  const { startUpload, isUploading, progress, statusMap, metrics } = useUpload(() => {
    setFile(null);
    fetchFiles();
  });

  useEffect(() => {
    fetchFiles();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-3xl mx-auto">
        {!isOnline && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center font-medium animate-bounce border border-red-200">
            You are currently offline. Actions will resume when connected.
          </div>
        )}

        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Cloud Uploader</h1>
        </header>

        <UploadCard 
          file={file}
          setFile={setFile}
          onUpload={() => startUpload(file)}
          isUploading={isUploading}
          progress={progress}
          statusMap={statusMap}
          metrics={metrics}
          isOnline={isOnline}
        />

        <FileList files={uploadedFiles} />
      </div>
    </div>
  );
}