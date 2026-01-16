import React, { useState } from 'react';
import { CheckCircle, Download, Eye, ChevronDown, ChevronUp, FileCode } from 'lucide-react';
import { uploadApi } from '../api/uploadApi';

export default function FileList({ files }) {
 
  const [expandedFile, setExpandedFile] = useState(null);
  const [zipContents, setZipContents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handlePeek = async (fileName) => {
  
    if (expandedFile === fileName) {
      setExpandedFile(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await uploadApi.peekZip(fileName);
      setZipContents(response.data.contents);
      setExpandedFile(fileName);
    } catch (err) {
      console.error("Could not peek into ZIP file.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-700">Recent Uploads</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {files.length === 0 ? (
          <li className="p-6 text-center text-gray-400 text-sm">No files uploaded yet.</li>
        ) : (
          files.map(f => {
            const isZip = f.toLowerCase().endsWith('.zip');
            const isExpanded = expandedFile === f;

            return (
              <li key={f} className="flex flex-col hover:bg-gray-50/50 transition-colors">
              
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-50 rounded-lg mr-4">
                      <CheckCircle size={20} className="text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{f}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    {isZip && (
                      <button 
                        onClick={() => handlePeek(f)}
                        disabled={isLoading}
                        className={`p-2 rounded-full transition-colors ${
                          isExpanded ? 'text-purple-600 bg-purple-50' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                        title="Peek inside ZIP"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <Eye size={18} />}
                      </button>
                    )}

                    <button 
                      onClick={() => window.open(uploadApi.getDownloadUrl(f), "_blank")}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>

                
                {isExpanded && (
                  <div className="px-16 pb-4 bg-gray-50/80 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="border-l-2 border-purple-200 pl-4 py-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Package Contents:</p>
                      <div className="grid grid-cols-1 gap-1">
                        {zipContents.length > 0 ? (
                          zipContents.map((item, idx) => (
                            <div key={idx} className="flex items-center text-sm text-gray-600">
                              <FileCode size={14} className="mr-2 text-gray-400" />
                              {item}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">Empty or unreadable archive.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}