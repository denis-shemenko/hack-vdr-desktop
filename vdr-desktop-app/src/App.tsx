import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Upload, Download, Trash2, File } from 'lucide-react';
import { readFile } from '@tauri-apps/plugin-fs';

export default function App() {
  const [status, setStatus] = useState<string>('');
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const API_URL = 'http://127.0.0.1:8000';

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${API_URL}/files`);
      const data = await response.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (error) {
      setStatus(`Error fetching files: ${error}`);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async () => {
    try {
      setIsLoading(true);
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'All Files',
          extensions: ['*']
        }]
      });

      if (selected && typeof selected === 'string') {
        // Read file using fs plugin
        const fileContent = await readFile(selected);
        const fileName = selected.split('\\').pop()?.split('/').pop() || '';

        const formData = new FormData();
        const file = new Blob([fileContent], { type: 'application/octet-stream' });
        formData.append('file', file, fileName);

        const response = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        setStatus(`Upload success: ${result.filename}`);
        fetchFiles();
      }
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/download/${filename}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setStatus('Download complete');
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/delete/${filename}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      setStatus(result.message);
      fetchFiles();
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#022e34] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">VDR Desktop by YODY</h1>
        
        <div className="mb-8">
          <button 
            onClick={handleUpload}
            disabled={isLoading}
            className="w-full bg-white bg-opacity-10 hover:bg-opacity-20 
                     transition-all duration-300 rounded-lg p-6 
                     flex items-center justify-center space-x-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={24} />
            <span>Upload File</span>
          </button>
        </div>

        {status && (
          <div className="mb-6 p-4 rounded-lg bg-white bg-opacity-5 text-sm">
            {status}
          </div>
        )}

        <div className="space-y-4">
          {files.length === 0 ? (
            <div className="text-center text-white text-opacity-60 p-8">
              No files uploaded yet
            </div>
          ) : (
            files.map((file) => (
              <div 
                key={file}
                className="bg-white bg-opacity-5 rounded-lg p-4
                         hover:bg-opacity-10 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <File size={20} className="text-white text-opacity-60" />
                    <span className="truncate">{file}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={isLoading}
                      className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg
                               transition-all duration-300
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={isLoading}
                      className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg
                               transition-all duration-300 text-red-400
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}