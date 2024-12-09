declare global {
  interface Window {
      electronAPI: {
          uploadFile: (filename: string, content: Buffer) => Promise<{ success: boolean; filePath?: string; error?: string }>;
          downloadFile: (filename: string) => Promise<{ success: boolean; content?: Buffer; error?: string }>;
          deleteFile: (filename: string) => Promise<{ success: boolean; error?: string }>;
          uploadFolder: (folderPath: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
          readFileContent: (filePath: string) => Promise<{ success: boolean; content?: Buffer; error?: string }>;
          searchDocuments: (query: string) => Promise<{ success: boolean; results?: string; error?: string }>;
          openFolderDialog: () => Promise<string | undefined>;
          onFilesChanged: (callback: () => void) => () => void;
          watchFiles: () => Promise<{ success: boolean }>;
      }
  }
}

// src/App.tsx
import { useState, useEffect } from 'react';
import { Upload, Download, Trash2, File, Folder, ChevronLeft, Search } from 'lucide-react';
import { Buffer } from 'buffer';
import { FolderUp } from 'lucide-react';
import AISidePanel from '../components/AISidePanel';

// Utility functions for path operations in browser
const path = {
  join: (...parts: string[]) => {
    return parts
      .map(part => part.trim().replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
  },
  dirname: (path: string) => {
    const trimmedPath = path.trim().replace(/\\/g, '/');
    const parts = trimmedPath.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }
};

export default function App() {
  const [status, setStatus] = useState<string>('');
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const API_URL = 'http://127.0.0.1:8000';

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const encodedPath = encodeURIComponent(currentPath);
      console.log('Fetching files for path:', currentPath);
      const response = await fetch(`${API_URL}/files?path=${encodedPath}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received files:', data);
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
}, [currentPath]);

const handleSearch = async () => {
  if (!searchQuery.trim()) return;
  
  setIsSearching(true);
  try {
    const result = await window.electronAPI.searchDocuments(searchQuery);
    
    if (result.success && result.results) {
      setSearchResults(result.results);
    } else if (result.error) {
      setStatus(`Search error: ${result.error}`);
    }
  } catch (error) {
    setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsSearching(false);
  }
};

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
          // Normalize the base path to use forward slashes
          const basePath = selected.replace(/\\/g, '/');
          console.log('Base path:', basePath);
          
          for (const filePath of result.files) {
            // Normalize the file path to use forward slashes
            const normalizedFilePath = filePath.replace(/\\/g, '/');
            console.log('Processing file:', normalizedFilePath);
            
            const fileContent = await window.electronAPI.readFileContent(filePath);
            if (!fileContent.success || !fileContent.content) {
              console.log('Failed to read file:', normalizedFilePath);
              continue;
            }
  
            // Calculate relative path from base folder
            const relativePath = normalizedFilePath
              .replace(basePath, '')
              .replace(/^\/+/, ''); // Remove leading slashes
            console.log('Relative path:', relativePath);
            
            // Construct upload path
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

  // Navigation functions
  const navigateToFolder = (folderName: string) => {
    // Remove trailing slash if present
    const cleanFolderName = folderName.replace(/\/$/, '');
    const newPath = currentPath 
      ? path.join(currentPath, cleanFolderName)
      : cleanFolderName;
    console.log('Navigating to:', newPath);
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    const newPath = currentPath.includes('/') 
      ? path.dirname(currentPath)
      : '';
    console.log('Navigating up to:', newPath);
    setCurrentPath(newPath);
  };

  return (
<div className="min-h-screen bg-[#022e34] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">VDR Desktop by YODY</h1>
        
        {/* Search Section */}
        <div className="mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ask anything about your documents..."
                className="w-full bg-white bg-opacity-10 rounded-lg px-4 py-3 pr-12
                          placeholder-white placeholder-opacity-50 focus:outline-none
                          focus:ring-2 focus:ring-white focus:ring-opacity-20"
              />
              <Search 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-opacity-60"
                size={20}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-white bg-opacity-10 hover:bg-opacity-20 px-6 rounded-lg
                       transition-all duration-300 flex items-center justify-center
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 p-4 bg-white bg-opacity-5 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">AI Assistant Response:</h3>
                <p className="text-white text-opacity-90">{searchResults}</p>
            </div>
          )}
        </div>

        {/* Upload buttons */}
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

        {/* File list */}
        <div className="space-y-4">
          {files.length === 0 ? (
            <div className="text-center text-white text-opacity-60 p-8">
              No files uploaded yet
            </div>
          ) : (
            files.map((entry) => {
              const isFolder = entry.endsWith('/');
              const trimmedEntry = isFolder ? entry.slice(0, -1) : entry; // Remove trailing slash for folders
              const displayEntry =
                trimmedEntry.length > 60 ? `${trimmedEntry.slice(0, 60)}...` : trimmedEntry;

              return (
                <div
                  key={entry}
                  className="bg-white bg-opacity-5 rounded-lg p-4
                       hover:bg-opacity-10 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center space-x-3 cursor-pointer"
                      onClick={() => {
                        if (isFolder) {
                          navigateToFolder(entry.slice(0, -1)); // Remove the trailing slash when navigating
                        }
                      }}
                      title={trimmedEntry} // Tooltip displaying full name
                    >
                      {isFolder ? (
                        <Folder size={20} className="text-white text-opacity-60" />
                      ) : (
                        <File size={20} className="text-white text-opacity-60" />
                      )}
                      <span className="truncate">{displayEntry}</span>
                    </div>
                    {!isFolder && (
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
              );
            })
          )}
        </div>
      </div>
      <AISidePanel 
    files={files}
    currentPath={currentPath}
    onFileSelect={(filename) => {
      // Handle file selection - could navigate to it or download it
      if (!filename.endsWith('/')) {
        handleDownload(filename);
      } else {
        navigateToFolder(filename);
      }
    }}
  />
    </div>
  );
}