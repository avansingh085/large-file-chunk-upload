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

  const { 
    startUpload, isUploading, progress, 
    statusMap, metrics, isPaused, togglePause 
  } = useUpload(() => {
    setFile(null);
    fetchFiles(); 
  });

  useEffect(() => {
    fetchFiles();
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        {!isOnline && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center font-bold">
            Network Disconnected
          </div>
        )}

        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Cloud Uploader</h1>
        </header>

        <UploadCard 
          file={file} setFile={setFile}
          onUpload={() => startUpload(file)}
          isUploading={isUploading} progress={progress}
          statusMap={statusMap} metrics={metrics}
          isPaused={isPaused} togglePause={togglePause}
        />

        <FileList files={uploadedFiles} />
      </div>
    </div>
  );
}