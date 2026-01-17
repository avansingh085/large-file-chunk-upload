import React from 'react';
import { CloudUpload, Pause, Play } from 'lucide-react';

export default function UploadCard({ 
  file, setFile, onUpload, isUploading, progress, statusMap, metrics, isPaused, togglePause 
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 relative">
      {isPaused && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-orange-100 text-orange-600 text-[10px] font-bold rounded uppercase tracking-wider">
          Paused
        </div>
      )}

      {!isUploading ? (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-blue-500 cursor-pointer"
          onClick={() => document.getElementById('fileInput').click()}
        >
          <CloudUpload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-gray-600">Click to select file</p>
          <input id="fileInput" type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
          {file && <p className="mt-2 text-blue-600 text-sm font-medium">{file.name}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">
              {isPaused ? "Upload Paused" : "Uploading..."}
            </span>
            
            <button 
              type="button"
              onClick={togglePause}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                isPaused ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {isPaused ? <><Play size={12} fill="currentColor"/> Resume</> : <><Pause size={12} fill="currentColor"/> Pause</>}
            </button>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${isPaused ? 'bg-orange-400' : 'bg-blue-600'}`} 
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>SPEED: {isPaused ? '0.0' : metrics.speed} MB/s</span>
            <span>PROGRESS: {progress}%</span>
            <span>ETA: {isPaused ? '--' : metrics.eta}s</span>
          </div>

          <div className="grid grid-cols-10 gap-1 mt-2">
            {Object.values(statusMap).map((status, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full ${
                  status === 'SUCCESS' ? 'bg-green-500' : 
                  status === 'UPLOADING' ? 'bg-blue-400 animate-pulse' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {!isUploading && file && (
        <button 
          onClick={onUpload}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700"
        >
          Start Upload
        </button>
      )}
    </div>
  );
}