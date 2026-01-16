import React from 'react';
import { File, CloudUpload, Loader2 } from 'lucide-react';

export default function UploadCard({ 
  file, setFile, onUpload, isUploading, progress, statusMap, metrics, isOnline 
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 relative overflow-hidden">
      {/* Offline Overlay */}
      {!isOnline && isUploading && (
        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-white p-4 rounded-xl shadow-lg border border-orange-200 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
            <p className="text-sm font-bold text-orange-600">Connection Lost: Pausing...</p>
          </div>
        </div>
      )}

      {!isUploading ? (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-blue-500 transition-colors cursor-pointer"
          onClick={() => document.getElementById('fileInput').click()}
        >
          <CloudUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium">Click or drag file to upload</p>
          <input 
            id="fileInput" 
            type="file" 
            className="hidden" 
            onChange={e => setFile(e.target.files[0])} 
          />
          {file && (
            <div className="mt-4 p-2 bg-blue-50 text-blue-700 rounded text-sm inline-flex items-center">
              <File size={16} className="mr-2" /> {file.name}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm mb-1">
            <span className={`font-medium ${isOnline ? 'text-blue-600' : 'text-gray-400'}`}>
              {isOnline ? `Uploading ${file?.name}...` : 'Upload Paused'}
            </span>
            <span className="text-gray-500 font-mono">{progress}%</span>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                isOnline ? 'bg-blue-600' : 'bg-gray-400 animate-pulse'
              }`} 
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex gap-4 text-xs text-gray-500">
            <span>Speed: {isOnline ? metrics.speed : '0.0'} MB/s</span>
            <span>ETA: {isOnline ? metrics.eta : '--'}s</span>
          </div>
          
          <div className="flex flex-wrap gap-1 mt-4">
            {Object.entries(statusMap).map(([idx, status]) => (
              <div 
                key={idx} 
                className={`h-2.5 w-2.5 rounded-sm transition-colors ${
                  status === 'SUCCESS' ? 'bg-green-500' : 
                  status === 'UPLOADING' ? 'bg-blue-400 animate-pulse' : 
                  'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {!isUploading && file && (
        <button 
          onClick={onUpload}
          disabled={!isOnline}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-all shadow-md"
        >
          {isOnline ? 'Start Upload' : 'Check Connection'}
        </button>
      )}
    </div>
  );
}