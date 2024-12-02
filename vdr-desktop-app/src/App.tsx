import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface FileInfo {
  name: string;
  path: string;
}

export default function App() {
  const [status, setStatus] = useState<string>('');
  const [files, setFiles] = useState<string[]>([]);
  const API_URL = 'http://127.0.0.1:8000';

  // Fetch file list from backend
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
      // Open file selector using Tauri
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'All Files',
          extensions: ['*']
        }]
      });

      if (selected && typeof selected === 'string') {
        // Read file using Tauri
        const fileContent = await invoke('read_file', { 
          filePath: selected 
        });

        // Create form data for upload
        const fileName = selected.split('\\').pop()?.split('/').pop();
        const formData = new FormData();
        const blob = new Blob([fileContent as BlobPart], { 
          type: 'application/octet-stream' 
        });
        formData.append('file', blob, fileName);

        // Upload to FastAPI
        const response = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        setStatus(`Upload success: ${result.filename}`);
        fetchFiles(); // Refresh file list
      }
    } catch (error) {
      setStatus(`Error: ${error}`);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const response = await fetch(`${API_URL}/download/${filename}`);
      const blob = await response.blob();
      
      // Create download link
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
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      const response = await fetch(`${API_URL}/delete/${filename}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      setStatus(result.message);
      fetchFiles(); // Refresh file list
    } catch (error) {
      setStatus(`Error: ${error}`);
    }
  };

  return (
    <div className="container p-4">
      <h1 className="text-2xl font-bold mb-4">VDR Desktop - YODY</h1>
      
      <button 
        onClick={handleUpload}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
      >
        Upload File
      </button>

      <div className="mb-4 text-sm text-gray-600">{status}</div>

      <div className="border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-3">Files</h2>
        {files.length === 0 ? (
          <p className="text-gray-500">No files uploaded yet</p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file} className="flex items-center justify-between border-b pb-2">
                <span>{file}</span>
                <div className="space-x-2">
                  <button
                    onClick={() => handleDownload(file)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(file)}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}