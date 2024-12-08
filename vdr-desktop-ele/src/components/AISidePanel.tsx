import { useState } from 'react';
import { Search, X, FileSearch, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface AISidePanelProps {
  files: string[];
  currentPath: string;
  onFileSelect?: (filename: string) => void;
  className?: string;
}

interface SearchResult {
  name: string;
}

const AISidePanel: React.FC<AISidePanelProps> = ({ 
  files, 
  currentPath,
  onFileSelect, 
  className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/search_assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          files: files.map(f => ({ name: f.endsWith('/') ? f.slice(0, -1) : f }))
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Server error');
      }
  
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setSummary(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async (filename: string, currentPath: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          filename, 
          currentPath: currentPath
         }),
      });
      
      const data = await response.json();
      setSummary(data.summary || '');
      setSelectedFile(filename);
    } catch (error) {
      console.error('Summary error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed right-0 top-0 h-full transition-all duration-300 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute left-0 top-8 transform -translate-x-full 
                   bg-white bg-opacity-10 hover:bg-opacity-20 
                   transition-all duration-300 rounded-l-lg p-2"
      >
        {isOpen ? <X size={24} /> : <FileSearch size={24} />}
      </button>

      {/* Main Panel */}
      <div className={`bg-white bg-opacity-5 backdrop-blur-md h-full 
                      transition-all duration-300 overflow-hidden
                      ${isOpen ? 'w-96' : 'w-0'}`}>
        <div className="p-6 h-full flex flex-col gap-6">
          <h2 className="text-xl font-semibold">AI Assistant</h2>
          
          {/* Search Section */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search files..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-white bg-opacity-5"
              />
              <Button
                onClick={handleSearch}
                disabled={isLoading || !query}
                className="bg-white bg-opacity-10 hover:bg-opacity-20"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card className="bg-white bg-opacity-5">
                <CardContent className="p-4 space-y-2">
                  {searchResults.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 hover:bg-white 
                               hover:bg-opacity-5 rounded-lg cursor-pointer"
                      onClick={() => {
                        onFileSelect?.(file.name);
                        handleGenerateSummary(file.name, currentPath);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <FileText size={16} />
                        {file.name}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* File Summary Section */}
          {selectedFile && (
            <div className="space-y-2">
              <h3 className="font-medium">File Summary</h3>
              <Card className="bg-white bg-opacity-5">
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium mb-2">{selectedFile}</h4>
                  {isLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="animate-spin" size={24} />
                    </div>
                  ) : (
                    <p className="text-sm text-white text-opacity-80">{summary}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISidePanel;