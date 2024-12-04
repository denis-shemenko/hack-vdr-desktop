declare global {
  interface Window {
      electronAPI: {
          uploadFile: (filename: string, content: Buffer) => Promise<{ success: boolean; filePath?: string; error?: string }>;
          downloadFile: (filename: string) => Promise<{ success: boolean; content?: Buffer; error?: string }>;
          deleteFile: (filename: string) => Promise<{ success: boolean; error?: string }>;
          uploadFolder: (folderPath: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
          readFileContent: (filePath: string) => Promise<{ success: boolean; content?: Buffer; error?: string }>;
          openFolderDialog: () => Promise<string | undefined>;
          onFilesChanged: (callback: () => void) => () => void;
          watchFiles: () => Promise<{ success: boolean }>;
      }
  }
}

// src/App.tsx
import { useState, useEffect } from 'react';
import { Upload, Download, Trash2, File } from 'lucide-react';
import { Buffer } from 'buffer';
import { FolderUp } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<string>('');
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const API_URL = 'http://127.0.0.1:8000';

  const fetchFiles = async () => {
    try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/files`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.files) {
            setFiles(data.files);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        // Don't show the error to user if it's just a refresh attempt
        if (!files.length) {
            setStatus(`Error fetching files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } finally {
        setIsLoading(false);
    }
};

// Add polling for file updates
useEffect(() => {
  // Fetch files immediately when component mounts
  fetchFiles();

  // Start watching files
  window.electronAPI.watchFiles();

  let timeoutId: NodeJS.Timeout;

  // Setup listener for file changes with debounce
  const removeListener = window.electronAPI.onFilesChanged(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fetchFiles();
    }, 500); // 500ms debounce
  });

  // Cleanup listener when component unmounts
  return () => {
      clearTimeout(timeoutId);
      removeListener();
  };
}, []);

  // Modify handleUpload to ensure refresh after successful upload
const handleUpload = async () => {
  try {
      setIsLoading(true);
      
      const input = document.createElement('input');
      input.type = 'file';
      
      input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(`${API_URL}/upload`, {
              method: 'POST',
              body: formData,
          });

          const result = await response.json();
          
          if (result.filename) {
            // Convert file to Uint8Array first
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Then create Buffer from it
            const buffer = Buffer.from(uint8Array);
        
            const electronResult = await window.electronAPI.uploadFile(
                result.filename,
                buffer
            );
            
            if (electronResult.success) {
                setStatus(`Upload success: ${result.filename}`);
                await fetchFiles();
            } else {
                setStatus(`Error registering file with desktop app: ${electronResult.error}`);
            }
        }
      };

      input.click();
      
  } catch (error) {
      setStatus(`Error: ${error}`);
  } finally {
      setIsLoading(false);
  }
};

// Update folder upload handler
const handleFolderUpload = async () => {
  try {
      setIsLoading(true);
      
      // Open folder selection dialog using Electron
      const selected = await window.electronAPI.openFolderDialog();

      if (selected) {
          // Get all files in the folder
          const result = await window.electronAPI.uploadFolder(selected);
          
          if (result.success && result.files) {
              // Upload each file to FastAPI
              const basePath = selected.replace(/\\/g, '/');
              
              for (const filePath of result.files) {
                  // Get file content
                  const fileContent = await window.electronAPI.readFileContent(filePath);
                  if (!fileContent.success || !fileContent.content) continue;

                  // Create relative path
                  const relativePath = filePath.replace(basePath, '').replace(/^[/\\]/, '');
                  
                  // Create form data
                  const formData = new FormData();
                  const file = new Blob([fileContent.content], { type: 'application/octet-stream' });
                  formData.append('files', file, relativePath);

                  // Upload to FastAPI
                  await fetch(`${API_URL}/upload-folder`, {
                      method: 'POST',
                      body: formData
                  });
              }

              setStatus(`Folder uploaded successfully`);
              await fetchFiles();
          }
      }
  } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
      setIsLoading(false);
  }
};

  const handleDownload = async (filename: string) => {
    try {
      setIsLoading(true);
      
      // First, get file from FastAPI server
      const response = await fetch(`${API_URL}/download/${filename}`);
      const blob = await response.blob();
      
      // Then handle with Electron
      const electronResult = await window.electronAPI.downloadFile(filename);
      
      if (electronResult.success) {
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
      } else {
        setStatus(`Error downloading file: ${electronResult.error}`);
      }
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

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Only notify Electron after successful FastAPI deletion
        await window.electronAPI.deleteFile(filename);
        
        setStatus(result.message || 'File deleted successfully');
        await fetchFiles(); // Refresh the file list

    } catch (error) {
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsLoading(false);
    }
};

  return (
    <div className="min-h-screen bg-[#022e34] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">VDR Desktop by YODY</h1>
        
        <div className="mb-4 flex gap-4">
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
          <button 
                    onClick={handleFolderUpload}
                    disabled={isLoading}
                    className="flex-1 bg-white bg-opacity-10 hover:bg-opacity-20 
                             transition-all duration-300 rounded-lg p-6 
                             flex items-center justify-center space-x-2
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FolderUp size={24} />
                    <span>Upload Folder</span>
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