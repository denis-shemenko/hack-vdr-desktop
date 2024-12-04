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
import { Upload, Download, Trash2, File, Folder, ChevronLeft } from 'lucide-react';
import { Buffer } from 'buffer';
import { FolderUp } from 'lucide-react';

// Utility functions for path operations in browser
const path = {
  join: (...parts: string[]) => {
    return parts.map(part => part.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
  },
  relative: (from: string, to: string) => {
    const fromParts = from.replace(/^\/+|\/+$/g, '').split('/');
    const toParts = to.replace(/^\/+|\/+$/g, '').split('/');
    
    while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
      fromParts.shift();
      toParts.shift();
    }
    
    return toParts.join('/');
  },
  dirname: (path: string) => {
    return path.replace(/\\/g, '/').replace(/\/[^/]*$/, '') || '.';
  }
};

export default function App() {
  const [status, setStatus] = useState<string>('');
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const API_URL = 'http://127.0.0.1:8000';

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/files?path=${encodeURIComponent(currentPath)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.entries) {
        setFiles(data.entries);
      }
    } catch (error) {
      console.error('Fetch error:', error);
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
        formData.append('path', currentPath);

        const response = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        
        if (result.filename) {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const buffer = Buffer.from(uint8Array);
      
          const electronResult = await window.electronAPI.uploadFile(
            path.join(currentPath, result.filename),
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

  const handleFolderUpload = async () => {
    try {
      setIsLoading(true);
      
      const selected = await window.electronAPI.openFolderDialog();
      console.log('Selected folder:', selected);
  
      if (selected) {
        const folderName = selected.split(/[/\\]/).pop();
        console.log('Folder name:', folderName);
        
        // Get all files in the folder
        const result = await window.electronAPI.uploadFolder(selected);
        console.log('Files found:', result);
        
        if (result.success && result.files.length > 0) {
          const basePath = selected.replace(/\\/g, '/');
          console.log('Base path:', basePath);
          
          for (const filePath of result.files) {
            console.log('Processing file:', filePath);
            
            const fileContent = await window.electronAPI.readFileContent(filePath);
            console.log('File content read success:', fileContent.success);
            
            if (!fileContent.success || !fileContent.content) {
              console.log('Failed to read file:', filePath);
              continue;
            }
  
            // Calculate relative path from base folder
            const relativePath = filePath.replace(basePath, '').replace(/^[/\\]/, '');
            console.log('Relative path:', relativePath);
            
            // Construct path starting with the selected folder name
            const uploadPath = `${folderName}/${relativePath}`;
            console.log('Upload path:', uploadPath);
            
            const formData = new FormData();
            const blob = new Blob([fileContent.content], { type: 'application/octet-stream' });
            formData.append('file', blob, uploadPath);
  
            const response = await fetch(`${API_URL}/upload`, {
              method: 'POST',
              body: formData
            });
            const responseData = await response.json();
            console.log('Upload response:', responseData);
          }
  
          setStatus(`Folder uploaded successfully`);
          await fetchFiles();
        } else {
          setStatus('No files found in the selected folder');
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      setIsLoading(true);
      
      const fullPath = path.join(currentPath, filename);
      const response = await fetch(`${API_URL}/download/${encodeURIComponent(fullPath)}`);
      const blob = await response.blob();
      
      const electronResult = await window.electronAPI.downloadFile(fullPath);
      
      if (electronResult.success) {
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
      const fullPath = path.join(currentPath, filename);
      const response = await fetch(`${API_URL}/delete/${encodeURIComponent(fullPath)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      await window.electronAPI.deleteFile(fullPath);
      
      setStatus(result.message || 'File deleted successfully');
      await fetchFiles();
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folderName: string) => {
    setCurrentPath(path.join(currentPath, folderName));
  };

  const navigateUp = () => {
    setCurrentPath(path.dirname(currentPath));
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
            className="w-full bg-white bg-opacity-10 hover:bg-opacity-20 
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

        {/* Path navigation */}
        <div className="mb-4 flex items-center space-x-2 text-sm text-white text-opacity-60">
          {currentPath && (
            <button
              onClick={navigateUp}
              className="p-1 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all duration-300"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span>{currentPath || 'Root'}</span>
        </div>

        <div className="space-y-4">
          {files.length === 0 ? (
            <div className="text-center text-white text-opacity-60 p-8">
              No files uploaded yet
            </div>
          ) : (
            files.map((entry) => (
              <div 
                key={entry}
                className="bg-white bg-opacity-5 rounded-lg p-4
                         hover:bg-opacity-10 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center space-x-3 cursor-pointer"
                    onClick={() => {
                      if (entry.endsWith('/')) {
                        navigateToFolder(entry.slice(0, -1));
                      }
                    }}
                  >
                    {entry.endsWith('/') ? (
                      <Folder size={20} className="text-white text-opacity-60" />
                    ) : (
                      <File size={20} className="text-white text-opacity-60" />
                    )}
                    <span className="truncate">{entry.endsWith('/') ? entry.slice(0, -1) : entry}</span>
                  </div>
                  {!entry.endsWith('/') && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownload(entry)}
                        disabled={isLoading}
                        className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg
                                 transition-all duration-300
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        disabled={isLoading}
                        className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg
                                 transition-all duration-300 text-red-400
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}